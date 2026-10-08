#!/bin/bash
# Desinstalador de doble clic para macOS. Quita «Atlas de memoria» de Aplicaciones y
# del Escritorio y borra la app de ~/Library/Application Support/Atlas de memoria.
# Antes muestra qué va a quitar y pide confirmación. Tus vaults y tus notas no se tocan.
set -eo pipefail
INSTALADA="$HOME/Library/Application Support/Atlas de memoria"
AQUI="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$INSTALADA/scripts/desinstalar.mjs" ]; then APP="$INSTALADA"; else APP="$AQUI"; fi
# shellcheck disable=SC1091
source "$APP/scripts/entorno.sh"
cargar_node
if ! command -v node >/dev/null 2>&1; then
  echo "No encontré Node.js. Para desinstalar a mano: borra «Atlas de memoria» de Aplicaciones y del Escritorio, y la carpeta $INSTALADA."
  exit 1
fi
node "$APP/scripts/desinstalar.mjs"
echo ""
echo "Puedes cerrar esta ventana."
