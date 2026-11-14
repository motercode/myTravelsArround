// Datos administrados a mano en data/admin/ (docs/features/panel-admin.md). Funciones puras, sin
// fs: las usan el build (load-contributions.ts) y el panel local (tools/admin/), para que los dos
// vean lo mismo.
import { z } from "zod";
import { AUTHORS, type Contribution } from "./contributions.ts";
import { buildTripsWithRules, MAX_EMPTY_DAYS_IN_TRIP, type Trip } from "./trips.ts";

export const AUTHORS_FILE = "autores.json";

const AUTHOR_NAMES = new Set(Object.values(AUTHORS));

export function isKnownAuthor(name: string): boolean {
  return AUTHOR_NAMES.has(name);
}

// autores.json: id de la foto → autor final. El id lleva el autor de la URL, que no cambia al
// reasignar (sección 2.1 de la especificación).
export const authorsFileSchema = z.object({
  version: z.literal(1),
  photos: z.record(
    z.string(),
    z.string().refine(isKnownAuthor, { message: "autor que no está en AUTHORS (src/lib/contributions.ts)" }),
  ),
});

export type AuthorsFile = z.infer<typeof authorsFileSchema>;

export function emptyAuthorsFile(): AuthorsFile {
  return { version: 1, photos: {} };
}

// Autor de la URL, sacado del id `<autor de la URL>:<photoId>` (los nombres no llevan «:»).
export function urlAuthorOf(id: string): string {
  return id.slice(0, id.indexOf(":"));
}

/**
 * Aplica las reasignaciones de autor. No modifica las fotos recibidas. Los ids que ya no existen
 * en los datos no son un error: se devuelven en `orphanIds` para que el panel los enseñe.
 */
export function applyAuthorOverrides(
  contributions: Contribution[],
  file: AuthorsFile,
): { contributions: Contribution[]; orphanIds: string[] } {
  const pending = new Set(Object.keys(file.photos));
  const result = contributions.map((c) => {
    const author = file.photos[c.id];
    if (author === undefined) return c;
    pending.delete(c.id);
    return { ...c, author };
  });
  return { contributions: result, orphanIds: [...pending].sort() };
}

/**
 * Devuelve un autores.json nuevo con `ids` asignados a `author`. Con `author` null, o si es el
 * mismo autor de la URL, la foto vuelve al autor de la URL y su entrada desaparece: el fichero
 * solo guarda lo que cambia algo.
 */
export function setAuthors(file: AuthorsFile, ids: string[], author: string | null): AuthorsFile {
  if (author !== null && !isKnownAuthor(author)) throw new Error(`Autor desconocido: ${author}`);
  const photos = { ...file.photos };
  for (const id of ids) {
    if (author === null || author === urlAuthorOf(id)) delete photos[id];
    else photos[id] = author;
  }
  return { version: 1, photos };
}

// JSON con las claves ordenadas y formato fijo: el diff de git solo muestra lo que cambia.
export function serializeAuthorsFile(file: AuthorsFile): string {
  const photos = Object.fromEntries(Object.entries(file.photos).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return `${JSON.stringify({ version: 1, photos }, null, 2)}\n`;
}

// --- Viajes y ajustes (fase 2 del panel, #32 y #40) ---

export const TRIPS_FILE = "viajes.json";
export const SETTINGS_FILE = "ajustes.json";

// Un momento como `takenAt`: día o día y hora local.
const moment = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/, "fecha no válida (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss)");
const author = z.string().refine(isKnownAuthor, { message: "autor que no está en AUTHORS (src/lib/contributions.ts)" });

export const tripsFileSchema = z.object({
  version: z.literal(1),
  operations: z.array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("merge"), author, trips: z.tuple([moment, moment]) }),
      z.object({ type: z.literal("split"), author, at: moment.refine((v) => v.length > 10, "el corte necesita hora") }),
    ]),
  ),
  names: z.array(z.object({ author, at: moment, name: z.string().trim().min(1) })),
});
export type TripsFile = z.infer<typeof tripsFileSchema>;

export const settingsFileSchema = z.object({
  version: z.literal(1),
  maxEmptyDaysInTrip: z.number().int().min(0).max(60),
});
export type SettingsFile = z.infer<typeof settingsFileSchema>;

