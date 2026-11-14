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
  mergeTrips,
  nameTrip,
  serializeAdminFile,
  setAuthors,
  SETTINGS_FILE,
  settingsFileSchema,
  splitTrip,
  TRIPS_FILE,
  type AuthorsFile,
  type SettingsFile,
  type TripsFile,
} from "../../src/lib/admin-data.ts";
import { AUTHORS, type Contribution } from "../../src/lib/contributions.ts";
import { loadContributions, loadTripAdmin } from "../../src/lib/load-contributions.ts";
import { buildTripsWithRules } from "../../src/lib/trips.ts";

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

// Fotos con los autores ya reasignados: los viajes se agrupan por el autor final, como en el build.
function fotosConAutores(): Contribution[] {
  return applyAuthorOverrides(FOTOS, leerAutores()).contributions;
}

function estado() {
  const autores = leerAutores();
  const { contributions, orphanIds } = applyAuthorOverrides(FOTOS, autores);
  const { rules, settings } = loadTripAdmin(ADMIN);
  const { trips, orphanOperations, orphanNames } = buildTripsWithRules(contributions, rules, settings.maxEmptyDaysInTrip);
  const viajeDe = new Map<string, number>();
  trips.forEach((t, i) => t.photoIds.forEach((id) => viajeDe.set(id, i)));
  return {
    git: estadoGit(),
    autores: Object.values(AUTHORS),
    reasignadas: autores.photos,
    huerfanas: orphanIds,
    ajustes: settings,
    viajes: trips.map((t) => ({
      id: t.id,
      autor: t.author,
      inicio: t.startDay,
      fin: t.endDay,
      primera: t.firstTakenAt,
      ultima: t.lastTakenAt,
      nombre: t.name ?? null,
      dias: t.days.length,
      fotos: t.photoIds.length,
    })),
    // Reglas de viajes.json que ya no caen en ningún viaje: no hacen nada y se pueden quitar.
    reglasHuerfanas: [
      ...orphanOperations.map((i) => ({ tipo: "operacion", indice: i, regla: rules.operations[i] })),
      ...orphanNames.map((i) => ({ tipo: "nombre", indice: i, regla: rules.names[i] })),
    ],
    // Compacto: unas 20 000 fotos. [id, lat, lng, autor final, url, miniatura, índice en viajes o -1, fecha o null]
    fotos: contributions.map((f) => [
      f.id,
      f.lat,
      f.lng,
      f.author,
      f.mapsUrl,
      f.imageUrl ?? null,
      viajeDe.get(f.id) ?? -1,
      f.takenAt ?? null,
    ]),
  };
}

type Respuesta = { status: number; body: unknown };

// Todas las escrituras pasan por aquí: en main o fuera de git no se guarda nada.
function guardarFichero(fichero: string, contenido: string): Respuesta {
  fs.mkdirSync(ADMIN, { recursive: true });
  fs.writeFileSync(path.join(ADMIN, fichero), contenido);
  return { status: 200, body: estado() };
}

function cambiarViajes(cambio: (fotos: Contribution[], reglas: TripsFile, ajustes: SettingsFile) => TripsFile): Respuesta {
  const repo = estadoGit();
  if (!repo.puedeGuardar) return { status: 409, body: { error: repo.motivo } };
  const { rules, settings } = loadTripAdmin(ADMIN);
  let nuevo: TripsFile;
  try {
    nuevo = cambio(fotosConAutores(), rules, settings);
  } catch (error) {
    return { status: 400, body: { error: (error as Error).message } };
  }
  return guardarFichero(TRIPS_FILE, serializeAdminFile(nuevo));
}

const texto = (v: unknown) => (typeof v === "string" ? v : null);

const ACCIONES_VIAJES: Record<string, (cuerpo: Record<string, unknown>) => Respuesta> = {
  nombre: ({ id, nombre }) =>
    cambiarViajes((f, r, a) => nameTrip(f, r, a.maxEmptyDaysInTrip, String(id), texto(nombre))),
  unir: ({ ids }) =>
    cambiarViajes((f, r, a) => {
      if (!Array.isArray(ids) || ids.length !== 2) throw new Error("Elige dos viajes para unirlos.");
      return mergeTrips(f, r, a.maxEmptyDaysInTrip, [String(ids[0]), String(ids[1])]);
    }),
  separar: ({ id, momento }) =>
    cambiarViajes((f, r, a) => splitTrip(f, r, a.maxEmptyDaysInTrip, String(id), String(momento ?? ""))),
  "quitar-regla": ({ tipo, indice }) =>
    cambiarViajes((_f, r) => {
      const lista = tipo === "operacion" ? r.operations : tipo === "nombre" ? r.names : null;
      if (!lista || typeof indice !== "number" || !lista[indice]) throw new Error("Esa regla no existe.");
      return tipo === "operacion"
        ? { ...r, operations: r.operations.filter((_, i) => i !== indice) }
        : { ...r, names: r.names.filter((_, i) => i !== indice) };
    }),
};

function guardarAjustes(cuerpo: Record<string, unknown>): Respuesta {
  const repo = estadoGit();
  if (!repo.puedeGuardar) return { status: 409, body: { error: repo.motivo } };
  const parsed = settingsFileSchema.safeParse({ version: 1, maxEmptyDaysInTrip: cuerpo.maxEmptyDaysInTrip });
  if (!parsed.success) return { status: 400, body: { error: "Los días tienen que ser un número entero entre 0 y 60." } };
  return guardarFichero(SETTINGS_FILE, serializeAdminFile(parsed.data));
}

function guardarAutores(cuerpo: unknown): Respuesta {
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
  return guardarFichero(AUTHORS_FILE, serializeAuthorsFile(nuevo));
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
    const accion =
      url.pathname === "/api/autores"
        ? guardarAutores
        : url.pathname === "/api/ajustes"
          ? guardarAjustes
          : url.pathname.startsWith("/api/viajes/")
            ? ACCIONES_VIAJES[url.pathname.slice("/api/viajes/".length)]
            : undefined;
    if (req.method === "POST" && accion) {
      let cuerpo = "";
      req.on("data", (trozo) => (cuerpo += trozo));
      req.on("end", () => {
        let datos: unknown;
        try {
          datos = JSON.parse(cuerpo);
        } catch {
          return json(res, 400, { error: "JSON no válido." });
        }
        try {
          const { status, body } = accion((datos ?? {}) as Record<string, unknown>);
          json(res, status, body);
        } catch (error) {
          json(res, 500, { error: (error as Error).message });
        }
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
