// Agrupación de puntos por zoom (#9) con supercluster: solo se dibujan los grupos y puntos del área
// visible, en vez de un marcador por cada una de las ~20 000 fotos. Sin Leaflet ni React.
import Supercluster from "supercluster";

// Por encima de este zoom no se agrupa: se ven todas las fotos sueltas.
export const CLUSTER_MAX_ZOOM = 16;
// Radio de agrupación en píxeles de pantalla.
const CLUSTER_RADIUS = 60;

export type PointProps = { index: number };

// `index` de cada punto es su posición en la lista recibida.
export function buildClusterIndex(points: { lat: number; lng: number }[]) {
  return new Supercluster<PointProps>({ radius: CLUSTER_RADIUS, maxZoom: CLUSTER_MAX_ZOOM }).load(
    points.map((c, index) => ({
      type: "Feature" as const,
      properties: { index },
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
    })),
  );
}

// Tamaño del grupo según cuántas fotos tiene: crece con el logaritmo para que se vea la densidad
// sin que un grupo de 10 000 tape el mapa (2 → 30 px, 100 → 44 px, 10 000 → 60 px).
export function clusterSize(count: number): number {
  return Math.round(28 + 8 * Math.log10(Math.max(count, 1)));
}

const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

/**
 * Caja [oeste, sur, este, norte] para supercluster a partir de los límites del mapa. Leaflet da
 * longitudes fuera de ±180 al dar la vuelta al mundo; supercluster las quiere dentro y acepta
 * oeste > este para la caja que cruza el antimeridiano.
 */
export function clusterBBox(west: number, south: number, east: number, north: number): [number, number, number, number] {
  const lat = (v: number) => Math.max(-90, Math.min(90, v));
  if (east - west >= 360) return [-180, lat(south), 180, lat(north)];
  return [wrapLng(west), lat(south), wrapLng(east), lat(north)];
}
