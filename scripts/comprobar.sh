#!/usr/bin/env bash
# Comprobaciones antes de cada commit y de cada PR (regla 3 de AGENTS.md):
# secretos fuera de git, lint, build y, si están configurados, tests unitarios y E2E.
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

paso "Sin secretos en git" sin_secretos
paso "npm run lint" npm run lint
# next build reescribe next-env.d.ts (rutas .next/types frente a .next/dev/types de next dev);
# si estaba limpio, se restaura para no dejar un cambio ajeno al trabajo.
next_env_limpio=0
if [[ -f next-env.d.ts ]] && git diff --quiet -- next-env.d.ts; then next_env_limpio=1; fi
paso "npm run build" npm run build
if [[ $next_env_limpio -eq 1 ]]; then git checkout --quiet -- next-env.d.ts; fi
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
