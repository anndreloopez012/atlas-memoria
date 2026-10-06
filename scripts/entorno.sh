# Funciones compartidas por instalar.sh e iniciar.sh (macOS y Linux).
# Se cargan con `source`; no se ejecutan solas.

NODE_MINIMO=20

version_node() {
  if command -v node >/dev/null 2>&1; then
    node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0
  else
    echo 0
  fi
}

# Node.js pudo quedar instalado con Homebrew, fnm o nvm sin estar en el PATH de
# esta terminal (por ejemplo, si lo instaló este mismo script hace un momento).
cargar_node() {
  local dir
  for dir in "$HOME/.local/share/fnm" "$HOME/.fnm" "$HOME/.volta/bin" /opt/homebrew/bin /usr/local/bin; do
    [ -d "$dir" ] && PATH="$dir:$PATH"
  done
  export PATH
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --shell bash 2>/dev/null)" || true
    fnm use --silent-if-unchanged default >/dev/null 2>&1 || true
  fi
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    set +u
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"
    nvm use --silent default >/dev/null 2>&1 || true
  fi
}

# Instala Node.js 22 para el usuario (sin sudo): Homebrew si ya existe en macOS;
# si no, fnm; y si falta unzip (lo necesita fnm), nvm.
instalar_node() {
  echo "→ Node.js $NODE_MINIMO o superior no está disponible: lo instalo para tu usuario."
  if [ "$(uname -s)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
    brew install node@22
    PATH="$(brew --prefix node@22)/bin:$PATH"
    export PATH
    return
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "Falta curl para descargar Node.js. Instálalo (por ejemplo: sudo apt-get install -y curl) y vuelve a ejecutar." >&2
    return 1
  fi
  if command -v unzip >/dev/null 2>&1; then
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "$HOME/.local/share/fnm"
    PATH="$HOME/.local/share/fnm:$PATH"
    export PATH
    eval "$(fnm env --shell bash)"
    fnm install 22
    fnm default 22
    fnm use 22
  else
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    set +u
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"
    nvm install 22
    nvm alias default 22
  fi
}
