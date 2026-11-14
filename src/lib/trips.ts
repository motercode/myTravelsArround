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
  name?: string; // opcional; lo añadirá el panel de administración (#32)
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

/** Viajes de todos los autores, del más reciente al más antiguo. */
export function buildTrips(contributions: Contribution[], maxEmptyDays = MAX_EMPTY_DAYS_IN_TRIP): Trip[] {
  const byAuthor = new Map<string, Contribution[]>();
  for (const c of contributions) {
    if (!c.takenAt) continue;
    const list = byAuthor.get(c.author);
    if (list) list.push(c);
    else byAuthor.set(c.author, [c]);
  }

  const trips: Trip[] = [];
  for (const [author, photos] of byAuthor) {
    // Orden cronológico; con la misma fecha (o una solo con día), por id para que sea estable.
    photos.sort((a, b) => (a.takenAt! < b.takenAt! ? -1 : a.takenAt! > b.takenAt! ? 1 : a.id < b.id ? -1 : 1));
    let current: Trip | null = null;
    for (const photo of photos) {
      const day = dayOf(photo.takenAt!);
      const last = current?.days.at(-1);
      if (current && last === day) {
        current.photoIds.push(photo.id);
        continue;
      }
      if (current && last && dayNumber(day) - dayNumber(last) - 1 <= maxEmptyDays) {
        current.days.push(day);
        current.endDay = day;
        current.photoIds.push(photo.id);
        continue;
      }
      current = { id: `${slug(author)}-${day}`, author, startDay: day, endDay: day, days: [day], photoIds: [photo.id] };
      trips.push(current);
    }
  }

  return trips.sort((a, b) =>
    a.startDay !== b.startDay ? (a.startDay < b.startDay ? 1 : -1) : a.author < b.author ? -1 : 1,
  );
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
export type TripSummary = Omit<Trip, "photoIds" | "days"> & { dayCount: number; photoCount: number };

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
    trips: trips.map(({ photoIds, days, ...trip }): TripSummary => ({
      ...trip,
      dayCount: days.length,
      photoCount: photoIds.length,
    })),
  };
}
