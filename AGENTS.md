# Atlas de memoria · instrucciones para agentes de IA

> Codex y Antigravity leen este archivo solos; Claude Code lo importa desde `CLAUDE.md`; Gemini CLI, desde `GEMINI.md`.
> **Si te pidieron instalar este repositorio, sigue «Instalar» de principio a fin.** La persona solo te dio la URL y dijo «instala»: tú te encargas de todo, sin pedirle pasos manuales salvo los que dicen «pregunta».

## Qué es

Una página web local que dibuja la memoria de una persona: sus **vaults de Obsidian** (con un vault central del que nacen los demás), las **skills** de Claude Code, Codex y Antigravity (incluidas las de plugins activos) y sus **agentes**. Muestra qué hace cada skill, cuándo se activa, cómo trabaja y qué archivos usa; deja leer cada nota y saltar entre vaults. Lee todo de la computadora donde corre y no sube nada a internet. Interfaz y textos en español.

No necesita Obsidian instalado (lee las carpetas), ni cuentas, ni llaves de ninguna API.

## Instalar

Objetivo: que la persona termine con el atlas abierto en el navegador y sepa cómo volver a abrirlo.

1. **Conseguir el repositorio.** Si ya estás dentro de él (existe `instalar.sh`), sigue al paso 2. Si solo tienes la URL, clónalo en la carpeta de proyectos de la persona: usa la primera que exista de `~/Documents/PROYECTOS`, `~/Projects`, `~/proyectos`, `~/code`; si ninguna existe, `~/atlas-memoria`.
   - `git clone <url> <carpeta>`. Si es privado y git pide credenciales, usa `gh repo clone <dueño>/<repo> <carpeta>`; si `gh` no tiene sesión, **pregunta** a la persona si puede ejecutar `gh auth login` (el dueño del repositorio debe haberle dado acceso).
   - Si falta git: macOS `xcode-select --install` (abre un diálogo) o `brew install git`; Windows `winget install --id Git.Git -e --silent`; Linux el gestor de la distribución (`sudo apt-get install -y git`, `sudo dnf install -y git`). Alternativa sin git: descargar el ZIP del repositorio y descomprimirlo.
2. **Ejecutar el instalador** desde la raíz del repositorio. Instala Node.js 20+ si falta (sin sudo: Homebrew si ya existe, si no fnm o nvm; en Windows, winget), instala dependencias, detecta vaults, skills y agentes, corre `npm run verificar` y genera los datos:
   - macOS / Linux: `bash instalar.sh --json`
   - Windows: `powershell -ExecutionPolicy Bypass -File instalar.ps1 --json`
   Con `--json` lo último que imprime es un resumen en JSON: `vaults`, `sugerenciasDeVaults`, `centro`, `skills`, `agentes`, `totales`, `siguiente`.
3. **Revisar el resumen y ajustar** (cada ajuste regenera los datos):
   - `vaults` vacío → **pregunta** dónde están sus vaults de Obsidian (o si usa Obsidian) y agrégalos: `npm run instalar -- --vault "<ruta>" --json`. Sin vaults el atlas igual muestra skills y agentes.
   - `sugerenciasDeVaults` → carpetas con `.obsidian` que Obsidian no tiene registradas. **Pregunta** si son suyas antes de agregarlas.
   - `centro` → el vault del que nacen los demás (se eligió solo). Si la persona tiene otro principal: `npm run instalar -- --centro "<nombre>"`.
   - Skills propias: las que viven fuera de las carpetas de las IAs ya cuentan como suyas. Para marcar las de su cuenta de GitHub o por nombre: `--cuenta <usuario>` y `--propia <texto>`.
4. **Traducir lo pendiente.** Regla del proyecto: todo texto descriptivo en español. Si `totales.sinTraducir` > 0:
   - Fuera de una sesión de Claude Code: `npm run traducir`.
   - Desde cualquier IA (incluida Claude Code): `npm run traducir -- --lotes <carpeta-temporal>`; traduce cada `lote-NN.json` (lista de `{ clave, tipo, texto }`) a `resultado-NN.json` (`{ "<clave>": "<traducción>" }`, todas las claves, JSON válido) con las reglas de «Traducción»; luego `npm run traducir -- --importar <carpeta-temporal>`. Si son muchos lotes y puedes, repártelos entre subagentes.
