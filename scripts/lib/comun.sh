# Funciones compartidas por los scripts del ciclo de cambio.
# Genérico: sirve en cualquier web Next.js + Netlify (ver docs/agentes/plantilla/scripts.md).

set -euo pipefail

RAIZ="$(git rev-parse --show-toplevel)"
EVIDENCIA_DIR="$RAIZ/.evidencia"
INFORME="$EVIDENCIA_DIR/comprobaciones.md"

error() { echo "✗ $*" >&2; exit 1; }
info() { echo "→ $*"; }

# Número de issue sacado del nombre de la rama: tipo/issue-N-descripcion.
issue_de_rama() {
  local rama
  rama="$(git branch --show-current)"
  [[ "$rama" =~ ^[a-z]+/issue-([0-9]+)- ]] || return 1
  echo "${BASH_REMATCH[1]}"
}

# ¿Existe el script npm $1 en package.json?
tiene_script_npm() {
  node -e "process.exit(require('$RAIZ/package.json').scripts?.['$1'] ? 0 : 1)"
}
