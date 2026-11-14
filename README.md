# myTravelsArround

Mapa web con las fotos públicas que **motercode** y **fernando gost** han subido a Google Maps.
Cada foto es un punto azul sobre OpenStreetMap; al pulsarlo se abre esa foto en Google Maps en una pestaña nueva.

Se despliega en Netlify como sitio estático generado con Next.js: https://mytravelsarround.netlify.app/

## Funcionalidades

- Mapa de OpenStreetMap a pantalla completa (moverse, zoom), que arranca encuadrado sobre las fotos.
- Un punto azul por foto. Al pasar el ratón se ve la miniatura y el autor; al hacer clic se abre la foto en Google Maps (o en su álbum de Google Fotos).
- Buscador de lugares y POI (Nominatim): al elegir un resultado, el mapa vuela hasta allí.
- Filtro por autor, con el número de fotos de cada uno.
- Diseño adaptado a móvil.

## Uso

Requisitos: Node.js 22 (el mismo que usa Netlify).

```bash
npm install
npm run dev        # http://localhost:3030
npm run build      # build de producción (lee los datos)
npm run lint
npm test           # tests unitarios (Vitest)
npm run test:e2e   # tests E2E (Playwright; la primera vez: npx playwright install chromium)
npm run admin      # panel de administración local en http://localhost:3040 (Node 22.18 o posterior)
```

### Administrar los datos

`npm run admin` abre un panel local para corregir a mano lo que la exportación no sabe, como el
autor de fotos concretas. Lo que se cambia se guarda en `data/admin/` y solo llega a la web con
commit, PR y merge: el panel no guarda si estás en `main`. Una tanda de cambios va en un solo
issue y un solo PR. Detalle en [docs/features/panel-admin.md](docs/features/panel-admin.md).

Para contribuir, empieza por [AGENTS.md](AGENTS.md): reglas, ciclo de un cambio y los scripts que lo
automatizan (`scripts/nuevo-cambio.sh`, `scripts/comprobar.sh`, `scripts/abrir-pr.sh`).

### Añadir o actualizar fotos

1. Extrae las contribuciones con [`contribExtraction`](../contribExtraction) (extensión de Chrome + backend local), que genera `contribuciones.json`.
2. Copia el fichero a `data/contributions/` con un nombre descriptivo, por ejemplo `motercode.json` o `fernando-gost.json`. Puede haber tantos ficheros como extracciones.
3. Ejecuta `npm run datos:origen`: cuenta por fichero cuántas fotos vienen de Maps, de álbumes de Google Fotos o de otro sitio, y falla si hay alguna de otro sitio.
4. Ejecuta `npm run build` (o haz push y Netlify lo construye).

Al construir:

- Se leen todos los `.json` de `data/contributions/` y se valida su formato. Si un fichero no tiene el formato esperado, el build falla y el error dice cuál es.
- El autor se deduce del `userId` de la URL (`/maps/contrib/<userId>/`). Los nombres se configuran en `AUTHORS`, en `src/lib/contributions.ts`. Las fotos de álbumes de Google Fotos (`photos.google.com/share/…`), cuya URL no lleva autor, cuentan como de motercode.
- Las fotos repetidas entre ficheros se eliminan según el identificador de la foto: `!1s…` en las URLs de Maps y `/photo/<id>` en las de álbum.
- Se descartan los items sin coordenadas o con `0,0`.
- Se aplica encima lo administrado en `data/admin/` (por ahora, `autores.json`: el autor de fotos concretas). Si un fichero de `data/admin/` no tiene el formato esperado, el build falla.

Formato esperado (el que genera `contribExtraction`):

