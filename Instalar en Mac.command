#!/bin/bash
# Instalador de doble clic para macOS. Copia el atlas a
# ~/Library/Application Support/Atlas de memoria (así sigue funcionando aunque
# borres la descarga), deja Node.js listo si falta, detecta tus vaults, skills y
# agentes, crea «Atlas de memoria» en Aplicaciones y en el Escritorio, y lo abre.
set -eo pipefail
ORIGEN="$(cd "$(dirname "$0")" && pwd)"
DESTINO="$HOME/Library/Application Support/Atlas de memoria"
echo ""
echo "  Atlas de memoria · instalación"
echo "  ──────────────────────────────"
if [ "$ORIGEN" != "$DESTINO" ]; then
  echo "→ Copiando la app a $DESTINO…"
  mkdir -p "$DESTINO"
  rsync -a --exclude node_modules --exclude datos --exclude .atlas-cache --exclude atlas.config.json "$ORIGEN/" "$DESTINO/"
fi
cd "$DESTINO"
bash instalar.sh --abrir
echo ""
echo "Listo. Desde ahora abre «Atlas de memoria» con doble clic en Aplicaciones o en el Escritorio."
echo "Puedes cerrar esta ventana y borrar la descarga."
