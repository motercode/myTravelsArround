# FEATURE: posiciones desde tracks

Especificación de una **herramienta local** que deduce o corrige la posición de las fotos cruzando
su hora con los tracks propios. Está escrita para un agente que no conoce el proyecto: contexto,
reglas exactas, fases y criterios para dar cada fase por terminada. Issue: #22.

Estado a 2026-11-14: solo especificación, no hay código de esta feature.

## 1. Objetivo

Hay fotos sin posición útil: las de álbumes de Google Fotos (#7), las que tienen `0,0` y las que
tienen una posición dudosa. Los tracks del autor (GPS, historial de ubicaciones) dicen dónde estaba
a cada hora. La herramienta:

1. **Prepara los tracks** (fase 1): descomprime, lee todos los formatos, quita duplicados y ordena.
2. **Cruza fotos y tracks** (fase 2): propone una posición para cada foto con su fiabilidad y
   acepta sola las que llegan al 95 %.
3. **Revisión manual en un mapa local** (fase 3): lo que no llega al 95 % se decide a mano. Es la
   sección **Posiciones** del panel de administración local ([panel-admin.md](panel-admin.md)).

La herramienta **se lanza a mano en local**. No forma parte de `npm run build` ni de Netlify, y la
web publicada sigue siendo estática (regla 1 de `AGENTS.md`): solo lee el resultado que la
herramienta deja en `data/admin/posiciones.json`.

## 2. Contexto

### 2.1 Fotos

`data/contributions/*.json` (formato y campos en la especificación de [viajes](viajes.md), sección
3). Para esta feature importan:

- `coordinates`: `{ latitude, longitude }`, la posición original. **No se modifica nunca.**
- `takenAt`: `"YYYY-MM-DDTHH:mm:ss"` (EXIF, **hora local de la cámara, sin zona horaria**) o
  `"YYYY-MM-DD"` (solo día). Está en 27 585 de 27 826 items.
- `takenAtSource`: `"exif"` o `"photometa"`.

Solo las fotos con **hora** (`takenAt` con `T`) entran en el cruce automático. Las de solo día y
las que no tienen `takenAt` son **huérfanas de hora**: se colocan a mano en la fase 3 (sección 6.1).

Se cruzan las fotos de **los dos autores** (motercode y fernando gost). Las fotos sin autor (por
ejemplo, las de álbumes de Google Fotos, #7) se tratan como de **motercode**.

### 2.2 Tracks

Están en `../tracks/` (hermano del repositorio, **fuera de git**). Lo que hay a 2026-11-14:

| Origen | Formato | Notas |
|---|---|---|
| `kml.kml` (170 MB) | KML, ~1 050 000 `Placemark` | Historial de ubicaciones: un punto por `Placemark`, hora y precisión en `<description>` (`2017-03-16 13:51:04 (Accuracy: 24)`). Hay que leerlo en streaming. |
| `shape.gpkg` (140 MB) | GeoPackage (SQLite) | Probablemente lo mismo que `kml.kml`; comprobarlo al leerlo y quitar los duplicados. |
| `takeout-*.zip` | JSON del Takeout | `Semantic Location History/<año>/<año>_<MES>.json`: visitas a sitios y trayectos con sus horas. |
| `datos/`, `ARCHIVO/` | ~1100 GPX, ~490 KML, ~290 KMZ | Copias de carpetas antiguas; `indice.csv` (`sha1,origen,copia_en_Tracks,estado`) ya marca 1459 ficheros como `duplicado`. Algunos son **rutas planificadas sin horas** («Cómo llegar a…»). |

Ruido que hay que ignorar: `josm.jnlp`, `*.desktop`, `*.qgz`, `DumpStack.log.tmp`, `temp_analysis_v2.js`.

## 3. Privacidad (regla 2 de `AGENTS.md`)

- Los tracks son **historial de ubicaciones privado**. No entran en git, no se copian dentro del
  repositorio y no se publican. Los ficheros intermedios de la herramienta van en
  `../tracks/procesado/`, también fuera del repositorio.
- Lo único que se publica es la coordenada final de fotos que **ya son públicas**, en el campo
  `trackMatch` de `data/admin/posiciones.json` (sección 7). `trackMatch` no lleva puntos del track ni nada que permita
  reconstruirlo.
- Impedir que entren ficheros de tracks en el repositorio (`*.gpx`, `*.kml`, `*.kmz`, `*.gpkg`)
  con una comprobación en `scripts/comprobar.sh`: pendiente de pensar en #25.
- Al cerrar la fase 2, apuntar en «Decisiones del proyecto» del README que las posiciones
  deducidas salen de tracks privados que no se publican.

## 4. Fase 1: preparar los tracks

Comando: `npm run tracks:preparar -- [--origen ../tracks]`.

1. **Descomprimir** zip y kmz en `../tracks/procesado/extraido/`, conservando la ruta de origen.
2. **Leer** GPX (`<trkpt>` con `<time>`), KML/KMZ (`<when>`, `<gx:Track>` o la hora en
   `<description>` como en `kml.kml`), GPKG (tabla de puntos con hora) y el JSON del Takeout
   (`activitySegment` con `waypointPath`/`simplifiedRawPath` y `placeVisit` con `location` y
   `duration`).
3. **Tracks sin horas** (rutas planificadas, «Cómo llegar a…»): **se incluyen**, con una hora
   inicial propuesta (sección 4.1).
4. **Quitar duplicados**:
   - de ficheros, por SHA-1 (aprovechar `indice.csv`);
   - de puntos, por hora al segundo + lat/lng redondeadas a 5 decimales (~1 m).
5. **Ordenar** por hora.
6. **Simplificar**: entre dos puntos que se conservan tiene que haber **al menos 5 minutos**. Se
   recorre cada track en orden y se borra todo punto a menos de 5 minutos del último conservado.
   El primer y el último punto de cada trozo (paso 7) se conservan siempre.
7. **Partir en trozos de 4 horas**: cada track es un trozo de 4 h, alineado a las horas UTC
   múltiplo de 4 (00, 04, 08, 12, 16, 20) para que el id no cambie entre ejecuciones:
   `<origen>_<YYYYMMDD>-<HH>` (p. ej. `kml_20170316-12`). Es la unidad a la que se aplican los
   ajustes de la fase 2.
8. **Guardar** en `../tracks/procesado/puntos.sqlite` (con `node:sqlite`, sin dependencias
   nativas). Cada punto es `{ t, lat, lng, precisión?, track }`, con `t` en UTC.
9. **Informe** en `../tracks/procesado/informe.md`: ficheros leídos y descartados (y por qué),
   duplicados, puntos antes y después de simplificar, trozos por año y tracks con hora asignada.

Zonas horarias al leer: GPX y Takeout vienen en UTC (`Z` u offset explícito). Las horas de
`kml.kml` no llevan zona y **son UTC** (confirmado).

### 4.1 Tracks sin horas

- La herramienta **propone una hora inicial**: la de la foto con hora más antigua que esté a
  menos de 200 m del primer punto de la ruta. Si no hay ninguna, el track queda **sin hora** y no
  se usa en el cruce hasta que se le asigne una a mano (fase 3).
- Las horas de los demás puntos se reparten por distancia recorrida a velocidad constante de
  30 km/h desde la hora inicial. Después se simplifica y se parte como cualquier otro track.
- En `ajustes.json` el track queda marcado con `horaAsignada: true`. La hora inicial se corrige
  igual que el desfase de cualquier track (sección 5.4).

### Criterios de aceptación (fase 1)

- Leer dos veces los mismos ficheros da el mismo número de puntos (los duplicados no suman).
- Tras simplificar, no hay dos puntos seguidos de un mismo trozo a menos de 5 minutos.
- Un track de 09:00 a 17:30 UTC sale en tres trozos: `-08`, `-12` y `-16`.
- Un GPX sin `<time>` con una foto cerca de su inicio recibe la hora de esa foto; sin foto cerca,
  sale en el informe como sin hora.
- Tests unitarios de cada lector con ficheros ficticios pequeños en `tools/tracks/fixtures/`.

## 5. Fase 2: cruce automático

Comando: `npm run tracks:cruzar`.

### 5.1 Hora de la foto

`takenAt` es hora local sin zona. Para cruzarla con el track (UTC):

`horaUTC = takenAt interpretado en la zona del track − timeOffsetSeconds del track`

- **`timeZone` del track:** zona IANA (`Europe/Madrid` por defecto). Es la zona en que estaba la
  cámara.
- **`timeOffsetSeconds` del track:** corrección del tiempo inicial del track (el reloj del GPS iba
  adelantado o atrasado).
- Ambos se guardan por track en `../tracks/procesado/ajustes.json` y **se aplican a todo el
  track**: al cambiarlos se recalculan todas las fotos que casan con él (sección 5.4).

### 5.2 Posición deducida (P)

Interpolación lineal entre los dos puntos del track que rodean `horaUTC`. Si la hora cae fuera
de todos los tracks, la foto queda **sin match** (no se escribe `trackMatch`).

Qué hacer cuando entre esos dos puntos hay un **hueco** grande (GPS apagado, sin cobertura) está
pendiente de pensar en #24, que bloquea esta fase.

### 5.3 Fiabilidad (zona Z1)

Las fotos se procesan en orden de `horaUTC`. La foto **anterior** es la inmediatamente anterior en
ese orden, con su posición final (`trackMatch.coordinates` si ya está aceptada; si no,
`coordinates`).

- `Δt` = tiempo entre la foto anterior y esta.
- **Z1 (100 %)**: círculo centrado en la foto anterior con radio `r = 30 km/h × Δt`.
- `d` = distancia haversine de P a la foto anterior.
- **Fiabilidad**: `1` si `d ≤ r`; si no, `max(0, 1 − (d − r) / r)`.
- **≥ 0,95** → `status: "auto"`. **< 0,95** → `status: "pending"` (revisión manual).

Casos especiales, siempre `pending`:

- **Primera foto** (sin anterior): se calcula Z1 con la foto **posterior**, pero va siempre a
  revisión manual.
- **Más de 12 h** desde la foto anterior (o hasta la posterior, en la primera): no se calcula Z1;
  `reliability` se omite y P queda como propuesta.

Constantes en un único sitio: `VELOCIDAD_Z1_KMH = 30`, `UMBRAL_AUTO = 0.95`,
`MAX_DT_HORAS = 12`, `DISTANCIA_CONFIRMADA_M = 200`, y las de la fase 1:
`INTERVALO_MIN_PUNTOS_MIN = 5`, `TROZO_HORAS = 4`.

### 5.4 Ajustes que se arrastran

Al cambiar `timeZone` o `timeOffsetSeconds` de un track (desde la línea de comandos en esta fase,
desde el mapa en la fase 3):

1. Se recalculan P y la fiabilidad de **todas** las fotos de ese track.
2. Las fotos `manual` o `discarded` **no se tocan** (la decisión de una persona manda), pero se
   avisa de cuántas hay.
3. El track queda marcado como ajustado en `ajustes.json` y cada `trackMatch` guarda los ajustes
   con que se calculó.

### 5.5 Qué fotos se cruzan

Todas las que tienen hora y un track que cubre esa hora, de los dos autores (sección 2.1). Si la
foto ya tiene `coordinates` válidas y P está a **menos de 200 m** de ellas, se considera
confirmada y no se escribe `trackMatch`.

### Criterios de aceptación (fase 2)

- Tests de la fiabilidad con casos fijos: dentro de Z1 → 1; `d = 1,05 r` → 0,95 (`auto`);
  `d = 1,06 r` → 0,94 (`pending`); `d ≥ 2 r` → 0.
- Primera foto → `pending` aunque su fiabilidad con la posterior sea 1.
- `Δt` de 13 h → `pending` sin `reliability`.
- Un cambio de `timeOffsetSeconds` recalcula las `auto`/`pending` de ese track y deja las
  `manual`/`discarded`.
- Repetir el cruce sin cambios no modifica ningún fichero.
- `npm run build` usa `data/admin/posiciones.json` (sección 7.2) y pasa con y sin el fichero.

## 6. Fase 3: revisión manual en un mapa local

Es la sección **Posiciones** del panel de administración local (`npm run admin`,
[panel-admin.md](panel-admin.md)): usa su servidor, su mapa común (popup con la imagen, capas
satélite e iconográfica) y su guardado seguro (no guarda en `main`).

- **Lista** de fotos `pending` ordenadas por hora, con filtro por track.
- El **icono** de la foto aparece en P, la posición deducida. Se dibujan también el track
  alrededor de esa hora, la foto anterior y la posterior, y el círculo Z1.
- **Arrastrar** el icono al sitio correcto y **Aceptar** → `status: "manual"` con la posición
  nueva. Aceptar sin mover → `manual` con P.
- **Descartar** → `status: "discarded"`.
- **Ver la imagen** en el popup del mapa común para comprobarla.
- **Ajustes del track** (zona horaria y desfase) desde la página, con recálculo y aviso como en la
  sección 5.4.
- **Hora inicial** de los tracks sin hora (sección 4.1): aceptar la propuesta o escribir otra.
- Cada decisión se escribe al momento en `data/admin/posiciones.json`.

### 6.1 Fotos huérfanas de hora

Las fotos con solo día (`takenAt` = `"YYYY-MM-DD"`) o sin `takenAt` no entran en el cruce
automático. En el mapa hay una lista aparte de **huérfanas de hora**:

- Al elegir una, se dibujan los tracks de **ese día** (para las que no tienen `takenAt`, se elige
  el día a mano).
- El icono se puede **desplazar a lo largo del track** de ese día (con un control deslizante o
  arrastrándolo, que se pega al track) o arrastrar libremente fuera de él.
- Aceptar → `status: "manual"`, sin `reliability`, con el `track` en el que se dejó (si se dejó en
  uno). Descartar → `discarded`.

Si Leaflet no bastara (por ejemplo, para editar muchos puntos a la vez), la alternativa es JOSM o
QGIS sobre un GeoJSON exportado y reimportado. No es el plan por defecto.

### Criterios de aceptación (fase 3)

- Arrastrar, aceptar y descartar escriben lo esperado en `data/admin/posiciones.json` y la foto
  sale de la lista.
- Una huérfana de hora se puede desplazar por el track de su día y aceptar.
- Las dos capas se pueden cambiar y el popup muestra la imagen.
- E2E con Playwright sobre datos ficticios: aceptar una foto movida y descartar otra.

## 7. Salida: `trackMatch` en `data/admin/posiciones.json`

### 7.1 Formato

Un `trackMatch` por foto, en `data/admin/posiciones.json`, con el id de la foto como clave
(formato del fichero e id en [panel-admin.md](panel-admin.md), sección 2). **No** va dentro de
`data/contributions/`: así una reexportación de contribExtraction no lo borra (#31).
`coordinates` de `data/contributions/` sigue siendo la posición original.

```json
"trackMatch": {
  "coordinates": { "latitude": 46.9331, "longitude": 11.9378 },
  "status": "auto",
  "reliability": 0.97,
  "track": "2018-09-21_alpes",
  "timeOffsetSeconds": -120,
  "timeZone": "Europe/Rome",
  "reviewedAt": "2026-11-14T10:00:00Z"
}
```

| Campo | Obligatorio | Qué es |
|---|---|---|
| `coordinates` | sí | Posición final (P o la que se fijó a mano). |
| `status` | sí | `auto` (≥ 95 %), `manual` (aceptada o movida en el mapa), `discarded` (descartada) o `pending` (esperando revisión). |
| `reliability` | no | Fiabilidad calculada (0–1), aunque luego se mueva a mano. No está si `Δt` > 12 h. |
| `track` | sí, salvo huérfanas dejadas fuera de un track | Id del trozo con que se calculó (sin rutas locales). |
| `timeOffsetSeconds`, `timeZone` | sí | Ajustes del track con que se calculó, para rehacerlo si cambian. |
| `reviewedAt` | solo `manual`/`discarded` | Cuándo se decidió a mano (UTC). |

### 7.2 Cómo lo usa la web

En `src/lib/load-contributions.ts`, con la lógica común de `data/admin/` (panel-admin.md,
sección 2.3):

- `auto` o `manual` → se pinta en `trackMatch.coordinates`, **aunque `coordinates` falte o sea
  `0,0`** (así entran las fotos que hoy se descartan).
- `discarded` → no se pinta.
- `pending` o sin `trackMatch` → `coordinates`, como hoy.
- Lo valida zod. El fichero lo escribe la herramienta, así que un formato no válido hace fallar el
  build con el nombre del fichero; un id que ya no existe se ignora.
- La web **no distingue** las posiciones deducidas: se pintan igual que las demás.

## 8. Dónde va el código

- `tools/tracks/`: lectores y cruce. La revisión es la sección Posiciones de `tools/admin/`. Es
  negocio de este proyecto (no va a la plantilla, regla 6).
- `npm run tracks:preparar` y `tracks:cruzar` en `package.json`; la revisión, con `npm run admin`. TypeScript
  ejecutado con Node 22 (`--experimental-strip-types`) para no añadir dependencias.
- La lógica pura (fiabilidad, interpolación, horas) va en ficheros sin dependencias de Node ni del
  navegador, con tests unitarios de Vitest junto al código.
- Rutas por defecto: tracks en `../tracks/`, intermedios en `../tracks/procesado/`. Las dos se
  pueden cambiar con `--origen`.

## 9. Decisiones

Tomadas (2026-11-14):

1. Se cruzan las fotos de los dos autores; las fotos sin autor cuentan como de motercode.
2. Una foto con posición que el track sitúa a menos de 200 m se da por confirmada.
3. La web no distingue las posiciones deducidas.
4. La hora de `kml.kml` es UTC.
5. Los tracks se simplifican a un punto cada 5 minutos como mínimo y se parten en trozos de 4 h.
6. Los tracks sin hora se incluyen con una hora inicial propuesta.
7. Las fotos sin hora quedan como huérfanas y se colocan a mano sobre el track de su día.
8. `trackMatch` va en `data/admin/posiciones.json`, no dentro de `data/contributions/` (cambia la
   decisión anterior, para que una reexportación no lo borre, #31). La revisión es una sección del
   panel de administración local (#32).

Pendientes:

- Huecos del track: #24 (bloquea la fase 2).
- Comprobación de que no entran ficheros de tracks en el repositorio: #25.
- Al leer `shape.gpkg`, confirmar si es lo mismo que `kml.kml` (si lo es, los duplicados se quitan
  solos en el paso 4).
