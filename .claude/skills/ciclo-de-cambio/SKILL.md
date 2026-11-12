---
name: ciclo-de-cambio
description: Lleva un cambio de principio a fin según AGENTS.md — issue, rama tipo/issue-N-descripcion, comprobaciones (secretos, lint, build, tests) y PR con la plantilla rellenada y la evidencia. Úsala al empezar una feature, fix o cambio de docs, al preparar un commit o al abrir un PR.
---

# Ciclo de un cambio

Sigue las reglas de [AGENTS.md](../../../AGENTS.md); esta skill solo automatiza los pasos con los
scripts de `scripts/`. Lee [docs/agentes/plantilla/scripts.md](../../../docs/agentes/plantilla/scripts.md)
si un script falla o necesitas sus opciones.

## 1. Empezar

- Si hay issue: `scripts/nuevo-cambio.sh -t <tipo> -s <descripcion-corta> -i <N> [-p <prioridad>]`.
- Si no: redacta el cuerpo del issue en español (contexto, alcance, fuera de alcance) en un fichero
  temporal del scratchpad y ejecuta
  `scripts/nuevo-cambio.sh -t <tipo> -s <descripcion-corta> -T "<título>" -b <fichero> -p <prioridad>`.
  Crear un issue es público: confírmalo con el usuario si no lo ha pedido.
- Tipos: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`. Descripción corta en español.
- Todo issue lleva una etiqueta de prioridad: `-p alta|media|baja` en `nuevo-cambio.sh` (pregunta
  al usuario si no está claro).
- Para elegir el siguiente trabajo: `gh issue list --label "prioridad: alta"` (y luego media y baja).
- Si es una feature, escribe o actualiza `docs/features/<feature>.md` antes del código.

## 2. Trabajar

- Solo la fase pedida. Antes de escribir código Next.js, consulta `node_modules/next/dist/docs/`.
- Clasifica cada pieza nueva: plantilla (genérica, sin viajes ni mapas, guía en
  `docs/agentes/plantilla/`) o negocio.
- Si un paso se repite, automatízalo con un script o una skill nueva en el mismo PR y apúntalo en
  `docs/agentes/plantilla/README.md` o `scripts.md`.

## 3. Comprobar y hacer commit

1. `scripts/comprobar.sh` hasta que todo esté en verde. No borres tests para que pase.
2. Si avisa de cambios en `AGENTS.md` (bloque de `next dev`), inclúyelos en el commit.
3. `git status`: que no entre ningún `.env*` ni dato privado.
4. Commit en inglés, Conventional Commits, `(#N)` al final y la línea `Co-Authored-By:` del agente.
5. Vuelve a ejecutar `scripts/comprobar.sh` tras el commit: el informe debe ser del último commit.

## 4. Abrir el PR

1. Escribe en un fichero del scratchpad la sección «Cambios» en español: qué y por qué, en viñetas.
2. Revisa las casillas que el script no marca solo (especificación, `npm run dev`, secretos,
   plantilla o negocio). Para cada una que sea cierta, pasa `-x "<texto de la casilla>"`; si no
   aplica, dilo en «Cambios».
3. `scripts/abrir-pr.sh -T "<tipo>(<ámbito>): título en español (#N)" -c <fichero> -x "Ningún secreto" -x "separado del negocio"`
   (`-d` para borrador).
4. Tras nuevos commits en la rama: `scripts/comprobar.sh` y el mismo `abrir-pr.sh`, que actualiza
   el PR abierto con la evidencia nueva.
5. Da al usuario el enlace del PR.
