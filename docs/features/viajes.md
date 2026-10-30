# FEATURE: viajes

Especificación para implementar la feature **viajes** en myTravelsArround. Está escrita para un
agente que no conoce el proyecto: primero el contexto, después lo que ya está hecho, lo que hay
que hacer (por fases), las reglas exactas y los criterios para dar cada fase por terminada.

Estado a 2026-10-17: solo especificación, no hay código de esta feature.

## 1. Objetivo

Agrupar las fotos del mapa en **viajes** según la fecha en que se hicieron, para poder:

1. Ver la lista de viajes y, al elegir uno, ver solo sus fotos en el mapa (**fase 1**, el primer corte).
2. Ver las fotos de un viaje una tras otra, como presentación (**fase 2**).
3. Ver un **recorrido** desde una foto concreta, limitado por tiempo o por distancia antes y después (**fase 3**).

La fase 1 es la que se va a implementar ahora. Las fases 2 y 3 se describen para que el diseño de
la fase 1 no las bloquee, pero no hay que implementarlas hasta que se pidan.

## 2. Contexto del proyecto

- Next.js 16 (App Router) + React 19 + Tailwind 4 + react-leaflet 5 (Leaflet 1.9) + zod 4. Node 22.
- Sitio **estático** desplegado en Netlify (`export const dynamic = "force-static"` en `src/app/page.tsx`).
  No hay backend ni base de datos. Todo lo que dependa de los datos se calcula en el build o en el navegador.
- `npm run dev` (puerto 3030), `npm run build`, `npm run lint`. No hay tests configurados.
- Comentarios y textos de la interfaz en **español**. Mantener el estilo: comentarios breves que explican el porqué.

Ficheros relevantes:

| Fichero | Qué hace |
|---|---|
| `data/contributions/*.json` | Fotos exportadas por `../contribExtraction`, un fichero por autor/extracción. |
| `src/lib/load-contributions.ts` | Lee los JSON en el build, los valida con zod, descarta coordenadas inválidas y quita duplicados por `photoId`. |
| `src/lib/contributions.ts` | Tipo `Contribution`, `AUTHORS` (userId -> nombre), utilidades de URL (`stableThumbnailUrl`, `photoIdFromUrl`). Compartido cliente/servidor. |
| `src/app/page.tsx` | Página única: `<MapView contributions={loadContributions()} />`. |
| `src/components/map/map-view.tsx` | Cliente. Barra superior: buscador Nominatim y filtro por autor (`hidden: Set<string>`, `visible`). |
| `src/components/map/travel-map.tsx` | Cliente (sin SSR). Mapa Leaflet, un `CircleMarker` por foto, `Tooltip` con miniatura; el clic abre `mapsUrl` en otra pestaña. |

## 3. Lo que ya está hecho: la fecha de cada foto (`takenAt`)

**Esta parte está terminada y no hay que tocarla.** La hace el proyecto hermano `../contribExtraction`, aparte de myTravelsArround:

- `node scripts/export-harvest.js <userId> [salida.json] --dates` lee el EXIF del original de cada
  foto (o, si no tiene, el día que trae la galería de Google) y lo guarda en
  `contribExtraction/harvest/<userId>.dates.json`. Lógica en `contribExtraction/lib/taken-at.js`.
- Al exportar, mete en cada item del JSON dos campos **opcionales**:
  - `takenAt`: `"YYYY-MM-DDTHH:mm:ss"` (EXIF, hora local de la cámara, **sin zona horaria**) o
    `"YYYY-MM-DD"` (solo día).
  - `takenAtSource`: `"exif"` o `"photometa"`.
- Si una foto no tiene fecha, esos campos **no aparecen** (nunca se exporta `null`).

Ejemplo de item exportado:

```json
{
  "index": 1,
  "url": "https://www.google.com/maps/contrib/<userId>/photos/@lat,lng,.../data=...!1s<photoId>!...",
  "mapsUrlCanonical": "https://www.google.com/maps/@lat,lng,.../data=...",
  "imageUrl": "https://lh3.googleusercontent.com/gps-cs/...=w400-h240-p-k-no",
  "coordinates": { "latitude": 41.573308, "longitude": 1.782256 },
  "capturedAt": "2026-10-16T17:44:22.226Z",
  "takenAt": "2020-09-30T07:05:27",
  "takenAtSource": "exif"
}
```

Cuidado: **`capturedAt` NO es la fecha de la foto**, es cuándo se extrajo. No usarlo para los viajes.

Lo que falta en myTravelsArround (parte de la fase 1):

- Los JSON de `data/contributions/` actuales se exportaron antes de esto y **no tienen `takenAt`**.
  El usuario los volverá a exportar con `--dates` y los copiará; el código tiene que funcionar
  igual con ficheros que tengan `takenAt` y con ficheros que no.
