import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { authorFromUrl, photoIdFromUrl, stableThumbnailUrl, type Contribution } from "@/lib/contributions";

// Formato generado por ../contribExtraction (contribuciones.json).
const extractionFileSchema = z.object({
  total: z.number().optional(),
  items: z.array(
    z.object({
      url: z.string(),
      mapsUrlCanonical: z.string().optional(),
      imageUrl: z.string().optional(),
      coordinates: z
        .object({ latitude: z.number(), longitude: z.number() })
        .nullable()
        .optional(),
    }),
  ),
});

const DATA_DIR = path.join(process.cwd(), "data", "contributions");

function isValidPosition(lat: number, lng: number) {
  if (lat === 0 && lng === 0) return false;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * Lee todos los JSON de data/contributions/ en tiempo de build,
 * descarta los que no tienen coordenadas válidas y elimina duplicados
 * (misma foto exportada en varias extracciones).
 */
export function loadContributions(): Contribution[] {
  if (!fs.existsSync(DATA_DIR)) return [];

  const byId = new Map<string, Contribution>();

  for (const file of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
    const parsed = extractionFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Formato no válido en data/contributions/${file}: ${parsed.error.message}`);
    }

    for (const item of parsed.data.items) {
      const coords = item.coordinates;
      if (!coords || !isValidPosition(coords.latitude, coords.longitude)) continue;

      const id = photoIdFromUrl(item.url) ?? item.url;
      byId.set(id, {
        id,
        lat: coords.latitude,
        lng: coords.longitude,
        author: authorFromUrl(item.url),
        mapsUrl: item.mapsUrlCanonical ?? item.url,
        imageUrl: item.imageUrl ? stableThumbnailUrl(item.imageUrl) : undefined,
      });
    }
  }

  return [...byId.values()];
}