5. **Abrirlo.** `bash iniciar.sh` (Windows: `powershell -ExecutionPolicy Bypass -File iniciar.ps1`) levanta el servidor en `siguiente.url` (por defecto http://localhost:5190). Déjalo en segundo plano si tu herramienta lo permite y abre la URL en el navegador. Si no puedes dejar procesos corriendo, dile a la persona que ejecute ese comando cuando quiera usar el atlas.
6. **Confirmar y contar.** `npm run verificar` debe terminar en «Todo en orden». Resume a la persona qué encontró (vaults y su centro, skills por IA, agentes, automatizaciones) y cómo abrir el atlas después.

**Actualizar una instalación existente:** `git pull`, luego `bash instalar.sh --json` (o `instalar.ps1`). Conserva su configuración y agrega lo nuevo que encuentre.

## Comandos

| Comando | Para qué |
|---|---|
| `bash instalar.sh` · `instalar.ps1` | Instalación completa (también para actualizar) |
| `bash iniciar.sh` · `iniciar.ps1` | Abrir el atlas (instala primero si hace falta) |
| `npm run instalar -- <opciones>` | Instalador sin el paso de Node.js (`--vault`, `--quitar-vault`, `--centro`, `--skills IA=ruta`, `--agentes IA=ruta`, `--cuenta`, `--propia`, `--puerto`, `--redetectar`, `--solo-detectar`, `--json`) |
| `npm run detectar` | Volver a buscar vaults, skills y agentes nuevos sin generar datos |
| `npm run datos` | Regenerar los datos |
| `npm run traducir` | Traducir al español lo pendiente (`--lotes`, `--importar`) |
| `npm run verificar` | Prueba de humo en un equipo falso + revisión de estas instrucciones |
| `npm run dev` · `npm run build` | Servidor de desarrollo · compilación con revisión de tipos |

## Cómo se adapta a cada equipo

- `scripts/lib/detectar.mjs` busca:
  - **Vaults:** el registro de Obsidian (`obsidian.json` en macOS, Windows y Linux, incluido Flatpak y Snap); si no existe, carpetas con `.obsidian` en Documentos, Escritorio, Dropbox, OneDrive e iCloud.
  - **Skills:** `~/.claude/skills`, `$CODEX_HOME/skills` (o `~/.codex/skills`), `~/.gemini/config/skills`, `~/.gemini/antigravity/skills`, `~/.gemini/skills`, los builtin de Antigravity, `~/.agents/skills` y las skills de los **plugins activos** de Claude Code y Codex.
  - **Agentes:** `~/.claude/agents`, `~/.codex/agents`, `~/.gemini/agents`, agentes de plugins y `<proyecto>/.claude|.codex|.gemini|.agents/agents` dentro de las carpetas de proyectos.
  - **Automatizaciones:** launchd (macOS), systemd de usuario y cron (Linux) que tocan las rutas de los vaults.
  - **Sistema de memoria:** un `.memoria-system/` junto a los vaults (opcional) aporta propósito, colores, orden y enrutado.
- El resultado queda en `atlas.config.json` (local, ignorado por git). Formato en `docs/CONFIGURACION.md`.
- Prioridad: variables `ATLAS_*` > `atlas.config.json` > detección automática.

## Reglas para cualquier cambio en este repositorio

- **Reutilizable:** nada de rutas, usuarios, nombres de vaults ni cuentas fijas en el código. Todo sale de la detección o de `atlas.config.json`. Funciona en macOS, Windows y Linux; lo que dependa de un sistema se detecta y se omite sin romper.
- **Todo en español:** interfaz, documentación, comentarios de código y commits. En inglés solo los nombres propios (vaults, skills, agentes, productos, comandos, código).
- **Sin datos personales en git:** `datos/` y `atlas.config.json` están ignorados. `traducciones/es.json` solo guarda traducciones de descripciones.
- **Al terminar cada cambio:** `npm run verificar` y `npm run build` deben pasar; actualiza README, `INSTALAR.md`, este archivo (si cambia la instalación o las reglas) y `CHANGELOG.md`.
- **Git:** una rama por cambio (`feat/…`, `fix/…`) creada desde el punto común de `dev` y `main`; commits `feat(<pantalla>): <explicación>` o `fix(<pantalla>): …`; fusión `--no-ff` en `dev` y en `main`, que quedan iguales. Sin líneas `Co-Authored-By` ni menciones a asistentes de IA.
- **La skill de instalación** vive en `.agents/skills/instalar-atlas/SKILL.md` (Antigravity y Codex) con una copia idéntica en `.claude/skills/instalar-atlas/SKILL.md` (Claude Code). Si cambias una, copia la otra: `npm run verificar` lo comprueba.
- **Límite de Antigravity:** cada archivo de reglas (este incluido) se corta a 24 KB.

## Traducción

Al traducir lotes (paso 4):

- Español neutro latinoamericano, profesional y natural, con tuteo («usa», «pides»).
- No traduzcas nombres de skills, agentes, vaults, productos, marcas, librerías, herramientas, comandos, código entre comillas invertidas, rutas, archivos, URLs, flags ni variables.
- `titulo`: título corto con mayúscula solo al inicio. `frase`: traducción fiel y fluida, conserva comillas, paréntesis y markdown en línea. `activador`: frase natural que diría un usuario hispanohablante. `documento` y `manual`: markdown; traduce solo la prosa y deja intactos encabezados, listas, tablas, bloques de código y enlaces.
- Si un texto ya está en español, devuélvelo igual. Valida que el JSON cargue y tenga todas las claves antes de importar.

## Mapa del repositorio

| Ruta | Qué hay |
|---|---|
| `instalar.sh`, `instalar.ps1`, `iniciar.sh`, `iniciar.ps1` | Arranque por sistema operativo |
| `scripts/instalar.mjs` | Detección + configuración + verificación + datos |
| `scripts/lib/detectar.mjs` | Qué tiene cada equipo |
| `scripts/lib/config.mjs` | Configuración efectiva (`ATLAS_*` > `atlas.config.json` > detección) |
| `scripts/generar-datos.mjs` y `scripts/lib/` | Lectura de vaults, skills, agentes, traducciones y secretos → `datos/` |
| `scripts/verificar.mjs` | Prueba de humo en un HOME temporal |
| `scripts/traducir.mjs` | Traducción de lo pendiente |
| `vite.config.ts` | Servidor: datos, adjuntos de los vaults, regeneración y vigilancia en vivo |
| `src/` | Página React (Universo, Vaults, Skills y Sistema, más el centro de mando ⌘K) |
| `docs/` | Arquitectura, formato de datos, configuración y flujo de Git |