```json
{
  "total": 50,
  "items": [
    {
      "index": 1,
      "url": "https://www.google.com/maps/contrib/<userId>/photos/@lat,lng,.../data=!3m7!1e1!3m5!1s<photoId>!...",
      "mapsUrlCanonical": "https://www.google.com/maps/@lat,lng,.../data=...",
      "imageUrl": "https://lh3.googleusercontent.com/...",
      "coordinates": { "latitude": 42.8873386, "longitude": -5.7995912 },
      "capturedAt": "2026-10-16T12:21:00.775Z"
    }
  ]
}
```

Al hacer clic se abre `mapsUrlCanonical` (el visor general de Maps). Si no existe, se usa `url`, que en las fotos de álbum es la foto dentro del álbum compartido.

## Despliegue en Netlify

Toda la configuración está en `netlify.toml`: el build ejecuta `npm run build`, publica `.next` y usa Node 22 con el adaptador `@netlify/plugin-nextjs`.
Basta con importar el repositorio `motercode/myTravelsArround` desde GitHub en Netlify; cada push a `main` vuelve a desplegar en https://mytravelsarround.netlify.app/.

No hace falta configurar variables de entorno ni claves de API.

## Estructura

```text
data/contributions/          JSON exportados por contribExtraction (uno por extracción)
src/app/page.tsx             Página principal (estática; carga los datos en el build)
src/app/layout.tsx           Layout, metadatos y fuentes
src/components/map/
  map-view.tsx               Panel: buscador, filtros por autor y contador
  travel-map.tsx             Mapa Leaflet con los puntos (solo en cliente)
src/components/ui/           Componentes shadcn/ui
src/lib/contributions.ts     Tipos, autores y utilidades para las URLs de Maps
src/lib/load-contributions.ts  Lectura, validación y deduplicado de los datos
src/lib/*.test.ts            Tests unitarios (fixtures ficticios en src/lib/__fixtures__/)
e2e/                         Tests E2E de Playwright
scripts/                     Automatización del ciclo issue → rama → comprobaciones → PR
docs/features/               Especificación de cada feature por fases
docs/agentes/plantilla/      Guías comunes para webs Next.js (alimentan next-netlify-template)
AGENTS.md                    Punto de entrada para agentes y personas nuevas
netlify.toml                 Configuración de build y despliegue
```

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** + **shadcn/ui** (estilo new-york, tema oscuro)
- **Leaflet** + **react-leaflet** con teselas de **OpenStreetMap**
- **Nominatim** para la búsqueda de lugares
- **zod** para validar los datos
- **Netlify** para el despliegue

## Decisiones del proyecto

### Base: Next.js + Netlify

Se ha partido de la configuración de `automata-teatral-editor` (Next.js, Tailwind 4, shadcn/ui, alias `@/*`), con estos cambios:

- **npm en lugar de bun.**
- **Fuera Prisma, autenticación y el resto de dependencias que aquí no se usan.**
- **Sin `output: "standalone"`**, porque Netlify usa su propio adaptador para Next.js.
- **Sin `ignoreBuildErrors`**: los errores de TypeScript paran el build.

### Mapa: OpenStreetMap en lugar de Google Maps

Se usan Leaflet y las teselas de OpenStreetMap, que no necesitan clave de API ni facturación. Google Maps solo es el destino al pulsar cada foto.
Se mantiene la atribución a OpenStreetMap que exige su política de uso.

### Búsqueda: Nominatim, solo al enviar

Nominatim es el buscador de OpenStreetMap y es gratuito, pero su política limita el uso a una petición por segundo y no permite autocompletado.
Por eso solo se busca al pulsar Enter o el botón, nunca mientras se escribe.

### Origen de los datos: extractor propio, no API ni Takeout

- **No hay API oficial.** Google no ofrece ninguna que devuelva todas las fotos de un perfil de contribuidor. La de Places solo da unas pocas fotos por lugar.
- **Takeout no sirve.** El de "Maps (Tus sitios)" solo exporta `Reseñas.json` y `Sitios guardados.json`, con enlaces a lugares y no a fotos.
- **La imagen sola no dice dónde está.** De la URL de la imagen (`lh3.googleusercontent.com/...`) no se pueden sacar las coordenadas: los parámetros `pi`, `ya`, `ro` y `fo` son la orientación de la cámara (inclinación, rumbo, giro y campo de visión), no la posición.
- **Las coordenadas están en la URL de cada foto en Maps** (`/@lat,lng,...`), y ahí es donde se obtienen.

