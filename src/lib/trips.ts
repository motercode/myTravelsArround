// Viajes, fase 1 (docs/features/viajes.md, sección 4): agrupar las fotos de cada autor en días con
// fotos seguidos o casi seguidos. Funciones puras: sin Node ni navegador.
import type { Contribution } from "./contributions.ts";

// Más días sin fotos que esto entre dos días con fotos y empieza un viaje nuevo.
export const MAX_EMPTY_DAYS_IN_TRIP = 2;

export type Trip = {
  id: string; // `<autor en minúsculas y con guiones>-<primer día>`, estable entre builds
  author: string;
  startDay: string; // "YYYY-MM-DD"
  endDay: string; // "YYYY-MM-DD"
  days: string[]; // solo los días que tienen fotos, ordenados
  photoIds: string[]; // Contribution.id, en orden cronológico
  firstTakenAt: string; // `takenAt` de la primera y la última foto: el panel señala los viajes con ellos
  lastTakenAt: string;
  name?: string; // opcional; se pone desde el panel de administración (#32)
};

// El día son los 10 primeros caracteres: sin `new Date()`, porque la hora EXIF no tiene zona y la
// conversión podría moverla de día.
export function dayOf(takenAt: string): string {
  return takenAt.slice(0, 10);
}

// Días entre dos fechas "YYYY-MM-DD", en UTC para que el cambio de hora no reste un día.
function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function slug(author: string): string {
  return author.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Reglas de data/admin/viajes.json (docs/features/panel-admin.md, sección 5.1). Cada viaje se
// señala con un momento `at` ("YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ss", hora local como `takenAt`):
// el viaje del autor que contiene ese momento. No se usan ids de viaje porque cambian.
export type TripOperation =
  | { type: "merge"; author: string; trips: [string, string] }
  | { type: "split"; author: string; at: string };
export type TripName = { author: string; at: string; name: string };
export type TripRules = { operations: TripOperation[]; names: TripName[] };

export const NO_RULES: TripRules = { operations: [], names: [] };

type Group = { author: string; photos: Contribution[] };

const byTakenAt = (a: Contribution, b: Contribution) =>
  a.takenAt! < b.takenAt! ? -1 : a.takenAt! > b.takenAt! ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const hasTime = (at: string) => at.length > 10;

// Límites de un grupo como momentos completos: una foto con solo el día cubre el día entero.
function bounds(group: Group): [string, string] {
  const first = group.photos[0].takenAt!;
  const last = group.photos.at(-1)!.takenAt!;
  return [hasTime(first) ? first : `${first}T00:00:00`, hasTime(last) ? last : `${last}T23:59:59`];
}

function contains(group: Group, at: string): boolean {
  if (!hasTime(at)) return group.photos.some((p) => dayOf(p.takenAt!) === at);
  const [first, last] = bounds(group);
  return first <= at && at <= last;
}

// Primero el viaje con una foto justo en ese momento (los nombres y las uniones se anclan en la
// primera foto): al unir dos viajes no seguidos, el unido abarca en fechas a los de entre medias y
// sin esto se quedaría con sus reglas. Si no hay ninguna, el viaje cuyo rango lo contiene.
function findGroup(groups: Group[], author: string, at: string): Group | undefined {
  const mine = groups.filter((g) => g.author === author);
  return mine.find((g) => g.photos.some((p) => p.takenAt === at)) ?? mine.find((g) => contains(g, at));
}

// Lado del corte de una foto. Las que solo tienen el día del corte van al lado con más horas de
// ese día: con el corte a las 12:00 o más tarde, al anterior (#40).
function beforeCut(takenAt: string, at: string): boolean {
  if (hasTime(takenAt)) return takenAt < at;
  const day = dayOf(at);
  if (takenAt !== day) return takenAt < day;
  return at.slice(11) >= "12:00:00";
}

function autoGroups(contributions: Contribution[], maxEmptyDays: number): Group[] {
  const byAuthor = new Map<string, Contribution[]>();
  for (const c of contributions) {
    if (!c.takenAt) continue;
    const list = byAuthor.get(c.author);
    if (list) list.push(c);
    else byAuthor.set(c.author, [c]);
  }
  const groups: Group[] = [];
  for (const [author, photos] of byAuthor) {
    // Orden cronológico; con la misma fecha (o una solo con día), por id para que sea estable.
    photos.sort(byTakenAt);
    let current: Group | null = null;
    let lastDay = "";
    for (const photo of photos) {
      const day = dayOf(photo.takenAt!);
      if (current && (day === lastDay || dayNumber(day) - dayNumber(lastDay) - 1 <= maxEmptyDays)) {
        current.photos.push(photo);
      } else {
        current = { author, photos: [photo] };
        groups.push(current);
      }
      lastDay = day;
    }
  }
  return groups;
}

/**
 * Viajes con las reglas del panel aplicadas: primero la agrupación automática, después las
 * operaciones de unir y separar en el orden en que se hicieron y al final los nombres. Las reglas
 * que ya no encajan con los datos (su momento no cae en ningún viaje) no son un error: se devuelven
 * sus posiciones para que el panel las enseñe.
 */
export function buildTripsWithRules(
  contributions: Contribution[],
  rules: TripRules = NO_RULES,
  maxEmptyDays = MAX_EMPTY_DAYS_IN_TRIP,
): { trips: Trip[]; orphanOperations: number[]; orphanNames: number[]; nameTrips: (string | null)[] } {
  let groups = autoGroups(contributions, maxEmptyDays);
  const orphanOperations: number[] = [];

  rules.operations.forEach((op, i) => {
    if (op.type === "split") {
      const group = findGroup(groups, op.author, op.at);
      const before = group?.photos.filter((p) => beforeCut(p.takenAt!, op.at)) ?? [];
      const after = group?.photos.filter((p) => !beforeCut(p.takenAt!, op.at)) ?? [];
      if (!group || before.length === 0 || after.length === 0) return orphanOperations.push(i);
      groups = groups.flatMap((g) => (g === group ? [{ author: g.author, photos: before }, { author: g.author, photos: after }] : [g]));
    } else {
      const a = findGroup(groups, op.author, op.trips[0]);
      const b = findGroup(groups, op.author, op.trips[1]);
      if (!a || !b || a === b) return orphanOperations.push(i);
      // Solo esos dos: los viajes que haya entre medias siguen aparte (#40).
      const merged = { author: a.author, photos: [...a.photos, ...b.photos].sort(byTakenAt) };
      groups = groups.filter((g) => g !== b).map((g) => (g === a ? merged : g));
    }
  });

  // Nombres: si varios caen en el mismo viaje, gana el del momento más antiguo (al unir, se queda
  // el del viaje más antiguo).
  const names = new Map<Group, { at: string; name: string }>();
  const orphanNames: number[] = [];
  const nameGroups = rules.names.map((n) => findGroup(groups, n.author, n.at));
  rules.names.forEach((n, i) => {
    const group = nameGroups[i];
    if (!group) return orphanNames.push(i);
    const current = names.get(group);
    if (!current || n.at < current.at) names.set(group, { at: n.at, name: n.name });
  });

  const used = new Map<string, number>();
  const tripOfGroup = new Map<Group, Trip>();
  const trips = groups
    .map((g): Trip => {
      const days = [...new Set(g.photos.map((p) => dayOf(p.takenAt!)))];
      const name = names.get(g)?.name;
      const trip: Trip = {
        id: "",
        author: g.author,
        startDay: days[0],
        endDay: days.at(-1)!,
        days,
        photoIds: g.photos.map((p) => p.id),
        firstTakenAt: g.photos[0].takenAt!,
        lastTakenAt: g.photos.at(-1)!.takenAt!,
        ...(name ? { name } : {}),
      };
      tripOfGroup.set(g, trip);
      return trip;
    })
    .sort((a, b) => (a.firstTakenAt < b.firstTakenAt ? -1 : a.firstTakenAt > b.firstTakenAt ? 1 : a.author < b.author ? -1 : 1));
  // Ids en orden cronológico: si al separar dos viajes empiezan el mismo día, el segundo lleva «-2».
  for (const trip of trips) {
    const base = `${slug(trip.author)}-${trip.startDay}`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    trip.id = n === 1 ? base : `${base}-${n}`;
  }
  trips.reverse(); // del más reciente al más antiguo
  // A qué viaje va cada nombre (null si a ninguno): el panel lo usa para cambiarlo o quitarlo.
  const nameTrips = nameGroups.map((g) => (g ? tripOfGroup.get(g)!.id : null));
  return { trips, orphanOperations, orphanNames, nameTrips };
}

/** Viajes de todos los autores, del más reciente al más antiguo, sin reglas del panel. */
export function buildTrips(contributions: Contribution[], maxEmptyDays = MAX_EMPTY_DAYS_IN_TRIP): Trip[] {
  return buildTripsWithRules(contributions, NO_RULES, maxEmptyDays).trips;
}

/** Años con viajes, del más reciente al más antiguo. Un viaje va en el año de su primer día. */
export function groupTripsByYear<T extends Pick<Trip, "startDay">>(trips: T[]): { year: string; trips: T[] }[] {
  const byYear = new Map<string, T[]>();
  for (const trip of trips) {
    const year = trip.startDay.slice(0, 4);
    const list = byYear.get(year);
    if (list) list.push(trip);
    else byYear.set(year, [trip]);
  }
  return [...byYear.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([year, trips]) => ({ year, trips }));
}

// Formateo en UTC: el día "2020-09-30" sale 30 en cualquier zona horaria.
const DAY = new Intl.DateTimeFormat("es-ES", { day: "numeric", timeZone: "UTC" });
const DAY_MONTH = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const FULL = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function utc(day: string): Date {
  return new Date(dayNumber(day) * 86_400_000);
}

/** «30 sept 2020», «29–30 sept 2020», «29 sept – 2 oct 2020» o «30 dic 2020 – 2 ene 2021». */
export function formatTripDates({ startDay, endDay }: Pick<Trip, "startDay" | "endDay">): string {
  const start = utc(startDay);
  const end = utc(endDay);
  if (startDay === endDay) return FULL.format(start);
  if (startDay.slice(0, 7) === endDay.slice(0, 7)) return `${DAY.format(start)}–${FULL.format(end)}`;
  if (startDay.slice(0, 4) === endDay.slice(0, 4)) return `${DAY_MONTH.format(start)} – ${FULL.format(end)}`;
  return `${FULL.format(start)} – ${FULL.format(end)}`;
}

// Lo que necesita el navegador de cada viaje: sin la lista de ids (cada foto lleva su `tripId`).
export type TripSummary = Omit<Trip, "photoIds" | "days" | "firstTakenAt" | "lastTakenAt"> & {
  dayCount: number;
  photoCount: number;
};

/** Pone `tripId` a cada foto y resume los viajes para la página. */
export function tripsForPage(contributions: Contribution[], trips: Trip[]) {
  const tripOf = new Map<string, string>();
  for (const trip of trips) for (const id of trip.photoIds) tripOf.set(id, trip.id);
  return {
    // La fecha no hace falta en el navegador: solo el viaje.
    contributions: contributions.map((c): Contribution => {
      const { takenAt, takenAtSource, ...rest } = c;
      void takenAt;
      void takenAtSource;
      const tripId = tripOf.get(c.id);
      return tripId ? { ...rest, tripId } : rest;
    }),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se quitan a propósito
    trips: trips.map(({ photoIds, days, firstTakenAt, lastTakenAt, ...trip }): TripSummary => ({
      ...trip,
      dayCount: days.length,
      photoCount: photoIds.length,
    })),
  };
}
