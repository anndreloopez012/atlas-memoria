# Cambios

## 1.2.0 · 2026-10-05

### Instalable por IA en cualquier equipo
- Basta con darle la URL del repositorio a Claude Code, Codex o Antigravity y decir «instala»: `AGENTS.md` (que Codex y Antigravity leen solos), `CLAUDE.md` y `GEMINI.md` (que lo importan) y la skill `instalar-atlas` (en `.agents/skills/` y `.claude/skills/`) guían la instalación de punta a punta.
- `instalar.sh` (macOS y Linux) e `instalar.ps1` (Windows) dejan listo Node.js si falta (Homebrew, fnm o nvm sin sudo; winget en Windows), instalan dependencias y ejecutan el instalador. `iniciar.sh` e `iniciar.ps1` abren el atlas.
- `npm run instalar` detecta, escribe `atlas.config.json` (local, no versionado), verifica y genera los datos; tiene opciones para agregar o quitar vaults, fijar el centro, sumar carpetas de skills o agentes, marcar skills propias y cambiar el puerto, y un resumen `--json` para la IA.
- `npm run verificar`: prueba de humo en un equipo falso (dos vaults, tres IAs, un agente) y revisión de las instrucciones para las IAs.
- Guías nuevas: `INSTALAR.md` y `docs/CONFIGURACION.md`.

### Se acopla a lo que tenga cada persona
- Detección de vaults por el registro de Obsidian (macOS, Windows y Linux, incluido Flatpak y Snap) con búsqueda de respaldo y sugerencias para las carpetas no registradas.
- Skills de Claude Code, Codex (`CODEX_HOME`) y Antigravity, la carpeta compartida `~/.agents/skills`, las de fábrica de Antigravity y las de los **plugins activos** de Claude Code y Codex.
- Agentes de usuario, de plugins y de proyectos; automatizaciones de launchd, systemd y cron que tocan los vaults.
- El vault central se elige solo (o se fija), y la interfaz funciona con uno, muchos o ningún vault. Desaparecen todas las referencias fijas a un equipo: nombres de vault, cantidad de vaults e IAs, prefijos de usuario y rutas.
- «Cómo trabaja» muestra las fuentes detectadas y se adapta a si hay o no un sistema de memoria.

## 1.1.0 · 2026-10-05

### Todo en español
- Descripciones, «para qué sirve», «cuándo se activa», títulos y resúmenes de secciones, títulos de referencias, instrucciones de agentes, docstrings del motor y metadatos se muestran en español. Solo los nombres de vaults, skills y agentes quedan en inglés.
- Diccionario versionado `traducciones/es.json` con la huella del texto original como clave.
- `npm run traducir`: traduce lo pendiente con Claude Code, o por lotes (`--lotes`, `--importar`).
- Los manuales completos se marcan como «texto original»; se pueden traducir con `ATLAS_TRADUCIR_MANUALES=1`.

### Arreglos
- Cada corrida del generador usa su propia carpeta temporal: el vigía del servidor y una corrida manual ya no se pisan.

## 1.0.0 · 2026-10-03

Primera versión.

### Datos
- Generador que lee los 6 vaults, las skills de Claude, Codex y Antigravity, los subagentes y las automatizaciones de launchd.
- Resolución de enlaces al estilo Obsidian, puentes entre vaults y contenido con enlaces navegables dentro del atlas.
- Ocultado de valores con forma de secreto antes de escribir los datos.
- Lector tolerante de frontmatter para descripciones con «:» sin comillas.

### Interfaz
- Universo: CORE al centro, vaults en órbita, puentes y anillo de skills y agentes por categoría.
- Vaults: árbol de carpetas, grafo estructurado, recientes y lector de notas con citas y puentes.
- Skills: catálogo con filtros, red de relaciones y ficha con «cómo trabaja» paso a paso.
- Agentes y automatizaciones con su ficha.
- Cómo trabaja: flujo del sistema de memoria, enrutado, motor y comandos.
- Búsqueda global (⌘K), tema oscuro y claro, adaptable a móvil.

### Servidor
- Sirve datos y adjuntos de los vaults, regenera bajo pedido y se sincroniza en vivo con los vaults.
