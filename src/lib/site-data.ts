// Datos del sitio calculados una sola vez por build: los usan la página y las rutas estáticas de
// src/app/datos/, que tienen que ver exactamente el mismo orden de fotos.
import { loadContributions } from "./load-contributions.ts";
import { spatialOrder } from "./map-data.ts";
import { buildTrips, tripsForPage, type TripSummary } from "./trips.ts";
import type { Contribution } from "./contributions.ts";

let cache: { sorted: Contribution[]; trips: TripSummary[] } | null = null;

export function getSiteData() {
  if (!cache) {
    const contributions = loadContributions();
    const page = tripsForPage(contributions, buildTrips(contributions));
    cache = { sorted: spatialOrder(page.contributions), trips: page.trips };
  }
  return cache;
}