- `load-contributions.ts` y el tipo `Contribution` todavía no leen `takenAt`.

## 4. Fase 1: agrupar en viajes (primer corte)

### 4.1 Reglas

1. **Unidad: el día.** El día de una foto son los 10 primeros caracteres de `takenAt`
   (`takenAt.slice(0, 10)`). **No** convertir con `new Date()`: la hora EXIF no tiene zona
   horaria y la conversión puede mover la foto al día anterior o al siguiente. Las fechas
   `"YYYY-MM-DD"` (solo día, `photometa`) valen igual para agrupar por día.
2. **Viaje = días con fotos seguidos o casi seguidos.** Se ordenan los días distintos con fotos.
   Dos días consecutivos de esa lista están en el mismo viaje si entre ellos hay **2 días o menos
   sin fotos**. Si hay **más de 2 días sin fotos**, empieza un viaje nuevo.
   - Días vacíos entre A y B = `diferenciaEnDías(B, A) - 1`.
   - 1 oct y 3 oct: 1 día vacío, mismo viaje. 1 oct y 4 oct: 2 vacíos, mismo viaje.
     1 oct y 5 oct: 3 vacíos, **viaje nuevo**.
   - Calcular la diferencia en días con fechas UTC (`Date.UTC(y, m - 1, d)`) para evitar el
     cambio de hora.
   - El umbral va en una constante: `MAX_EMPTY_DAYS_IN_TRIP = 2`.
3. **Un día aislado también es un viaje** (de 1 día).
4. **Fotos sin `takenAt`: no entran en ningún viaje.** Siguen viéndose en el mapa normal.
5. **Autores: por defecto, viajes por autor.** Los viajes se calculan por separado para cada
   autor (motercode y fernando gost son personas distintas). Que sea fácil cambiarlo si el
   usuario prefiere mezclar autores: decisión pendiente, ver sección 7.
6. **Orden dentro del viaje:** por `takenAt` ascendente. Si dos fotos tienen el mismo valor (o
   una solo tiene día), desempatar por `id` para que el orden sea estable entre builds.

### 4.2 Datos

Ampliar `Contribution` en `src/lib/contributions.ts`:

```ts
export type Contribution = {
  // ...campos actuales
  takenAt?: string;            // tal cual viene del export
  takenAtSource?: "exif" | "photometa";
};
```

Tipo nuevo (en `src/lib/trips.ts`):

```ts
export type Trip = {
  id: string;             // estable entre builds, p. ej. `${authorSlug}-${startDay}`
  author: string;
  startDay: string;       // "YYYY-MM-DD"
  endDay: string;         // "YYYY-MM-DD"
  days: string[];         // solo los días que tienen fotos, ordenados
  photoIds: string[];     // Contribution.id, en orden cronológico (regla 6)
};
```

### 4.3 Implementación propuesta

1. `load-contributions.ts`: añadir al esquema zod `takenAt: z.string().optional()` y
   `takenAtSource: z.enum(["exif", "photometa"]).optional()`, y copiarlos a `Contribution`.
   Validar el formato de `takenAt` (`/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/`). Si un valor
   no lo cumple, **ignorar ese campo** (la foto queda sin fecha) en vez de romper el build.
   Al quitar duplicados, si una copia tiene `takenAt` y la otra no, quedarse con la que lo tiene.
2. `src/lib/trips.ts` (nuevo, función pura, sin dependencias de Node ni del navegador):
   `buildTrips(contributions: Contribution[]): Trip[]`, siguiendo las reglas de 4.1. Viajes
   ordenados por `startDay` descendente (lo más reciente primero).
3. `page.tsx`: calcular los viajes en el build y pasarlos a `MapView`
   (`<MapView contributions={...} trips={buildTrips(...)} />`). Pasa a ser un prop más de un
   componente estático; no hace falta calcular nada en cliente.
4. Interfaz (`map-view.tsx`):
   - Control **"Viajes"** en la barra superior, junto al filtro de autor, que abre una lista.
     Cada viaje muestra: fechas (`"29–30 sep 2020"`; si es de un día, solo ese día), número de
     días con fotos, número de fotos y autor. Fechas con `Intl.DateTimeFormat("es-ES")`,
     formateando a partir de `startDay`/`endDay` como fechas UTC para que no cambie el día.
   - Al elegir un viaje: el mapa muestra **solo sus fotos** y se encuadra con `fitBounds` sobre
     ellas (mismo padding y `maxZoom` que el encuadre inicial de `travel-map.tsx`).
   - Una opción **"Todas las fotos"** quita el filtro.
   - El filtro de autor sigue funcionando. Si el autor del viaje elegido se oculta, se quita la
     selección de viaje.
   - Si no hay ningún viaje (datos sin `takenAt`), el control no se muestra o sale desactivado
     con el texto "Sin fechas de fotos".
   - Tiene que verse bien en móvil, como el resto de la barra.
