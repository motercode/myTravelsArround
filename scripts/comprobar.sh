#!/usr/bin/env bash
# Comprobaciones antes de cada commit y de cada PR (regla 3 de AGENTS.md): ficheros .env y secretos
# fuera de git, piezas de plantilla sin el negocio (regla 6), lint, build y, si están configurados,
# tests unitarios y E2E.
# Deja la salida en .evidencia/comprobaciones.md para pegarla en el PR (scripts/abrir-pr.sh lo hace).
source "$(dirname "$0")/lib/comun.sh"
cd "$RAIZ"
mkdir -p "$EVIDENCIA_DIR"

fallos=0
{
  echo "Comprobaciones del $(date '+%Y-%m-%d %H:%M') en \`$(git branch --show-current)\` ($(git rev-parse --short HEAD))"
  echo
} > "$INFORME"

# Ejecuta un paso, lo registra en el informe y sigue aunque falle para ver todo de una vez.
paso() {
  local nombre="$1"; shift
  info "$nombre"
  local salida estado=0
  salida="$("$@" 2>&1)" || estado=$?
  echo "$salida" | tail -40
  {
    if [[ $estado -eq 0 ]]; then echo "### ✅ $nombre"; else echo "### ❌ $nombre"; fi
    echo; echo '```'; echo "$salida" | tail -40; echo '```'; echo
  } >> "$INFORME"
  [[ $estado -eq 0 ]] || fallos=$((fallos + 1))
}

# .env* fuera de git salvo .env.example; mira lo versionado y lo preparado para commit.
sin_secretos() {
  local encontrados
  encontrados="$( { git ls-files; git diff --cached --name-only; } | sort -u \
    | grep -E '(^|/)\.env' | grep -v '\.env\.example$' || true)"
  if [[ -n "$encontrados" ]]; then echo "Ficheros de entorno en git:"; echo "$encontrados"; return 1; fi
  echo "Ningún .env* en git."
}

# Secretos dentro de los ficheros cambiados respecto a origin/main (incluidos los nuevos sin
# seguimiento). Patrones con longitud mínima para no dar positivo con su propia definición.
secretos_en_cambios() {
  local base ficheros re hallados
  base="$(git merge-base origin/main HEAD 2>/dev/null)" \
    || { echo "Sin origin/main: no se revisan los cambios."; return 0; }
  re='gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY-{5}'
  re+='|(api[_-]?key|secret|password|passwd|token)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9_/+=.-]{16,}["'"'"']'
  mapfile -t ficheros < <( { git diff --name-only --diff-filter=d "$base"; git ls-files --others --exclude-standard; } \
    | sort -u | grep -v '^package-lock\.json$' || true)
  [[ ${#ficheros[@]} -gt 0 ]] || { echo "Sin ficheros cambiados."; return 0; }
  hallados="$(grep -nIiE "$re" -- "${ficheros[@]}" 2>/dev/null | cut -c1-200 || true)"
  if [[ -n "$hallados" ]]; then echo "Posibles secretos:"; echo "$hallados"; return 1; fi
  echo "Ningún secreto en ${#ficheros[@]} fichero(s) cambiado(s)."
}

# Regla 6: las piezas de plantilla no nombran el negocio. Términos y rutas en scripts/proyecto.env.
plantilla_sin_negocio() {
  [[ -n "${TERMINOS_NEGOCIO:-}" ]] || { echo "Sin TERMINOS_NEGOCIO en scripts/proyecto.env: no se revisa."; return 0; }
  local rutas=() excluir hallados r
  for r in ${PLANTILLA_RUTAS:-}; do [[ -e "$r" ]] && rutas+=("$r"); done
  [[ ${#rutas[@]} -gt 0 ]] || { echo "Ninguna ruta de plantilla existe."; return 0; }
  excluir="$(printf '%s\n' ${PLANTILLA_EXCLUIR:-} | sed 's/[.]/\\./g; s/^/^/; s/$/:/')"
  hallados="$(grep -rniE "$TERMINOS_NEGOCIO" -- "${rutas[@]}" | grep -vE "${excluir:-^$}" || true)"
  if [[ -n "$hallados" ]]; then echo "Términos del negocio en piezas de plantilla:"; echo "$hallados"; return 1; fi
  echo "Las piezas de plantilla no nombran el negocio."
}

# next build y next dev (que arrancan los E2E) reescriben next-env.d.ts con rutas distintas
# (.next/types frente a .next/dev/types); si estaba limpio, se restaura al terminar para no dejar
# un cambio ajeno al trabajo.
if [[ -f next-env.d.ts ]] && git diff --quiet -- next-env.d.ts; then
  trap 'git checkout --quiet -- next-env.d.ts' EXIT
fi

paso "Sin secretos en git" sin_secretos
paso "Sin secretos en los cambios" secretos_en_cambios
paso "Plantilla sin negocio (regla 6)" plantilla_sin_negocio
paso "npm run lint" npm run lint
paso "npm run build" npm run build
for s in test test:e2e; do
  if tiene_script_npm "$s"; then
    paso "npm run $s" npm run "$s"
  else
    echo "### ➖ npm run $s: no configurado (no aplica)" >> "$INFORME"; echo >> "$INFORME"
  fi
done

# next dev reescribe su bloque en AGENTS.md; si quedó sin commit, se avisa para incluirlo.
if ! git diff --quiet -- AGENTS.md 2>/dev/null; then
  info "AGENTS.md tiene cambios sin commit (¿bloque de next dev?): inclúyelos en el commit"
fi

if [[ $fallos -gt 0 ]]; then
  error "$fallos comprobación(es) fallida(s). Informe: ${INFORME#$RAIZ/}"
fi
info "todo en verde. Informe: ${INFORME#$RAIZ/}"
