import { buildMapBase } from "@/lib/map-data";
import { getSiteData } from "@/lib/site-data";

// Fichero estático generado en el build: posición, autor y viaje de cada foto (#42).
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildMapBase(getSiteData().sorted));
}
