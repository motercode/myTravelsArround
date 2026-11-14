// Panel de administración local (docs/features/panel-admin.md): `npm run admin`.
// Solo escucha en 127.0.0.1, no forma parte del build y no guarda en `main`: lo que cambia aquí
// solo llega a la web por commit, PR y merge.
//
// Opciones: --datos <dir> (data/contributions), --admin <dir> (data/admin), --puerto <n> (3040).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  applyAuthorOverrides,
  AUTHORS_FILE,
  authorsFileSchema,
  emptyAuthorsFile,
  serializeAuthorsFile,
  setAuthors,
  type AuthorsFile,
} from "../../src/lib/admin-data.ts";
import { AUTHORS } from "../../src/lib/contributions.ts";
import { loadContributions } from "../../src/lib/load-contributions.ts";

const RAIZ = path.resolve(import.meta.dirname, "..", "..");
const { values: args } = parseArgs({
  options: {
    datos: { type: "string", default: path.join(RAIZ, "data", "contributions") },
    admin: { type: "string", default: path.join(RAIZ, "data", "admin") },
    puerto: { type: "string", default: "3040" },
  },
});
const DATOS = path.resolve(args.datos);
const ADMIN = path.resolve(args.admin);
const PUERTO = Number(args.puerto);
const PUBLICO = path.join(import.meta.dirname, "public");
const LEAFLET = path.join(RAIZ, "node_modules", "leaflet", "dist");

// Las fotos tal como salen de la exportación, sin data/admin/: el panel aplica las reasignaciones
// él mismo para poder enseñar el autor de la URL junto al final.
const FOTOS = loadContributions(DATOS, null);
const IDS = new Set(FOTOS.map((f) => f.id));

function leerAutores(): AuthorsFile {
  const fichero = path.join(ADMIN, AUTHORS_FILE);
  if (!fs.existsSync(fichero)) return emptyAuthorsFile();
  return authorsFileSchema.parse(JSON.parse(fs.readFileSync(fichero, "utf8")));
}

// El repositorio que se mira es el que contiene data/admin/. Si la carpeta aún no existe, la
// carpeta existente más cercana hacia arriba.
function carpetaExistente(dir: string): string {
  return fs.existsSync(dir) || path.dirname(dir) === dir ? dir : carpetaExistente(path.dirname(dir));
}

function git(...argumentos: string[]): string {
  return execFileSync("git", ["-C", carpetaExistente(ADMIN), ...argumentos], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

type EstadoGit = { rama: string | null; puedeGuardar: boolean; motivo: string | null; cambios: string[] };

function estadoGit(): EstadoGit {
  let rama: string;
  try {
    git("rev-parse", "--show-toplevel");
    rama = git("branch", "--show-current");
  } catch {
    return { rama: null, puedeGuardar: false, motivo: "La carpeta de datos no está en un repositorio git.", cambios: [] };
  }
  const cambios = git("status", "--porcelain", "--", ".").split("\n").filter(Boolean);
  if (rama === "main") {
    return {
      rama,
      puedeGuardar: false,
      motivo: "Estás en main: no se guarda nada. Crea una rama con scripts/nuevo-cambio.sh y vuelve a abrir el panel.",
      cambios,
    };
  }
  return { rama, puedeGuardar: true, motivo: null, cambios };
}

function estado() {
  const autores = leerAutores();
  const { contributions, orphanIds } = applyAuthorOverrides(FOTOS, autores);
  return {
    git: estadoGit(),
    autores: Object.values(AUTHORS),
    reasignadas: autores.photos,
    huerfanas: orphanIds,
    // Compacto: unas 20 000 fotos. [id, lat, lng, autor final, url, miniatura]
    fotos: contributions.map((f) => [f.id, f.lat, f.lng, f.author, f.mapsUrl, f.imageUrl ?? null]),
  };
}

function guardarAutores(cuerpo: unknown) {
  const repo = estadoGit();
  if (!repo.puedeGuardar) return { status: 409, body: { error: repo.motivo } };
  const { ids, autor } = (cuerpo ?? {}) as { ids?: unknown; autor?: unknown };
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string" && IDS.has(id))) {
    return { status: 400, body: { error: "ids no válidos: tienen que ser fotos que existen." } };
  }
  if (autor !== null && typeof autor !== "string") return { status: 400, body: { error: "autor no válido." } };
  let nuevo: AuthorsFile;
  try {
    nuevo = setAuthors(leerAutores(), ids as string[], autor);
  } catch (error) {
    return { status: 400, body: { error: (error as Error).message } };
  }
  fs.mkdirSync(ADMIN, { recursive: true });
  fs.writeFileSync(path.join(ADMIN, AUTHORS_FILE), serializeAuthorsFile(nuevo));
  return { status: 200, body: estado() };
}

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// Sirve un fichero solo si está dentro de `base` (nada de ../ fuera de ella).
function servirFichero(res: http.ServerResponse, base: string, relativo: string) {
  const fichero = path.resolve(base, `.${path.posix.normalize(`/${relativo}`)}`);
  if (!fichero.startsWith(base + path.sep) || !fs.existsSync(fichero) || !fs.statSync(fichero).isFile()) {
    res.writeHead(404).end("No encontrado");
    return;
  }
  res.writeHead(200, { "content-type": TIPOS[path.extname(fichero)] ?? "application/octet-stream" });
  fs.createReadStream(fichero).pipe(res);
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(body));
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/api/estado") return json(res, 200, estado());
    if (req.method === "POST" && url.pathname === "/api/autores") {
      let cuerpo = "";
      req.on("data", (trozo) => (cuerpo += trozo));
      req.on("end", () => {
        let datos: unknown;
        try {
          datos = JSON.parse(cuerpo);
        } catch {
          return json(res, 400, { error: "JSON no válido." });
        }
        const { status, body } = guardarAutores(datos);
        json(res, status, body);
      });
      return;
    }
    if (req.method !== "GET") return json(res, 405, { error: "Método no permitido." });
    if (url.pathname.startsWith("/leaflet/")) return servirFichero(res, LEAFLET, url.pathname.slice("/leaflet/".length));
    return servirFichero(res, PUBLICO, url.pathname === "/" ? "index.html" : url.pathname);
  } catch (error) {
    json(res, 500, { error: (error as Error).message });
  }
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  const { rama, motivo } = estadoGit();
  console.log(`→ panel en http://localhost:${PUERTO} (${FOTOS.length} fotos, rama ${rama ?? "—"})`);
  if (motivo) console.log(`✗ ${motivo}`);
});
