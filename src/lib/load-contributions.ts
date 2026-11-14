import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { applyAuthorOverrides, AUTHORS_FILE, authorsFileSchema } from "./admin-data.ts";
import { authorFromUrl, photoIdFromUrl, stableThumbnailUrl, type Contribution } from "./contributions.ts";

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
// Lo administrado a mano (panel local, docs/features/panel-admin.md), aparte de lo exportado.
const ADMIN_DIR = path.join(process.cwd(), "data", "admin");

function isValidPosition(lat: number, lng: number) {
  if (lat === 0 && lng === 0) return false;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * Lee todos los JSON de data/contributions/ en tiempo de build,
 * descarta los que no tienen coordenadas válidas y elimina duplicados
 * (misma foto exportada en varias extracciones). Después aplica data/admin/.
 * `dataDir` y `adminDir` solo se cambian en los tests y en el panel. Con un `dataDir` propio no se
 * lee data/admin/ salvo que se pase `adminDir`, para que los tests no dependan de los datos reales;
 * `adminDir` null no aplica nada (el panel necesita las fotos sin reasignar).
 */
export function loadContributions(
  dataDir: string = DATA_DIR,
  adminDir: string | null = dataDir === DATA_DIR ? ADMIN_DIR : null,
): Contribution[] {
  if (!fs.existsSync(dataDir)) return [];

  const byId = new Map<string, Contribution>();

  for (const file of fs.readdirSync(dataDir).filter((f) => f.endsWith(".json")).sort()) {
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
    const parsed = extractionFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Formato no válido en data/contributions/${file}: ${parsed.error.message}`);
    }

    for (const item of parsed.data.items) {
      const coords = item.coordinates;
      if (!coords || !isValidPosition(coords.latitude, coords.longitude)) continue;

      // La clave lleva el autor: el export de prueba (testA) repite los photoId de otro autor
      // y no debe reemplazar sus fotos.
      const author = authorFromUrl(item.url);
      const id = `${author}:${photoIdFromUrl(item.url) ?? item.url}`;
      byId.set(id, {
        id,
        lat: coords.latitude,
        lng: coords.longitude,
        author,
        mapsUrl: item.mapsUrlCanonical ?? item.url,
        imageUrl: item.imageUrl ? stableThumbnailUrl(item.imageUrl) : undefined,
      });
    }
  }

  const contributions = [...byId.values()];
  return adminDir ? applyAdmin(contributions, adminDir) : contributions;
}

// Los ficheros de data/admin/ los escribe el panel: un formato no válido es un error y para el build.
function applyAdmin(contributions: Contribution[], adminDir: string): Contribution[] {
  const authorsPath = path.join(adminDir, AUTHORS_FILE);
  if (!fs.existsSync(authorsPath)) return contributions;
  const parsed = authorsFileSchema.safeParse(JSON.parse(fs.readFileSync(authorsPath, "utf8")));
  if (!parsed.success) {
    throw new Error(`Formato no válido en data/admin/${AUTHORS_FILE}: ${parsed.error.message}`);
  }
  return applyAuthorOverrides(contributions, parsed.data).contributions;
}
