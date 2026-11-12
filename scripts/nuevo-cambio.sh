#!/usr/bin/env bash
# Empieza un cambio: issue (nuevo o existente) y rama tipo/issue-N-descripcion desde main al día.
#
# Uso:
#   scripts/nuevo-cambio.sh -t feat -s busqueda -T "Título del issue" [-b cuerpo.md]
#   scripts/nuevo-cambio.sh -t fix  -s fecha-duplicada -i 31      # issue ya creado
source "$(dirname "$0")/lib/comun.sh"

tipo="" slug="" titulo="" cuerpo="" issue=""
while getopts "t:s:T:b:i:" opt; do
  case "$opt" in
    t) tipo="$OPTARG" ;; s) slug="$OPTARG" ;; T) titulo="$OPTARG" ;;
    b) cuerpo="$OPTARG" ;; i) issue="$OPTARG" ;;
    *) error "opción no válida (mira la cabecera del script)" ;;
  esac
done

[[ "$tipo" =~ ^(feat|fix|test|docs|chore|refactor)$ ]] || error "-t debe ser feat, fix, test, docs, chore o refactor"
[[ "$slug" =~ ^[a-z0-9-]+$ ]] || error "-s debe ir en minúsculas y con guiones (descripcion-corta)"
[[ -n "$issue" || -n "$titulo" ]] || error "indica -i <issue> o -T <título> para crearlo"

cd "$RAIZ"
# Los cambios sin commit viajan a la rama nueva; se avisa para que sea a propósito.
[[ -z "$(git status --porcelain)" ]] || info "hay cambios sin commit: pasarán a la rama nueva"

# La rama sale de origin/main y no del main local: así no hace falta cambiar a main (que fallaría
# con cambios sin commit en ficheros que el main local aún no tiene).
info "actualizando main"
git fetch origin main --quiet
if [[ "$(git branch --show-current)" == "main" ]]; then
  git merge --ff-only origin/main --quiet
else
  git fetch origin main:main --quiet || info "main local divergente de origin/main: no se actualiza"
fi

if [[ -z "$issue" ]]; then
  args=(--title "$titulo")
  if [[ -n "$cuerpo" ]]; then args+=(--body-file "$cuerpo"); else args+=(--body ""); fi
  url="$(gh issue create "${args[@]}")"
  issue="${url##*/}"
  info "issue creado: $url"
fi

rama="$tipo/issue-$issue-$slug"
git switch --quiet --no-track -c "$rama" origin/main
info "rama $rama lista. Siguiente: código, scripts/comprobar.sh y scripts/abrir-pr.sh"