5. `travel-map.tsx`: opcional en esta fase. Si hay un viaje seleccionado, unir sus fotos en orden
   con una `Polyline` fina. Prepara la fase 2 y ayuda a ver la ruta.
6. Documentación: añadir "Viajes" a la lista de funcionalidades de `README.md` y explicar que
   hay que exportar con `--dates` para que salgan.

### 4.4 Criterios de aceptación (fase 1)

- `npm run build` y `npm run lint` pasan, con los JSON actuales (sin `takenAt`) y con JSON
  que sí lo tengan.
- Con fechas `2020-09-29, 2020-09-30, 2020-10-02, 2020-10-06` de un mismo autor salen 2 viajes:
  `29 sep–2 oct` (3 días con fotos) y `6 oct` (1 día).
- Una foto `"2020-09-30T23:59:59"` cuenta en el día 30, sea cual sea la zona horaria del equipo
  donde se hace el build.
- Las fotos sin `takenAt` no aparecen en ningún viaje y siguen en el mapa con "Todas las fotos".
- Los `Trip.id` no cambian entre dos builds con los mismos datos.
- Elegir un viaje filtra el mapa y lo encuadra. "Todas las fotos" vuelve al estado inicial.

Para comprobar `buildTrips` sin infraestructura de tests: un script temporal con estos casos
(o añadir `vitest` si el usuario lo aprueba; ahora no hay framework de tests).

## 5. Fase 2: ver las fotos de un viaje una tras otra (no implementar todavía)

- **Visor propio a pantalla completa**: imagen grande, anterior/siguiente, play/pausa, velocidad,
  contador `n / total`, fecha y hora, y enlace "Abrir en Google Maps" (`mapsUrl`). Teclado:
  ←/→, espacio y Esc.
- **No usar un iframe de Google Maps**: `google.com/maps` no se deja meter en iframes de otras
  webs. Tampoco hace falta una extensión de Chrome. Se usa directamente `imageUrl` (lh3.googleusercontent.com)
  con un tamaño mayor: cambiar el sufijo tras `=` por `=w1600-h1000-k-no`, igual que hace
  `stableThumbnailUrl`. **No** pedir encuadres de panorama (`-pi…-ya…-ro…-fo…`): Google responde
  429 y el navegador bloquea la imagen (ver el comentario de `stableThumbnailUrl`).
  Precargar la siguiente imagen.
- Mientras se reproduce: resaltar en el mapa el punto de la foto actual y moverlo para que se vea.
- Opcional: muchas fotos son esferas 360° (la URL trae `!7i6080!8i3040`, proporción 2:1). Se
  podrían ver navegables con Photo Sphere Viewer o Pannellum. Antes hay que comprobar que lh3
  manda cabeceras CORS que lo permitan; si no, se ven planas.

## 6. Fase 3: recorrido desde una foto (no implementar todavía)

- **Interacción:** el clic en un punto deja de abrir Google Maps directamente. Abre un `Popup`
  con "Abrir en Google Maps" y "Ver recorrido". El tooltip al pasar el ratón no sirve para
  botones, y en móvil no existe.
- **Por tiempo:** el usuario indica minutos antes y minutos después. Se toman las fotos del mismo
  autor ordenadas por `takenAt` dentro de [t − antes, t + después] y se pasan al visor de la
  fase 2. Solo fotos con hora (`exif`); las de solo día no sirven aquí.
- **Por distancia:** se mide la **distancia recorrida a lo largo de la ruta**, no un radio. Desde
  la foto elegida se avanza hacia atrás y hacia delante en el orden cronológico, sumando la
  distancia haversine entre fotos seguidas, hasta llegar a los km pedidos. No se sale del viaje
  (fase 1) de la foto.
  - Se descartó lo de un círculo alrededor de la foto + vectores para decidir anterior/posterior:
    un conjunto de puntos dentro de un círculo no tiene orden, y el círculo mezcla visitas al
    mismo sitio en viajes distintos.
  - Plan B, solo para fotos sin fecha: círculo de radio R y orden por vecino más cercano
    empezando por la foto elegida.
- Atajos que salen gratis con la fase 1: "Ver este viaje" y "Ver este día".
- Con unas 2.000 fotos todo se calcula en el navegador al momento; no hace falta backend.

## 7. Decisiones pendientes (preguntar al usuario si afectan)

1. ¿Viajes por autor (por defecto) o mezclando autores?
2. ¿Dónde va la lista de viajes: un desplegable en la barra (propuesta) o un panel lateral?
3. ¿Hace falta un nombre para cada viaje (por ejemplo, la ciudad más frecuente con Nominatim
   inverso)? Por defecto, no: se identifica por las fechas.
4. Umbral `MAX_EMPTY_DAYS_IN_TRIP`: 2 por ahora. Confirmar si se quiere configurable desde la interfaz.
