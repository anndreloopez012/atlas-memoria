#!/usr/bin/env bash
# Abre el Atlas de memoria: servidor local con sincronización en vivo
# (http://localhost:5190 o el puerto de atlas.config.json). Si todavía no está
# instalado, lo instala primero. Las opciones se pasan a Vite (p. ej. --open).
set -eo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
source scripts/entorno.sh

cargar_node
if [ "$(version_node)" -lt "$NODE_MINIMO" ] || [ ! -f atlas.config.json ] || [ ! -d node_modules ]; then
  bash instalar.sh
  cargar_node
fi
exec npm run dev -- "$@"
