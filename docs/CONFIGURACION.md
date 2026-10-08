# Configuración: `atlas.config.json`

Cada equipo tiene su propio `atlas.config.json` en la raíz del proyecto. Lo escribe `npm run instalar` a partir de lo que detecta, y **no se sube a git**: son rutas de esa computadora. Puedes editarlo a mano. Al guardarlo, el servidor de desarrollo lo nota y regenera el atlas.

Si el archivo no existe, el atlas usa la detección automática en cada corrida (ver [AGENTS.md](../AGENTS.md#cómo-se-adapta-a-cada-equipo)).

Prioridad de cada valor: **variables `ATLAS_*` > `atlas.config.json` > detección**.

## Ejemplo

```json
{
  "version": 1,
  "centro": "Inicio",
  "vaults": [
    { "nombre": "Inicio", "ruta": "~/Documents/Obsidian/Inicio", "proposito": "Mapa de todo y bandeja de entrada" },
    { "nombre": "Trabajo", "ruta": "~/Documents/Obsidian/Trabajo", "color": "#0f9d8a" }
  ],
  "sistemaMemoria": null,
  "skills": [
    { "ia": "Claude", "ruta": "~/.claude/skills" },
    { "ia": "Codex", "ruta": "~/.codex/skills" },
    { "ia": "Antigravity", "ruta": "~/.gemini/config/skills" },
    { "ia": "Codex", "ruta": "~/.codex/plugins/cache/openai-curated/stripe/1a2b3c/skills", "paquete": "stripe", "plugin": true }
  ],
  "agentes": [
    { "ia": "Claude", "ambito": "Usuario", "ruta": "~/.claude/agents" },
    { "ia": "Claude", "ambito": "Proyecto mi-app", "ruta": "~/Projects/mi-app/.claude/agents" }
  ],
  "automatizaciones": { "prefijos": [], "relacionadasConVaults": true },
  "propias": { "cuentas": ["mi-usuario-de-github"], "patrones": ["mi-marca"] },
  "carpetasGeneradas": ["Graphify"],
  "puerto": 5190
}
```

Hay una copia en [atlas.config.ejemplo.json](../atlas.config.ejemplo.json).

## Campos

| Campo | Tipo | Qué hace |
|---|---|---|
| `centro` | texto | Nombre del vault central (del que nacen los demás). Si falta, se elige solo: uno llamado CORE, Inicio, Home, Hub…; si no hay, el que más enlaces tiene con los otros; si no, el más grande. |
| `vaults[]` | lista | Vaults a leer, en orden. `nombre` es el que se muestra; `ruta` es la carpeta (con `~` para el directorio personal). Opcionales: `color` (hex), `proposito`, `incluye[]`, `noIncluye[]`, `inicio` (nota de inicio, ruta relativa al vault). |
| `sistemaMemoria` | ruta o `null` | Carpeta `.memoria-system` de un sistema de memoria multi-vault. Si existe, su `config/vaults.json` aporta propósito, color, entradas, enrutado y complementos de cada vault, y Sistema › Cómo trabaja muestra su motor y sus comandos. |
| `skills[]` | lista | Carpetas con skills (subcarpetas con `SKILL.md`). `ia` es el nombre que se muestra (Claude, Codex, Antigravity, Compartidas o cualquier otro). Opcionales: `sistema` (skills que trae la herramienta), `paquete` y `plugin` (skills que vienen de un plugin). |
| `agentes[]` | lista | Carpetas con agentes (`*.md` con `name` y `description` en el frontmatter). `ambito` dice de dónde vienen («Usuario», «Proyecto x», «Plugin y»). |
| `automatizaciones` | objeto | `relacionadasConVaults`: muestra las tareas de launchd, systemd o cron cuyo programa o rutas tocan los vaults. `prefijos`: además, las de launchd o systemd cuyo nombre empieza con alguno de estos textos. |
| `propias` | objeto | Qué skills son de la persona. Además de las que viven fuera de las carpetas de las IAs (por ejemplo, en un repositorio enlazado): `cuentas` (dueños en GitHub) y `patrones` (texto en el nombre). |
| `carpetasGeneradas` | lista | Carpetas de primer nivel de los vaults donde una herramienta genera notas en masa (p. ej. Graphify, que crea una nota por archivo de código). Sus subcarpetas se cuentan pero no se cargan. |
| `puerto` | número | Puerto del servidor local (5190 por defecto). |
| `preguntar` | objeto | `ia`: qué IA responde las preguntas a la memoria: `auto` (la primera disponible entre Claude Code, Codex, Gemini CLI y Ollama; si una no tiene sesión, prueba la siguiente), `claude`, `codex`, `gemini`, `ollama` o `ninguna` (solo muestra las notas). `modelo`: el modelo de Ollama (por defecto elige uno de chat: llama3, qwen, gemma…). La pregunta y las notas que la responden se envían a esa IA; con Ollama no salen del equipo. `OLLAMA_HOST` cambia dónde está Ollama. |
| `captura` | objeto | Dónde guarda el centro de mando lo que capturas. `modo`: `auto` (usa `memoria capturar` si hay sistema de memoria; si no, un archivo) o `archivo`. `vault` (nombre; por defecto el central) y `carpeta` (`Bandeja` por defecto) para el modo archivo. |
| `uso` | sí/no | Contar el uso de las skills en los historiales locales de Claude Code y Codex (solo conteos y fechas; `true` por defecto). `false` lo apaga. |
| `actualizaciones` | objeto o `false` | `repo`: de dónde buscar versiones nuevas (`dueño/repositorio` en GitHub; por defecto el de `package.json`). `false` apaga la revisión. |
| `novedades` | objeto | `dias`: cuántos días hacia atrás guarda las novedades que muestra Hoy (45 por defecto). |

## Variables de entorno

| Variable | Uso |
|---|---|
| `ATLAS_CONFIG` | Ruta de otro archivo de configuración. |
| `ATLAS_SALIDA` | Dónde escribir los datos generados (por defecto `./datos`). |
| `ATLAS_OBSIDIAN` | Carpeta extra donde buscar vaults durante la detección (también agrega los que encuentre aunque Obsidian no los tenga registrados). |
| `ATLAS_SKILLS_EXTRA` | Carpetas extra de skills, separadas por `:` (`;` en Windows). |
| `ATLAS_LAUNCH_PREFIJOS` | Prefijos de automatizaciones a mostrar, separados por coma. |
| `ATLAS_PUERTO` o `PORT` | Puerto del servidor. |
| `ATLAS_VIGILAR=0` | Desactiva la sincronización en vivo. |
| `ATLAS_ACTUALIZAR=0` | No revisa si hay versiones nuevas. `ATLAS_REPO` cambia el repositorio. |
| `ATLAS_USO=0` | No lee los historiales de las IAs (sin conteo de uso de skills). |
| `ATLAS_TRADUCIR_MANUALES=1` | Marca también para traducir los `SKILL.md` completos. |
| `CODEX_HOME`, `CLAUDE_CONFIG_DIR` | Si usas carpetas de configuración no estándar para Codex o Claude Code, la detección las respeta. |
