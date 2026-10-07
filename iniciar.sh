#!/usr/bin/env bash
# Abre el Atlas de memoria (macOS y Linux). Es lo que ejecuta el acceso de doble
# clic: si falta algo lo instala, busca cambios en vaults, skills y agentes, abre
# el navegador y deja el servidor en segundo plano (se apaga solo al dejar de usarlo).
#
#   bash iniciar.sh          abre la app
#   bash iniciar.sh --dev    modo desarrollo (Vite con recarga en caliente)
set -eo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
source scripts/entorno.sh

cargar_node
if [ "$(version_node)" -lt "$NODE_MINIMO" ] || [ ! -f atlas.config.json ] || [ ! -d node_modules ]; then
  bash instalar.sh --sin-abrir
  cargar_node
fi
if [ "${1:-}" = "--dev" ]; then
  shift
  exec npm run dev -- "$@"
fi
exec node scripts/abrir.mjs "$@"
