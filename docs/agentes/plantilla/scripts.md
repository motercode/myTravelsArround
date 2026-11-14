# Scripts y skill del ciclo de cambio

Automatizan el ciclo issue → rama → comprobaciones → PR de [flujo-de-trabajo.md](flujo-de-trabajo.md).
Son genéricos: sirven en cualquier web Next.js + Netlify con `gh` autenticado, sin cambiar nada.

| Pieza | Qué hace |
|---|---|
| `scripts/nuevo-cambio.sh` | Pone `main` al día, crea el issue (o usa uno existente), le pone la etiqueta de prioridad con `-p` y crea la rama `tipo/issue-N-descripcion` |
| `scripts/comprobar.sh` | Comprueba que no hay `.env*` en git ni secretos en los ficheros cambiados respecto a `origin/main` (tokens de GitHub, claves de AWS, claves privadas, asignaciones de claves de API), que las piezas de plantilla no nombran el negocio, y ejecuta lint, build y, si existen los scripts npm `test` y `test:e2e`, los tests. Guarda la salida en `.evidencia/comprobaciones.md` (no versionado) |
| `scripts/abrir-pr.sh` | Sube la rama y abre el PR con la plantilla rellenada: `Closes #N` (o `Refs #N` con `-r`, si el PR no cierra el issue), los cambios, las casillas de lint, build y tests según el informe, las que se indiquen con `-x` y el informe como evidencia. Si la rama ya tiene un PR abierto, lo actualiza |
| `scripts/cerrar-cambio.sh` | Tras el merge: comprueba que el PR está mergeado, pone `main` al día, borra la rama local y la remota si sigue, y lista los issues de prioridad alta |
| `scripts/lib/comun.sh` | Funciones compartidas; carga `scripts/proyecto.env` si existe |
| `scripts/proyecto.env` | **Negocio, no plantilla.** Configuración del proyecto: `TERMINOS_NEGOCIO`, `PLANTILLA_RUTAS` y `PLANTILLA_EXCLUIR` para la regla 6 |
| `.claude/skills/ciclo-de-cambio/` | Skill de Claude Code que guía al agente por el ciclo usando estos scripts |

## Uso

```bash
scripts/nuevo-cambio.sh -t feat -s busqueda -T "Buscar por nombre" -b cuerpo.md -p media  # issue nuevo
scripts/nuevo-cambio.sh -t fix -s fecha-duplicada -i 31                           # issue existente
scripts/comprobar.sh
git commit -m "fix(orders): stop creating a duplicate order on double tap (#31)"
scripts/comprobar.sh                     # el informe tiene que ser del último commit
scripts/abrir-pr.sh -T "fix(orders): no se duplica el pedido (#31)" -c cambios.md \
  -x "Ningún secreto" -x "separado del negocio"   # casillas revisadas a mano
# tras más commits: comprobar.sh y el mismo abrir-pr.sh actualizan el PR
scripts/abrir-pr.sh -r -T "docs(features): especificación de pedidos (#40)" -c cambios.md  # no cierra #40
scripts/cerrar-cambio.sh               # tras el merge, desde la rama del cambio
```

## Por qué así

- `abrir-pr.sh` se niega a abrir el PR si el informe falla, no es del último commit o quedan cambios
  sin commit: la evidencia del PR corresponde siempre a lo que se revisa.
- `comprobar.sh` sigue tras un fallo para mostrar todos los problemas de una vez.
- `next dev` (Next.js 16) reescribe su bloque en `AGENTS.md`; `comprobar.sh` avisa para que entre en
  el commit en lugar de quedarse como cambio pendiente.
- Las casillas que dependen de criterio (especificación, prueba en `npm run dev`, secretos,
  plantilla o negocio) no se marcan solas: se marcan con `-x` después de revisarlas, y el script
  falla si el texto no coincide con ninguna casilla.
- `nuevo-cambio.sh` crea la rama desde `origin/main` sin pasar por el `main` local, para no fallar
  con cambios sin commit.
- Las prioridades viven solo en las etiquetas `prioridad: alta|media|baja` de GitHub; el README
  enlaza a los issues filtrados por cada una. Una copia de la lista en el README se desfasaba con
  cada issue cerrado. En otro proyecto: crear las tres etiquetas (`gh label create`).
- Lo propio del proyecto va en `scripts/proyecto.env` y no dentro de los scripts: así los scripts se
  copian tal cual a otro proyecto y solo se reescribe ese fichero. Sin él, las comprobaciones que lo
  necesitan se saltan.
- La búsqueda de secretos usa patrones con longitud mínima, para no dar positivo con su propia
  definición, y mira los ficheros cambiados enteros (no solo las líneas añadidas): un secreto que ya
  estaba en un fichero que se toca también se avisa.
- En GitHub conviene activar el borrado de la rama al mergear (`gh repo edit --delete-branch-on-merge`);
  `cerrar-cambio.sh` la borra igualmente si sigue.
- `comprobar.sh` deja `next-env.d.ts` como estaba: `next build` y `next dev` (que arrancan los E2E)
  lo reescriben con rutas distintas.
