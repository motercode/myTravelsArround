# AGENTS.md

Punto de entrada para agentes de IA (Claude Code, Gemini, Codex, Copilot…) y personas nuevas en
myTravelsArround: un mapa web estático con las fotos públicas de Google Maps de motercode y
fernando gost, para reconstruir los viajes.

**Lee primero:**
- [README.md](README.md): funcionalidades, uso, estructura y **decisiones del proyecto** (hacen de ADR).
- [docs/features/](docs/features/): especificación de cada feature por fases, con sus criterios de
  terminado. Una feature nueva empieza escribiendo aquí su especificación.
- [docs/agentes/plantilla/README.md](docs/agentes/plantilla/README.md): prácticas comunes de
  motercode para webs Next.js y qué vale de cada guía.

**Next.js 16 no es el que conoces.** Sus APIs y convenciones cambian entre versiones: antes de
escribir código, lee la guía de la versión instalada en `node_modules/next/dist/docs/` (tras
`npm install`) y haz caso de los avisos de obsolescencia.

## Reglas que no se pueden saltar

1. **Sitio estático.** Sin backend ni base de datos: `export const dynamic = "force-static"` en las
   páginas; lo que dependa de los datos se calcula en el build o en el navegador.
2. **Ni secretos ni datos privados en git.** `.env*` se queda fuera (lo cubre el `.gitignore`). En
   `data/contributions/` solo entran fotos **públicas** de Google Maps. Lo que lleva `NEXT_PUBLIC_`
   llega al navegador. → [privacidad-y-logs.md](docs/agentes/plantilla/privacidad-y-logs.md)
3. **Antes de cada commit y de cada PR:** `npm run lint` y `npm run build` en verde, y `npm test` y
   `npm run test:e2e` cuando estén configurados (→ [tests.md](docs/agentes/plantilla/tests.md)). Los
   tests existentes no se borran.
4. **Commits en inglés** con Conventional Commits y el issue al final:
   `feat(map): group photos into trips (#12)`. Comentarios, UI, docs, issues y títulos de PR en
   español; comentarios breves que explican el porqué.
   → [flujo-de-trabajo.md](docs/agentes/plantilla/flujo-de-trabajo.md)
5. **Dónde va cada decisión:** producto y alcance → issue y `docs/features/`; implementación → PR;
   arquitectura y proceso → «Decisiones del proyecto» del README.
6. **Lo reutilizable, separado del negocio.** Lo que serviría en cualquier web Next.js + Netlify va
   sin nada de viajes ni mapas y su guía a `docs/agentes/plantilla/`: es lo que alimenta el template
   `motercode/next-netlify-template`.

## Ciclo de un cambio

Automatizado con los scripts de `scripts/` y la skill `ciclo-de-cambio`
(→ [scripts.md](docs/agentes/plantilla/scripts.md)). Si un paso se repite, automatízalo igual.

1. Issue con el contexto y su etiqueta `prioridad: alta|media|baja` (enlaces en «Prioridades» del
   README); si es una feature, su especificación en `docs/features/<feature>.md`.
   Rama desde `main`: `tipo/issue-N-descripcion-corta` (`feat/issue-12-viajes-fase-1`).
   → `scripts/nuevo-cambio.sh`
2. Código y tests de la fase; nada de fases que no se han pedido.
3. Comprobaciones de la regla 3. → `scripts/comprobar.sh`
4. PR con la plantilla de `.github/pull_request_template.md`. → `scripts/abrir-pr.sh`
   Cada merge a `main` despliega en Netlify.

## Comandos

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:3030
npm run lint       # ESLint
npm run build      # build estático, el mismo que hace Netlify
npm test           # unitarios (Vitest), junto al código: src/**/*.test.ts
npm run test:e2e   # E2E (Playwright) en e2e/; arranca npm run dev si no está abierto
scripts/comprobar.sh   # secretos, lint, build y tests; informe en .evidencia/
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
