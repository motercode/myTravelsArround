# FEATURE: panel de administración local

Especificación del panel con el que se administran a mano los datos de myTravelsArround: autores
de fotos concretas, nombres de los viajes, ajustes y posiciones deducidas de los tracks. Está
escrita para un agente que no conoce el proyecto. Issue: #32.

Estado a 2026-11-14: fase 1 (base del panel + Autores) implementada en #33. Fases 2 y 3 pendientes.

## 1. Objetivo y principios

Un solo panel **local**, que se lanza a mano (`npm run admin`), con una sección por cada cosa que
se administra. Los tracks (#22) son una sección más, no la base del panel.

**Principio de seguridad (decidido):** no hay administración remota. Nada de lo publicado se puede
cambiar desde internet ni por descuido:

- La web publicada es estática (regla 1 de `AGENTS.md`) y no tiene nada que escriba datos.
- El panel no forma parte del build: no está en `src/app` ni lo ve Netlify.
- El panel solo escucha en `localhost` y solo escribe ficheros en la copia local.
- Un cambio solo llega a la web por git: commit, PR y merge a `main`. El diff del PR es la
  revisión y git el historial.
- El panel **se niega a guardar en la rama `main`** (sección 4).

## 2. Datos que administra: `data/admin/`

Lo administrado va **aparte** de `data/contributions/`. Así `data/contributions/` es solo lo que
exporta `../contribExtraction`, y una reexportación no borra nada de lo decidido a mano (#31). El
build lee los dos y aplica `data/admin/` encima.

| Fichero | Qué guarda | Sección | Issue |
|---|---|---|---|
| `data/admin/autores.json` | autor de fotos concretas | Autores | #33 |
| `data/admin/viajes.json` | nombres de viaje | Viajes | #32 |
| `data/admin/ajustes.json` | ajustes del build, p. ej. el umbral de días vacíos | Ajustes | #32 |
| `data/admin/posiciones.json` | posición deducida de los tracks (`trackMatch`) | Posiciones | #22 |

Todos son opcionales: si un fichero no existe, el build se comporta como hoy.

### 2.1 Identificador de una foto

Las fotos se identifican con el `id` que ya calcula `load-contributions.ts`:
`<autor de la URL>:<photoId>` (p. ej. `fernando gost:CIHM0og…`, `motercode:AF1Qip…` para las de
álbum). El autor de ese id es **siempre el de la URL** (con las fotos sin autor como de motercode,
#7), nunca el reasignado: así el id no cambia al reasignar el autor.

### 2.2 Formatos

Claves en inglés, como el resto de los JSON de datos. Cada fichero lleva `version: 1` para poder
cambiar el formato más adelante.

```jsonc
// data/admin/autores.json: id de la foto → autor final (un nombre de AUTHORS)
{ "version": 1, "photos": { "motercode:AF1QipNTN0Nk…": "fernando gost" } }

// data/admin/viajes.json: nombre de un viaje (sección 5.1)
{ "version": 1, "names": [{ "author": "motercode", "day": "2018-09-21", "name": "Alpes en moto" }] }

// data/admin/ajustes.json
{ "version": 1, "maxEmptyDaysInTrip": 2 }

// data/admin/posiciones.json: id de la foto → trackMatch (formato en posiciones-desde-tracks.md, sección 7)
{ "version": 1, "photos": { "fernando gost:CIHM0og…": { "coordinates": { … }, "status": "auto", … } } }
```

### 2.3 Cómo los usa el build

En `src/lib/load-contributions.ts`, después de leer `data/contributions/` y quitar duplicados, y
**antes** de calcular los viajes:

1. `autores.json`: cambia `author` de las fotos listadas. Su `id` no cambia.
2. `posiciones.json`: aplica las posiciones como dice `posiciones-desde-tracks.md`, sección 7.2.
3. `viajes.json` y `ajustes.json`: los usa `buildTrips` (fase 1 de viajes, #8).

Validación con zod. Estos ficheros los escribe el panel, así que un formato no válido es un
error: **el build falla** con el nombre del fichero (igual que con `data/contributions/`). Un id
que ya no existe en los datos no es un error: se ignora y el panel lo lista como huérfano.

La lógica de aplicar `data/admin/` va en funciones puras de `src/lib/` (sin `fs`), con tests de
Vitest, y la usan tanto el build como el panel, para que los dos vean lo mismo.

## 3. El panel

- `npm run admin` levanta `http://localhost:3040` (`node:http`, escucha solo en `127.0.0.1`).
- Una página con pestañas por sección y un **mapa común** (Leaflet, que ya está en el proyecto):
  fotos con el autor y la posición ya resueltos, popup con la imagen grande y capas **satélite**
  (Esri World Imagery) e **iconográfica** (OpenStreetMap).
- Selección de fotos en el mapa: clic, selección por rectángulo y «todas las de este álbum» o
  «de este viaje».
- Una API local mínima: leer el estado y guardar en `data/admin/`. Escribe el JSON ordenado por
  clave y con formato estable, para que el diff de git sea pequeño y legible.
- Un aviso permanente con los cambios sin commit en `data/admin/` (`git status --porcelain`).

Código en `tools/admin/` (servidor y página) con TypeScript ejecutado directamente por Node (hace
falta Node 22.18 o posterior), sin dependencias nuevas. Por eso el proyecto es `"type": "module"`
y los ficheros de `src/lib/` se importan entre sí con extensión (`./contributions.ts`). Es negocio de este proyecto: no va a la
plantilla (regla 6).

## 4. Guardado seguro (decidido)

- Antes de guardar, el panel mira la rama actual. **En `main` no guarda**: muestra un aviso y
  explica cómo crear una rama con `scripts/nuevo-cambio.sh`.
- Tampoco guarda si la carpeta no es un repositorio git.
- Al guardar no hace commit ni push: eso se hace con el ciclo normal (`scripts/comprobar.sh` y
  `scripts/abrir-pr.sh`).

## 5. Secciones y fases

### Fase 1: base del panel + Autores (#33)

- Servidor, página, mapa común, guardado seguro y aviso de cambios sin commit.
- **Autores**: elegir fotos (una, una selección o un álbum entero) y su autor nuevo, entre los de
  `AUTHORS`. Quitar una reasignación la devuelve al autor de la URL.
- En la web: el filtro por autor y su recuento usan el autor final.
- Criterios:
  - Tests de la función que aplica `autores.json`: la foto cambia de autor, su `id` no cambia y un
    id inexistente se ignora.
  - El build falla con un `autores.json` mal formado o con un autor que no está en `AUTHORS`.
  - En `main`, el panel no guarda.
  - E2E del panel sobre datos ficticios: reasignar una foto y ver que se escribe `autores.json`.

### Fase 2: Viajes y Ajustes (después del código de la fase 1 de viajes, #8)

#### 5.1 Nombres de viaje

El id de un viaje (`<autor>-<primer día>`) cambia si entran fotos de un día anterior, así que el
nombre **no se guarda por id**. Se guarda con el **autor y un día cualquiera del viaje**
(`{ author, day, name }`) y se aplica al viaje de ese autor que contenga ese día.

- Si dos nombres caen en el mismo viaje (por ejemplo, porque dos viajes se han unido), el build no
  falla: usa el del día más antiguo y el panel avisa del conflicto.
- Un nombre cuyo día ya no está en ningún viaje queda huérfano y el panel lo lista.

#### 5.2 Ajustes

- `maxEmptyDaysInTrip` (2 por defecto). Solo desde el panel, nunca desde la web pública.

### Fase 3: Posiciones (tracks, #22)

Es la fase 3 de [posiciones-desde-tracks.md](posiciones-desde-tracks.md) (revisión manual en el
mapa) como sección del panel. Preparar y cruzar los tracks siguen siendo comandos aparte
(`npm run tracks:preparar` y `tracks:cruzar`), porque procesan cientos de MB. Depende de #24.

## 6. Decisiones

Tomadas (2026-11-14):

1. Un solo panel local; los tracks son una sección, no la base.
2. Sin administración remota.
3. Lo administrado va en `data/admin/`, aparte de `data/contributions/`.
4. El panel no guarda en `main`.
5. Orden: base + Autores → fase 1 de viajes en la web → Viajes y Ajustes → Posiciones.

6. **Las ediciones de datos se agrupan**: una tanda de cambios hechos con el panel va en un solo
   issue y un solo PR, no un issue por cambio.
