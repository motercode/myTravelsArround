#!/usr/bin/env bash
# Empieza un cambio: issue (nuevo o existente) con su etiqueta de prioridad y rama
# tipo/issue-N-descripcion desde main al día.
#
# Uso:
#   scripts/nuevo-cambio.sh -t feat -s busqueda -T "Título del issue" -p media [-b cuerpo.md]
#   scripts/nuevo-cambio.sh -t fix  -s fecha-duplicada -i 31 [-p alta]   # issue ya creado
#
# -p (alta|media|baja) pone la etiqueta «prioridad: …»; es obligatoria al crear el issue.
source "$(dirname "$0")/lib/comun.sh"

tipo="" slug="" titulo="" cuerpo="" issue="" prioridad=""
while getopts "t:s:T:b:i:p:" opt; do
  case "$opt" in
    t) tipo="$OPTARG" ;; s) slug="$OPTARG" ;; T) titulo="$OPTARG" ;;
    b) cuerpo="$OPTARG" ;; i) issue="$OPTARG" ;; p) prioridad="$OPTARG" ;;
    *) error "opción no válida (mira la cabecera del script)" ;;
  esac
done

[[ "$tipo" =~ ^(feat|fix|test|docs|chore|refactor)$ ]] || error "-t debe ser feat, fix, test, docs, chore o refactor"
[[ "$slug" =~ ^[a-z0-9-]+$ ]] || error "-s debe ir en minúsculas y con guiones (descripcion-corta)"
[[ -n "$issue" || -n "$titulo" ]] || error "indica -i <issue> o -T <título> para crearlo"
[[ -z "$prioridad" || "$prioridad" =~ ^(alta|media|baja)$ ]] || error "-p debe ser alta, media o baja"
[[ -n "$issue" || -n "$prioridad" ]] || error "un issue nuevo necesita prioridad: -p alta|media|baja"

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
  args=(--title "$titulo" --label "prioridad: $prioridad")
  if [[ -n "$cuerpo" ]]; then args+=(--body-file "$cuerpo"); else args+=(--body ""); fi
  url="$(gh issue create "${args[@]}")"
  issue="${url##*/}"
  info "issue creado: $url"
elif [[ -n "$prioridad" ]]; then
  gh issue edit "$issue" --add-label "prioridad: $prioridad" >/dev/null
  info "issue #$issue etiquetado con prioridad: $prioridad"
fi

rama="$tipo/issue-$issue-$slug"
git switch --quiet --no-track -c "$rama" origin/main
info "rama $rama lista. Siguiente: código, scripts/comprobar.sh y scripts/abrir-pr.sh"
