// Datos del mapa repartidos para que la página no cargue de golpe las URL de todas las fotos (#42).
//
// - Base: posición, autor y viaje de cada foto. Es lo que necesitan siempre la agrupación y los
//   filtros (~120 KB comprimida con unas 21 000 fotos).
// - Detalles: URL de Maps y miniatura (el 95 % del peso), en bloques de DETAIL_CHUNK_SIZE fotos.
//   Las fotos se ordenan por cercanía (curva de Morton), así que las de una zona caen en pocos
//   bloques y el navegador solo pide los de las fotos sueltas que ve.
//
// Funciones puras: las usan las rutas estáticas de src/app/datos/ en el build y el navegador.
import type { Contribution } from "./contributions.ts";

export const DETAIL_CHUNK_SIZE = 500;

// [lat, lng, índice del autor en `authors`, índice del viaje en `trips` o -1]
export type BasePhoto = [number, number, number, number];
export type MapBase = { authors: string[]; trips: string[]; photos: BasePhoto[] };
// [URL que abre el clic, miniatura o null], en el mismo orden que `photos`
export type DetailChunk = [string, string | null][];

// Intercala los bits de dos enteros de 16 bits: puntos cercanos dan números cercanos.
function morton(x: number, y: number): number {
  const spread = (v: number) => {
    v = (v | (v << 8)) & 0x00ff00ff;
    v = (v | (v << 4)) & 0x0f0f0f0f;
    v = (v | (v << 2)) & 0x33333333;
    v = (v | (v << 1)) & 0x55555555;
    return v;
  };
  return ((spread(x) | (spread(y) << 1)) >>> 0);
}

function mortonOf(c: Contribution): number {
  const x = Math.min(65535, Math.max(0, Math.floor(((c.lng + 180) / 360) * 65536)));
  const y = Math.min(65535, Math.max(0, Math.floor(((c.lat + 90) / 180) * 65536)));
  return morton(x, y);
}

/** Fotos ordenadas por cercanía; con el mismo código, por id, para que el orden sea estable. */
export function spatialOrder(contributions: Contribution[]): Contribution[] {
  return contributions
    .map((c) => ({ c, key: mortonOf(c) }))
    .sort((a, b) => a.key - b.key || (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0))
    .map(({ c }) => c);
}

// 5 decimales: ~1 m, de sobra para un punto en el mapa.
const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

/** Base del mapa a partir de las fotos ya ordenadas con `spatialOrder`. */
export function buildMapBase(sorted: Contribution[]): MapBase {
  const authors: string[] = [];
  const trips: string[] = [];
  const indexOf = (list: string[], value: string) => {
    const i = list.indexOf(value);
    return i >= 0 ? i : list.push(value) - 1;
  };
  const photos = sorted.map((c): BasePhoto => [
    round5(c.lat),
    round5(c.lng),
    indexOf(authors, c.author),
    c.tripId ? indexOf(trips, c.tripId) : -1,
  ]);
  return { authors, trips, photos };
}

export function chunkCount(total: number): number {
  return Math.ceil(total / DETAIL_CHUNK_SIZE);
}

export function chunkOf(index: number): number {
  return Math.floor(index / DETAIL_CHUNK_SIZE);
}

/** Detalles del bloque `n` de las fotos ya ordenadas. */
export function detailChunk(sorted: Contribution[], n: number): DetailChunk {
  return sorted
    .slice(n * DETAIL_CHUNK_SIZE, (n + 1) * DETAIL_CHUNK_SIZE)
    .map((c) => [c.mapsUrl, c.imageUrl ?? null]);
}

// Foto tal como la usa el mapa en el navegador: `index` es su posición en la base y dice en qué
// bloque están sus detalles.
export type MapPhoto = { index: number; lat: number; lng: number; author: string; tripId?: string };

export function photosFromBase({ authors, trips, photos }: MapBase): MapPhoto[] {
  return photos.map(([lat, lng, a, t], index) => ({
    index,
    lat,
    lng,
    author: authors[a],
    ...(t >= 0 ? { tripId: trips[t] } : {}),
  }));
}
