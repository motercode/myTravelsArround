// Datos administrados a mano en data/admin/ (docs/features/panel-admin.md). Funciones puras, sin
// fs: las usan el build (load-contributions.ts) y el panel local (tools/admin/), para que los dos
// vean lo mismo.
import { z } from "zod";
import { AUTHORS, type Contribution } from "./contributions.ts";

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
