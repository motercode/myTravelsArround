#!/usr/bin/env bash
# Cierra un cambio después del merge: comprueba que el PR de la rama está mergeado, pone main al
# día, borra la rama local (y la remota si sigue existiendo) y muestra lo siguiente por hacer.
#
# Uso: scripts/cerrar-cambio.sh [rama]   (por defecto, la rama actual)
source "$(dirname "$0")/lib/comun.sh"
cd "$RAIZ"

rama="${1:-$(git branch --show-current)}"
[[ -n "$rama" && "$rama" != "main" ]] || error "indica la rama del cambio o ejecútalo desde ella"
[[ -z "$(git status --porcelain)" ]] || error "hay cambios sin commit: guárdalos o descártalos antes de cerrar"

estado="$(gh pr view "$rama" --json state,number,url -q '"\(.state) #\(.number) \(.url)"' 2>/dev/null)" \
  || error "la rama $rama no tiene PR"
[[ "$estado" == MERGED* ]] || error "el PR de $rama no está mergeado: $estado"
info "PR mergeado: ${estado#MERGED }"

info "actualizando main"
git fetch origin --prune --quiet
git switch main --quiet
git merge --ff-only origin/main --quiet

# -D y no -d: con squash o rebase merge, git no ve la rama como mergeada aunque GitHub sí.
if git show-ref --verify --quiet "refs/heads/$rama"; then
  git branch -D "$rama" >/dev/null
  info "rama local $rama borrada"
fi
if git ls-remote --exit-code --heads origin "$rama" >/dev/null 2>&1; then
  git push origin --delete "$rama" --quiet
  info "rama remota $rama borrada"
fi

echo
info "siguiente trabajo (prioridad alta):"
gh issue list --state open --label "prioridad: alta" --json number,title -q '.[] | "  #\(.number) \(.title)"'
