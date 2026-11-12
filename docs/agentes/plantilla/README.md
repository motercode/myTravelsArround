# Prácticas comunes de motercode para webs Next.js

Guías copiadas el 2026-11-12 de las plantillas de otros proyectos de motercode, para que este
proyecto haga de referente de las webs Next.js + Netlify. El esqueleto de código ya vive en el
repositorio template `motercode/next-netlify-template`; estas guías son el complemento que todavía
no tiene, y el día que maduren pasarán allí.

| Guía | Origen | Qué vale aquí | Qué hay que traducir |
|---|---|---|---|
| [flujo-de-trabajo.md](flujo-de-trabajo.md) | ConserjeCV (Android) | Ciclo issue → rama → tests → PR con evidencia → ADR; Conventional Commits en inglés con `(#issue)`; idioma por tipo de texto; criterio «plantilla o negocio» | `./gradlew …` y `scripts/e2e.sh` → `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`; KDoc → TSDoc; `docs/agentes/proyecto/` (negocio) → el README y `docs/features/` |
| [adr-base.md](adr-base.md) | ConserjeCV (Android) | ADR-0002 (dónde va cada decisión), ADR-0003 (calidad antes de cada PR), ADR-0004 (tests sobre datos ficticios), registro de decisiones operativas | ADR-0001 → Next.js + TypeScript + Tailwind + Netlify; ADR-0005 (R8), ADR-0006 (Room) y ADR-0007 (solo local) no aplican |
| [privacidad-y-logs.md](privacidad-y-logs.md) | ConserjeCV (Android) | Datos reales y secretos fuera de git (`.env*` ya está en `.gitignore`), datos ficticios para pruebas, cuidado con agentes y datos reales | `DebugLog` y R8 → nada de `console.log` con datos personales en producción; lo que lleva `NEXT_PUBLIC_` llega al navegador |
| [tests.md](tests.md) | comparaluzcv (Next.js) | Vitest para unitarios y Playwright para E2E, con configuración y reglas | El original está en JavaScript; aquí, TypeScript |
| [scripts.md](scripts.md) | Propia (2026-11-12) | Scripts `nuevo-cambio.sh`, `comprobar.sh` y `abrir-pr.sh` y la skill `ciclo-de-cambio` que automatizan el ciclo issue → rama → comprobaciones → PR | — |

No se han copiado las guías de Android de ConserjeCV (tests con Compose, capturas, adb, trampas de
Gradle, modo UIX) ni las de Flutter de Apati Paseo-Perro.