- **También álbumes de Google Fotos compartidos públicamente.** `contribExtraction` los exporta con `source: "googlePhotosAlbum"`. Su URL no dice el autor, así que se asignan a motercode (#7); se compartieron públicamente a propósito, así que cumplen la regla 2.

Por eso existe `contribExtraction`. Recorre el perfil público en un navegador Chrome real con una extensión, porque Google bloquea los navegadores automatizados como Playwright, y guarda por cada foto su URL, coordenadas e imagen.

### Datos en `data/contributions/`, leídos en el build

- **Página estática.** Los datos se cargan al construir la web, así que la página sale estática, sin backend ni llamadas en tiempo de ejecución. Es lo más sencillo y barato para Netlify.
- **Un fichero por extracción.** Así se pueden ir añadiendo extracciones de cada usuario sin tener que fusionarlas a mano; el deduplicado evita fotos repetidas.
- **Por qué no `public/`.** Ahí se publicaría el JSON en bruto, y para el mapa solo hacen falta unos pocos campos por foto.
- **Validación con zod.** Si cambia el formato del extractor, el build falla con un error claro en lugar de dibujar un mapa vacío.

### Administración solo en local, en `data/admin/`

- **Sin administración remota.** Lo que se decide a mano (autor de fotos concretas, nombres de viaje, ajustes, posiciones deducidas de los tracks) se edita con un panel local (`npm run admin`, en `localhost`) que no forma parte del build. Nada de lo publicado se puede cambiar desde internet ni por descuido: un cambio solo llega a la web por commit, PR y merge, y el panel se niega a guardar en `main`.
- **Aparte de `data/contributions/`.** Lo administrado va en `data/admin/`, y el build lo aplica encima de lo exportado. Así una reexportación de `contribExtraction` no borra nada de lo decidido a mano.
- Detalle en [docs/features/panel-admin.md](docs/features/panel-admin.md) (#32).

### Proceso: issues, prioridades y PR con evidencia

- Cada cambio sale de un issue y llega por PR con la plantilla de `.github/pull_request_template.md`
  y la salida de `scripts/comprobar.sh` como evidencia (detalle en [AGENTS.md](AGENTS.md)).
- Las prioridades se marcan solo con las etiquetas `prioridad: alta`, `prioridad: media` y
  `prioridad: baja`. El README enlaza a los issues filtrados por etiqueta en lugar de copiar la
  lista, que se desfasaba con cada issue cerrado o reetiquetado (#15).
- Tests unitarios con Vitest sobre datos ficticios y E2E con Playwright contra `npm run dev` en
  `localhost` (con `127.0.0.1`, Next.js 16 no hidrata la página en desarrollo).

### Puntos sin agrupar, dibujados en canvas

Los puntos se dibujan en canvas (`preferCanvas`), que aguanta varios miles sin problema y deja ver la densidad real de fotos.
Si el mapa se satura, se puede añadir agrupación de marcadores.

## Prioridades

Las prioridades viven en las etiquetas de los issues de GitHub; aquí solo se enlazan para que no se
desfasen:

- [Prioridad alta](https://github.com/motercode/myTravelsArround/issues?q=is%3Aissue+is%3Aopen+label%3A%22prioridad%3A+alta%22)
- [Prioridad media](https://github.com/motercode/myTravelsArround/issues?q=is%3Aissue+is%3Aopen+label%3A%22prioridad%3A+media%22)
- [Prioridad baja](https://github.com/motercode/myTravelsArround/issues?q=is%3Aissue+is%3Aopen+label%3A%22prioridad%3A+baja%22)
