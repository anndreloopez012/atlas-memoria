#!/usr/bin/env bash
# Instala el Atlas de memoria en macOS o Linux.
#
# Deja Node.js listo si falta (sin sudo), instala las dependencias y ejecuta el
# instalador del atlas: detecta vaults, skills y agentes, verifica y genera los
# datos. Las opciones se pasan tal cual a scripts/instalar.mjs:
#
#   bash instalar.sh                     instalación completa
#   bash instalar.sh --json              igual, con un resumen final en JSON (para la IA)
#   bash instalar.sh --vault ~/Notas     agrega un vault que no se detectó solo
set -eo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
source scripts/entorno.sh

cargar_node
if [ "$(version_node)" -lt "$NODE_MINIMO" ]; then
  # Todo lo que no es el resumen va a stderr: así --json deja la salida limpia.
  instalar_node >&2
  cargar_node
fi
if [ "$(version_node)" -lt "$NODE_MINIMO" ]; then
  echo "No pude dejar listo Node.js $NODE_MINIMO o superior. Instálalo desde https://nodejs.org y vuelve a ejecutar este script." >&2
  exit 1
fi

echo "→ Node.js $(node -v) · npm $(npm -v)" >&2
npm install --no-fund --no-audit --loglevel=error >&2
node scripts/instalar.mjs "$@"
