#!/usr/bin/env bash
# Desinstalador para Linux. Quita «Atlas de memoria» del menú de aplicaciones y del
# Escritorio y borra la app de ~/.local/share/atlas-memoria. Antes muestra qué va a
# quitar y pide confirmación. Tus vaults y tus notas no se tocan.
#   bash "Desinstalar en Linux.sh"   (o doble clic: «Ejecutar como programa»)
set -eo pipefail
INSTALADA="${XDG_DATA_HOME:-$HOME/.local/share}/atlas-memoria"
AQUI="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$INSTALADA/scripts/desinstalar.mjs" ]; then APP="$INSTALADA"; else APP="$AQUI"; fi
# shellcheck disable=SC1091
source "$APP/scripts/entorno.sh"
cargar_node
if ! command -v node >/dev/null 2>&1; then
  echo "No encontré Node.js. Para desinstalar a mano: borra ~/.local/share/applications/atlas-memoria.desktop, el acceso del Escritorio y la carpeta $INSTALADA."
  exit 1
fi
if [ -t 0 ]; then
  node "$APP/scripts/desinstalar.mjs"
  read -r -p "Presiona Enter para cerrar…" _
else
  # Abierto sin terminal (doble clic o menú): se pregunta con una ventana.
  PREGUNTA="¿Desinstalar el Atlas de memoria? Se quitan la app y sus accesos; tus vaults y tus notas no se tocan."
  if command -v zenity >/dev/null 2>&1; then
    zenity --question --title="Atlas de memoria" --text="$PREGUNTA" --ok-label="Desinstalar" --cancel-label="Cancelar" || exit 0
  elif command -v kdialog >/dev/null 2>&1; then
    kdialog --title "Atlas de memoria" --yesno "$PREGUNTA" || exit 0
  else
    command -v notify-send >/dev/null 2>&1 && notify-send "Atlas de memoria" "Para desinstalar, ejecuta en una terminal: bash \"$APP/Desinstalar en Linux.sh\""
    exit 0
  fi
  node "$APP/scripts/desinstalar.mjs" --si
  command -v notify-send >/dev/null 2>&1 && notify-send "Atlas de memoria" "Desinstalado. Tus vaults y tus notas siguen intactos." || true
fi
