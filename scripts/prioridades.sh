#!/usr/bin/env bash
# Regenera la lista de prioridades del README a partir de los issues abiertos y sus etiquetas
# «prioridad: alta|media|baja». La lista va entre los marcadores
#   <!-- BEGIN:prioridades -->  y  <!-- END:prioridades -->
# Los issues sin etiqueta de prioridad salen al final, en «Sin prioridad», para que se vean.
#
# Uso: scripts/prioridades.sh [--check]   (--check: falla si el README no está al día, sin tocarlo)
source "$(dirname "$0")/lib/comun.sh"
cd "$RAIZ"

README="README.md"
grep -q '<!-- BEGIN:prioridades -->' "$README" && grep -q '<!-- END:prioridades -->' "$README" \
  || error "faltan los marcadores <!-- BEGIN:prioridades --> y <!-- END:prioridades --> en $README"

issues="$(gh issue list --state open --limit 200 --json number,title,url,labels)"

lista="$(ISSUES="$issues" node -e '
  const issues = JSON.parse(process.env.ISSUES);
  const niveles = [["alta", "Alta"], ["media", "Media"], ["baja", "Baja"], [null, "Sin prioridad"]];
  const nivel = (i) => i.labels.map((l) => l.name.match(/^prioridad: (alta|media|baja)$/)?.[1]).find(Boolean) ?? null;
  let n = 0;
  const out = [];
  for (const [clave, titulo] of niveles) {
    const grupo = issues.filter((i) => nivel(i) === clave).sort((a, b) => a.number - b.number);
    if (!grupo.length) continue;
    out.push(`**${titulo}**`);
    for (const i of grupo) out.push(`${++n}. [#${i.number}](${i.url}) ${i.title}`);
    out.push("");
  }
  if (!n) out.push("No hay issues abiertos.", "");
  process.stdout.write(out.join("\n"));
')"

nuevo="$(mktemp)"
trap 'rm -f "$nuevo"' EXIT
LISTA="$lista" awk '
  # $(…) quita el salto final de la lista: se añade para que END quede en su propia línea.
  /<!-- BEGIN:prioridades -->/ { print; print ""; printf "%s\n\n", ENVIRON["LISTA"]; dentro = 1; next }
  /<!-- END:prioridades -->/ { dentro = 0 }
  !dentro { print }
' "$README" > "$nuevo"

if [[ "${1:-}" == "--check" ]]; then
  cmp -s "$README" "$nuevo" || error "la lista de prioridades de $README no está al día: ejecuta scripts/prioridades.sh"
  info "prioridades al día"
else
  cp "$nuevo" "$README"
  info "prioridades actualizadas en $README"
fi