export function emptyTripsFile(): TripsFile {
  return { version: 1, operations: [], names: [] };
}

export function defaultSettings(): SettingsFile {
  return { version: 1, maxEmptyDaysInTrip: MAX_EMPTY_DAYS_IN_TRIP };
}

export function serializeAdminFile(file: TripsFile | SettingsFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

function tripById(contributions: Contribution[], rules: TripsFile, maxEmptyDays: number, id: string): Trip {
  const trip = buildTripsWithRules(contributions, rules, maxEmptyDays).trips.find((t) => t.id === id);
  if (!trip) throw new Error(`No hay ningún viaje ${id}.`);
  return trip;
}

// Los nombres que hoy van a ese viaje, fuera (también los que perdían frente a otro).
function withoutNamesOf(contributions: Contribution[], rules: TripsFile, maxEmptyDays: number, trip: Trip) {
  const { nameTrips } = buildTripsWithRules(contributions, rules, maxEmptyDays);
  return rules.names.filter((_, i) => nameTrips[i] !== trip.id);
}

/** Pone (o quita, con null o vacío) el nombre de un viaje. */
export function nameTrip(contributions: Contribution[], rules: TripsFile, maxEmptyDays: number, id: string, name: string | null): TripsFile {
  const trip = tripById(contributions, rules, maxEmptyDays, id);
  const names = withoutNamesOf(contributions, rules, maxEmptyDays, trip);
  const clean = name?.trim();
  if (clean) names.push({ author: trip.author, at: trip.firstTakenAt, name: clean });
  return { ...rules, names };
}

/** Une dos viajes del mismo autor. El nombre del más antiguo gana solo (buildTripsWithRules). */
export function mergeTrips(contributions: Contribution[], rules: TripsFile, maxEmptyDays: number, ids: [string, string]): TripsFile {
  const [a, b] = ids.map((id) => tripById(contributions, rules, maxEmptyDays, id));
  if (a.id === b.id) throw new Error("Elige dos viajes distintos.");
  if (a.author !== b.author) throw new Error("Solo se pueden unir viajes del mismo autor.");
  return { ...rules, operations: [...rules.operations, { type: "merge", author: a.author, trips: [a.firstTakenAt, b.firstTakenAt] }] };
}

/**
 * Separa un viaje por la fecha y hora `at`. Si tenía nombre, las dos partes se quedan con él con
 * los prefijos PRE- y POST- (#40); después se cambian a mano.
 */
export function splitTrip(contributions: Contribution[], rules: TripsFile, maxEmptyDays: number, id: string, at: string): TripsFile {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(at)) throw new Error("El corte necesita fecha y hora (YYYY-MM-DDTHH:mm:ss).");
  const trip = tripById(contributions, rules, maxEmptyDays, id);
  const next: TripsFile = { ...rules, operations: [...rules.operations, { type: "split", author: trip.author, at }] };
  const result = buildTripsWithRules(contributions, next, maxEmptyDays);
  if (result.orphanOperations.includes(next.operations.length - 1)) {
    throw new Error("El corte tiene que dejar fotos del viaje a los dos lados.");
  }
  // Si el momento cae también en otro viaje que se solapa en fechas (uno unido), el corte iría a ese.
  const same = new Set(trip.photoIds);
  if (result.trips.some((t) => t.photoIds.length === same.size && t.photoIds.every((id) => same.has(id)))) {
    throw new Error("Ese momento cae también en otro viaje que se solapa con este: el corte no iría a este viaje.");
  }
  if (!trip.name) return next;
  const parts = result.trips.filter((t) => t.author === trip.author && trip.photoIds.includes(t.photoIds[0]));
  const [pre, post] = parts.sort((x, y) => (x.firstTakenAt < y.firstTakenAt ? -1 : 1));
  return {
    ...next,
    names: [
      ...withoutNamesOf(contributions, rules, maxEmptyDays, trip),
      { author: trip.author, at: pre.firstTakenAt, name: `PRE-${trip.name}` },
      { author: trip.author, at: post.firstTakenAt, name: `POST-${trip.name}` },
    ],
  };
}
