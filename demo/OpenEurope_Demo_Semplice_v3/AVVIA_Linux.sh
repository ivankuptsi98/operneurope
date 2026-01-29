#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$DIR/index.html"
else
  echo "Apri manualmente: $DIR/index.html"
fi
