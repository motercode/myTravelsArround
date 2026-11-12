# Flujo de trabajo: issues, ramas, commits, PR y ADR

## Ciclo de un cambio

1. **Issue** con el contexto y la decisión (o reutiliza una). Las prioridades y las etiquetas de
   versión se mantienen en el README del proyecto.
2. **Rama** desde `main`: `tipo/issue-N-descripcion-corta` (descripción en el idioma de las docs).
   Ejemplos: `feat/issue-12-busqueda-clientes`, `fix/issue-31-fecha-duplicada`,
   `chore/issue-8-release-sin-logs`. Sin issue: `docs/guias-agentes`.
3. **Implementa + tests**: unitarios donde haya lógica; E2E para el alcance de UI.
4. **Comprueba**: `./gradlew testDebugUnitTest lintDebug` y `scripts/e2e.sh <serial>` con la suite
   completa en verde.
5. **PR** con la plantilla: cambios, checklist de tests y evidencia E2E (el informe que genera `e2e.sh`).
6. **ADR** si la decisión afecta a la arquitectura o al proceso; además, una línea en el
   "Registro de decisiones operativas" del ADR con fecha y número de issue.
7. Si cambia una regla funcional, actualiza el README.

## Commits

- **Conventional Commits en inglés**, con ámbito y número de issue al final:
  ```
  feat(search): filter customers by name and phone (#12)
  fix(orders): stop creating a duplicate order on double tap (#31)
  test(e2e): run instrumented tests on isolated deterministic seed data
  chore(release): no logs in release and enable R8
  ```
- Tipos: `feat`, `fix`, `test`, `docs`, `chore` (y `refactor` si hace falta). El ámbito es el área
  funcional (`search`, `orders`, `ui`, `e2e`, `release`…).
- Cuerpo en prosa: qué fallaba o faltaba y por qué esta solución. `Refs #N` si el issue no se cierra
  todavía.
- Los commits hechos con un agente de IA terminan con su línea `Co-Authored-By:`.

## Pull requests

- Título en el idioma de las docs con el mismo prefijo que el commit:
  `fix(orders): no se crea un pedido duplicado al pulsar dos veces (#31)`.
- Un PR por issue cuando sea posible.
- Los E2E se acumulan: un PR **no borra** E2E existentes.

### Plantilla de PR

`.github/pull_request_template.md`:
```markdown
## Cambios

## Tests
- [ ] E2E creados o actualizados para el alcance del cambio (no se borran los existentes).
- [ ] `./gradlew testDebugUnitTest lintDebug` sin errores.
- [ ] `scripts/e2e.sh <serial-adb>` en dispositivo: suite completa en verde y datos reales sin cambios.

## Plantilla
- [ ] Lo nuevo que sirve en otra app está separado del negocio (ver `docs/agentes/plantilla/flujo-de-trabajo.md`).

## Evidencia E2E
<!-- Pega aquí el contenido de app/build/e2e/e2e-report.md -->
```
En un PR solo de documentación, marca los puntos de tests como "no aplica".

## ADR

- Un único `ADR.md` en la raíz. Entradas `## ADR-NNNN: título`, con Fecha, Estado, Contexto, Decisión
  y Consecuencias; numeración correlativa.
- Al final, "Registro de decisiones operativas": lista cronológica de una línea por decisión menor.
- Dónde va cada cosa: producto y alcance → issue; implementación → PR; arquitectura y proceso → ADR.
- Arranca con [adr-base.md](adr-base.md).

## Idioma

Decide al empezar y escríbelo en `AGENTS.md`. La convención de la plantilla:

| Qué | Idioma |
|---|---|
| Identificadores, nombres de tests, mensajes de commit | inglés |
| Comentarios, KDoc, textos de la UI, docs, issues, títulos de PR, ADR, mensajes de log | idioma del equipo |

## Estilo de código

- KDoc breve en clases y funciones no evidentes, explicando el **porqué**, a menudo con el número de
  issue ("#31: …").
- La lógica pura va en `object` o clases sin Android, testeables en la JVM, separada del acceso a
  Room y de la UI.
- Nombres de tests en `snake_case` que describen el comportamiento:
  `a_customer_without_phone_is_imported_but_flagged_for_review`.
- Antes de commit: `git status` y comprobar que no entra ningún dato real.

## Plantilla o negocio

Todo lo nuevo se clasifica antes de escribirlo. Pregunta: **¿funcionaría copiándolo a otra app
Android cambiando solo la configuración?**

- **Sí → plantilla.** Sin nombres, paquetes, textos ni datos del proyecto. Lo propio del proyecto
  entra como configuración: variables en `scripts/proyecto.env`, valores leídos de Gradle,
  parámetros o constantes que se inyectan. Su guía va a `docs/agentes/plantilla/` y se apunta en el
  inventario de `plantilla/README.md`.
- **No → negocio.** Código de la app y guía en `docs/agentes/proyecto/`.
- **Mezclado →** se separa en el mismo PR: el mecanismo genérico por un lado y los datos o reglas
  del proyecto por otro (ejemplo: `SeedData` es del proyecto, pero el patrón runner + regla de
  semilla + datos compartidos en `sharedTest` es de plantilla).

| Tipo de pieza | Plantilla | Negocio |
|---|---|---|
| Scripts | `scripts/*.sh`, `scripts/lib/`, `scripts/ui-compare.py` | `scripts/contactos/` |
| Configuración | — | `scripts/proyecto.env` |
| Infraestructura de la app | `DebugLog`, `AppStorage`, reglas R8 | dominio, repositorios, UI |
| Tests | runner, regla de semilla, capturas, helpers de Compose Test | datos de la semilla, tests de funcionalidades |
| Documentación | `docs/agentes/plantilla/` | `docs/agentes/proyecto/`, `docs/*.md` |

En la revisión del PR se comprueba con la casilla correspondiente de la plantilla de PR.

## Herramientas

- `gh` para issues, etiquetas y PR.
- Permisos de Claude Code por proyecto en `.claude/settings.local.json` (p. ej. permitir `gh issue`,
  `gh label` y `adb` sin preguntar). `.claude/settings.local.json` no se versiona; las skills de
  `.claude/skills/` sí, porque automatizan el ciclo para todo el equipo.
