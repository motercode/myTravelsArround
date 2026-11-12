# Scripts y skill del ciclo de cambio

Automatizan el ciclo issue → rama → comprobaciones → PR de [flujo-de-trabajo.md](flujo-de-trabajo.md).
Son genéricos: sirven en cualquier web Next.js + Netlify con `gh` autenticado, sin cambiar nada.

| Pieza | Qué hace |
|---|---|
| `scripts/nuevo-cambio.sh` | Pone `main` al día, crea el issue (o usa uno existente) y la rama `tipo/issue-N-descripcion` |
| `scripts/comprobar.sh` | Comprueba que no hay `.env*` en git, ejecuta lint, build y, si existen los scripts npm `test` y `test:e2e`, los tests. Guarda la salida en `.evidencia/comprobaciones.md` (no versionado) |
| `scripts/abrir-pr.sh` | Sube la rama y abre el PR con la plantilla rellenada: `Closes #N`, los cambios, las casillas de lint, build y tests según el informe, y el informe como evidencia |
| `scripts/lib/comun.sh` | Funciones compartidas |
| `.claude/skills/ciclo-de-cambio/` | Skill de Claude Code que guía al agente por el ciclo usando estos scripts |

## Uso

```bash
scripts/nuevo-cambio.sh -t feat -s busqueda -T "Buscar por nombre" -b cuerpo.md   # issue nuevo
scripts/nuevo-cambio.sh -t fix -s fecha-duplicada -i 31                           # issue existente
scripts/comprobar.sh
git commit -m "fix(orders): stop creating a duplicate order on double tap (#31)"
scripts/comprobar.sh                     # el informe tiene que ser del último commit
scripts/abrir-pr.sh -T "fix(orders): no se duplica el pedido (#31)" -c cambios.md
```

## Por qué así

- `abrir-pr.sh` se niega a abrir el PR si el informe falla, no es del último commit o quedan cambios
  sin commit: la evidencia del PR corresponde siempre a lo que se revisa.
- `comprobar.sh` sigue tras un fallo para mostrar todos los problemas de una vez.
- `next dev` (Next.js 16) reescribe su bloque en `AGENTS.md`; `comprobar.sh` avisa para que entre en
  el commit en lugar de quedarse como cambio pendiente.
- Las casillas que dependen de criterio (especificación, prueba en `npm run dev`, plantilla o
  negocio) no se marcan solas.
