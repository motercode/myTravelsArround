#!/usr/bin/env bash
# Abre el PR de la rama actual con la plantilla de .github/pull_request_template.md rellenada:
# «Closes #N» sacado de la rama, la descripción de los cambios y el informe de scripts/comprobar.sh
# como evidencia. Las casillas de lint, build y tests se marcan según ese informe; el resto se
# revisa a mano en el PR.
#
# Uso: scripts/abrir-pr.sh -T "feat(map): título en español (#N)" -c cambios.md [-d]   (-d: borrador)
source "$(dirname "$0")/lib/comun.sh"

titulo="" cambios="" borrador=()
while getopts "T:c:d" opt; do
  case "$opt" in
    T) titulo="$OPTARG" ;; c) cambios="$OPTARG" ;; d) borrador=(--draft) ;;
    *) error "opción no válida (mira la cabecera del script)" ;;
  esac
done
[[ -n "$titulo" ]] || error "falta -T con el título del PR"
[[ -n "$cambios" && -f "$cambios" ]] || error "falta -c con un fichero que describa los cambios"

cd "$RAIZ"
issue="$(issue_de_rama)" || error "la rama no sigue tipo/issue-N-descripcion"
[[ -f "$INFORME" ]] || error "no hay informe: ejecuta antes scripts/comprobar.sh"
grep -q "($(git rev-parse --short HEAD))" "$INFORME" \
  || error "el informe no es del último commit: vuelve a ejecutar scripts/comprobar.sh"
! grep -q '^### ❌' "$INFORME" || error "el informe tiene comprobaciones fallidas"
[[ -z "$(git status --porcelain)" ]] || error "hay cambios sin commit"

# Marca la casilla de la plantilla que contiene el texto $1.
marcar() { sed -i "/$1/s/- \[ \]/- [x]/" "$cuerpo"; }

cuerpo="$(mktemp)"
trap 'rm -f "$cuerpo"' EXIT
cp .github/pull_request_template.md "$cuerpo"
sed -i "s/^Closes #$/Closes #$issue/" "$cuerpo"
# Descripción de los cambios justo debajo del título de la sección.
sed -i "/^## Cambios$/r $cambios" "$cuerpo"
grep -q '^### ✅ npm run lint' "$INFORME" && marcar 'npm run lint'
grep -q '^### ✅ npm run build' "$INFORME" && marcar 'npm run build'
# La casilla cubre unitarios y E2E: solo se marca si pasan los dos.
if grep -q '^### ✅ npm run test$' "$INFORME" && grep -q '^### ✅ npm run test:e2e$' "$INFORME"; then
  marcar 'npm test'
elif grep -q '^### ➖ npm run test' "$INFORME"; then
  sed -i '/npm test/s/$/ — no aplica: tests aún no configurados./' "$cuerpo"
fi
# La evidencia sustituye al comentario de la sección.
sed -i "/^<!-- Pega aquí/{
r $INFORME
d
}" "$cuerpo"

git push -u origin "$(git branch --show-current)"
gh pr create --base main --title "$titulo" --body-file "$cuerpo" "${borrador[@]}"
