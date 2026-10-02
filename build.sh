#!/usr/bin/env bash
# Ensambla index.html a partir de los fragmentos de _src
set -e
cd "$(dirname "$0")"
OUT="index.html"

{
  cat _src/01-head.html
  cat _src/02-style.css
  cat _src/04-comp.css
  cat _src/05-comp2.css
  cat _src/06-responsive.css
  cat _src/07-tabbar.css
  cat _src/03-body.html
  cat _src/06-core.js
  cat _src/09-cloud.js
  cat _src/07-views.js
  cat _src/08-ui.js
  cat _src/10-cloud-ui.js
  printf '</script>\n</body>\n</html>\n'
} > "$OUT"

echo "index.html generado: $(wc -l < "$OUT") líneas, $(du -h "$OUT" | cut -f1)"