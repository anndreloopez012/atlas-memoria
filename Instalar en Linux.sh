#!/usr/bin/env bash
# Instalador para Linux. Copia el atlas a ~/.local/share/atlas-memoria (así sigue
# funcionando aunque borres la descarga), deja Node.js listo si falta, detecta tus
# vaults, skills y agentes, crea «Atlas de memoria» en el menú de aplicaciones y en
# el Escritorio, y lo abre. Ejecútalo con doble clic («Ejecutar como programa») o:
#   bash "Instalar en Linux.sh"
set -eo pipefail
ORIGEN="$(cd "$(dirname "$0")" && pwd)"
DESTINO="${XDG_DATA_HOME:-$HOME/.local/share}/atlas-memoria"
echo ""
echo "  Atlas de memoria · instalación"
echo "  ──────────────────────────────"
if [ "$ORIGEN" != "$DESTINO" ]; then
  echo "→ Copiando la app a $DESTINO…"
  mkdir -p "$DESTINO"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --exclude node_modules --exclude datos --exclude .atlas-cache --exclude atlas.config.json "$ORIGEN/" "$DESTINO/"
  else
    tar -C "$ORIGEN" --exclude node_modules --exclude datos --exclude .atlas-cache --exclude atlas.config.json -cf - . | tar -C "$DESTINO" -xf -
  fi
fi
cd "$DESTINO"
bash instalar.sh --abrir
echo ""
echo "Listo. Desde ahora abre «Atlas de memoria» desde el menú de aplicaciones o el Escritorio."
if [ -t 0 ]; then read -r -p "Presiona Enter para cerrar…" _; fi
