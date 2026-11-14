import { chunkCount, detailChunk } from "@/lib/map-data";
import { getSiteData } from "@/lib/site-data";

// Un fichero estático por bloque de fotos con sus URL (#42); se generan todos en el build y
// cualquier otro número da 404.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Array.from({ length: chunkCount(getSiteData().sorted.length) }, (_, n) => ({ parte: String(n) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ parte: string }> }) {
  const { parte } = await params;
  return Response.json(detailChunk(getSiteData().sorted, Number(parte)));
}
