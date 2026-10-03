# Atlas de memoria

Una página interactiva para **ver y recorrer toda tu memoria en un solo lugar**: los 6 vaults de Obsidian (con **CORE** al centro y los demás naciendo de él), las **skills** de tus IAs y los **agentes** que trabajan por ti. Sirve para recordar qué hace cada pieza, leer cualquier nota y moverte entre vaults de forma gráfica.

Lee los datos directamente de esta Mac y se mantiene **sincronizado solo**: si cambias una nota en Obsidian mientras el atlas está abierto, se actualiza en segundos.

---

## Índice

- [Qué puedes hacer](#qué-puedes-hacer)
- [Requisitos](#requisitos)
- [Instalación y uso](#instalación-y-uso)
- [Cómo se mantiene sincronizado](#cómo-se-mantiene-sincronizado)
- [De dónde lee los datos](#de-dónde-lee-los-datos)
- [Configuración](#configuración)
- [Privacidad](#privacidad)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Arquitectura](#arquitectura)
- [Flujo de trabajo con Git](#flujo-de-trabajo-con-git)
- [Atajos](#atajos)
- [Solución de problemas](#solución-de-problemas)

---

## Qué puedes hacer

### Universo (`#/`)
El mapa completo. **CORE es el sol** del centro y los otros cinco vaults (PROGRAMACION, MARKETING, TALLERES IA, GENERAL y PERSONAL (YO)) orbitan a su alrededor, unidos a él por rayos que muestran que **nacen de CORE**.

- El tamaño de cada planeta es proporcional a sus notas; las lunas que giran son sus carpetas principales.
- Las curvas doradas son los **puentes**: enlaces de un vault a otro. Pasa el cursor para ver cuántos hay en cada sentido.
- El **anillo exterior** es el zodiaco de tus skills (un punto por skill, agrupadas por categoría) y tus agentes (rombos). Los puntos con borde dorado son skills tuyas.
- Debajo, el **árbol de vaults**: CORE como tronco y cinco ramas, con propósito, cifras y carpetas de cada uno.

### Vaults (`#/v/<vault>`)
Un vault por dentro, en tres columnas:

| Columna | Qué muestra |
|---|---|
| Carpetas | Árbol navegable con el número de notas de cada carpeta. La carpeta elegida queda en la URL. |
| Grafo / Recientes | Grafo estructurado (raíz → carpetas → notas, más los enlaces entre notas) o la lista de notas ordenadas por fecha, con filtro. |
| Lector | La nota renderizada (callouts, tablas, tareas, imágenes del vault), sus propiedades, índice, **a qué enlaza**, **quién la cita** y sus **puentes con otros vaults**. |

- El carril superior permite saltar entre vaults: CORE primero y una rama que lleva a los otros cinco.
- Los enlaces dentro de una nota llevan a la nota destino, **aunque esté en otro vault**.
- «Abrir en Obsidian» abre la misma nota en la app.

### Skills (`#/skills`)
Catálogo de todas las skills instaladas en **Claude, Codex y Antigravity**, agrupadas por nombre (una skill instalada en las tres IAs aparece una vez, con las tres insignias).

- Filtros por IA, origen (propias, instaladas, sistema), categoría y paquete (Impeccable, HyperFrames, Higgsfield, n8n…).
- Vista **Red**: qué skill menciona a cuál y qué agentes las usan.
- **Ficha de cada skill** (`#/skills/<nombre>`):
  - **Para qué sirve**, **cuándo se activa** (con las frases que la despiertan) y **cuándo no usarla**.
  - **Cómo trabaja**, paso a paso: tu pedido → la IA la elige → lee el manual → consulta referencias → ejecuta scripts → usa plantillas → entrega.
  - Las secciones del manual con su resumen, el `SKILL.md` completo y cada archivo de referencia legible en un visor.
  - Dónde está instalada, su repositorio en GitHub, skills con las que trabaja, agentes que la usan y sus notas en Obsidian.

### Agentes (`#/agentes`)
- **Agentes de IA** (subagentes de Claude y Codex): para qué sirven, cuándo se les delega, sus herramientas, modelo, skills que usan y sus instrucciones completas.
- **Automatizaciones** (LaunchAgents de macOS): cada cuánto corren, qué vigilan, qué script ejecutan, dónde dejan registro y cómo pausarlas.

### Cómo trabaja (`#/sistema`)
El flujo del sistema de memoria: de dónde **entra** el conocimiento, quién lo **procesa**, dónde **vive** y quién lo **consulta**. Incluye las reglas de enrutado (qué palabras mandan cada cosa a cada vault), los scripts del motor y los comandos `memoria`.

### Búsqueda global
`⌘K` (o `/`) busca entre las ~4.200 notas, las skills y los agentes a la vez.

---

## Requisitos

- macOS (lee los LaunchAgents con `plutil`; el resto funciona en cualquier sistema).
- Node.js 20 o superior.
- El contenedor de Obsidian en `~/Documents/OBSIDIAN` (o en la ruta que indiques, ver [Configuración](#configuración)).

## Instalación y uso

```bash
npm install
```

```bash
npm run dev
```

Abre <http://localhost:5190>. La primera vez el servidor genera los datos solo (tarda unos 5 segundos).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con sincronización en vivo. Es la forma recomendada de usarlo. |
| `npm run datos` | Vuelve a leer vaults, skills y agentes y reescribe `datos/`. |
| `npm start` | Compila y sirve la versión optimizada en el puerto 5190 (sin vigilancia en vivo; usa el botón de actualizar). |
| `npm run build` | Revisa tipos y compila en `dist/`. |
| `npm run typecheck` | Solo revisión de tipos. |

---

## Cómo se mantiene sincronizado

1. **En vivo:** con `npm run dev`, el servidor vigila el contenedor de Obsidian. Cuando cambia una nota `.md`, espera 8 segundos (para agrupar los guardados de Obsidian), regenera el atlas y avisa al navegador, que recarga los datos sin perder la vista.
2. **Bajo pedido:** el botón de la barra superior (muestra «hace X min») vuelve a leer todo.
3. **Desde la terminal:** `npm run datos`.

Los datos generados viven en `datos/` y **no se suben a Git**: son contenido personal, cambian cada pocos minutos y ya están respaldados en el repositorio privado de Obsidian. El repositorio guarda el código que los genera y los dibuja.

---

## De dónde lee los datos

| Fuente | Ruta por defecto | Qué saca |
|---|---|---|
| Vaults | `~/Documents/OBSIDIAN/<VAULT>` | Notas, carpetas, propiedades, etiquetas, enlaces y adjuntos |
| Registro de vaults | `~/Documents/OBSIDIAN/.memoria-system/config/vaults.json` | Orden, color, propósito, qué incluye, entradas, enrutado y complementos |
| Motor | `~/Documents/OBSIDIAN/.memoria-system/bin` | Scripts y comandos `memoria` |
| Categorías de skills | `~/Documents/OBSIDIAN/.memoria-system/data/memoria_index.json` | La categoría que el sistema ya asignó a cada skill |
| Skills de Claude | `~/.claude/skills` | `SKILL.md`, referencias, scripts y recursos |
| Skills de Codex | `~/.codex/skills` (incluye `.system`) | Ídem |
| Skills de Antigravity | `~/.gemini/config/skills` | Ídem |
| Agentes de Claude | `~/.claude/agents` y `~/Documents/CLAUDE/.claude/agents` | Descripción, herramientas, modelo e instrucciones |
| Agentes de Codex | `~/.codex/agents` | Ídem |
| Automatizaciones | `~/Library/LaunchAgents/com.anndre.*` y `com.codex.*` | Intervalo, rutas vigiladas, script y registros |

Qué **no** carga: las ~35.000 notas que Graphify genera dentro de `<vault>/Graphify/<proyecto>/` (una por archivo de código). Se cuentan y se avisa, pero su resumen ya vive en las fichas de proyecto de PROGRAMACION.

Las skills de los complementos de claude.ai (por ejemplo `anthropic-skills:*` o `marketing:*`) no están en disco, así que no aparecen.

## Configuración

Todo se ajusta con variables de entorno, sin tocar el código:

| Variable | Por defecto | Uso |
|---|---|---|
| `ATLAS_OBSIDIAN` | `~/Documents/OBSIDIAN` | Contenedor de los vaults |
| `ATLAS_SALIDA` | `./datos` | Dónde se escriben los datos generados |
| `ATLAS_SKILLS_EXTRA` | — | Carpetas extra de skills, separadas por `:` |
| `ATLAS_LAUNCH_PREFIJOS` | `com.anndre.,com.codex.` | Prefijos de los LaunchAgents a mostrar |
| `ATLAS_VIGILAR` | `1` | `0` desactiva la sincronización en vivo |

Ejemplo:

```bash
ATLAS_OBSIDIAN=/Volumes/Respaldo/OBSIDIAN npm run dev
```

---

## Privacidad

- Todo corre en tu Mac: no hay servidor externo ni analítica. El repositorio es privado.
- Antes de escribir los datos, el generador **oculta** cualquier valor con forma de secreto (llaves privadas, tokens de Stripe/GitHub/AWS/Google/Slack/OpenAI/Anthropic, JWT y pares `password=…`, `token: …`). En la página aparecen como `[oculto]` y el total se muestra en «Cómo trabaja».
- El servidor solo sirve archivos que estén dentro de `datos/` o de un vault (no se puede escapar con `../`).

---

## Estructura del proyecto

```
atlas-memoria/
├── scripts/
│   ├── generar-datos.mjs      # punto de entrada: escribe datos/
│   └── lib/
│       ├── config.mjs         # rutas y límites (variables de entorno)
│       ├── texto.mjs          # frontmatter, enlaces, extractos, ocultar secretos
│       ├── vaults.mjs         # notas, carpetas, resolución de enlaces y puentes
│       ├── skills.mjs         # inventario de skills de las tres IAs
│       └── agentes.mjs        # subagentes, LaunchAgents y motor
├── src/
│   ├── App.tsx                # barra, rutas y búsqueda
│   ├── pantallas/             # Universo, Vault, Skills, SkillDetalle, Agentes, Sistema
│   ├── componentes/           # Grafo, LectorNota, ArbolCarpetas, Buscador, Pipeline…
│   ├── lib/                   # datos (caché), rutas (hash), markdown, tema, formato, tipos
│   └── estilos/               # base (tokens y atmósfera), app, markdown
├── docs/
│   ├── ARQUITECTURA.md        # cómo está hecho y por qué
│   ├── DATOS.md               # formato de cada archivo generado
│   └── FLUJO-GIT.md           # ramas, dev y main
├── vite.config.ts             # complemento que sirve datos y adjuntos y vigila los vaults
└── datos/                     # generado (no versionado)
```

## Arquitectura

```mermaid
flowchart LR
  subgraph Mac
    V[(6 vaults<br/>Obsidian)]
    S[(Skills<br/>Claude · Codex · Antigravity)]
    A[(Agentes y<br/>LaunchAgents)]
  end
  G[scripts/generar-datos.mjs] -->|JSON| D[(datos/)]
  V --> G
  S --> G
  A --> G
  W{{vigía de cambios<br/>vite.config.ts}} -->|regenera| G
  V -.cambio en .md.-> W
  D -->|/datos| P[Página React]
  V -->|/adjunto| P
  W -->|aviso HMR| P
```

Detalle de cada pieza, decisiones de diseño y cómo extenderlo en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). El formato de los datos está en [docs/DATOS.md](docs/DATOS.md).

---

## Flujo de trabajo con Git

- Cada cambio va en su propia rama (`feat/<tema>` o `fix/<tema>`), creada desde el punto común de `dev` y `main`.
- Commits con el formato `feat(<pantalla>): <explicación>` o `fix(<pantalla>): <explicación>`.
- Al terminar: se sube la rama, se fusiona con `--no-ff` en `dev` y en `main`, y se suben ambas. `dev` y `main` siempre quedan con el mismo contenido.

Comandos paso a paso en [docs/FLUJO-GIT.md](docs/FLUJO-GIT.md).

## Atajos

| Tecla | Acción |
|---|---|
| `⌘K` / `Ctrl K` / `/` | Buscar |
| `↑` `↓` `↵` | Moverse y abrir en la búsqueda |
| `Esc` | Cerrar búsqueda o visor |
| Rueda / arrastrar | Zoom y desplazamiento en los grafos |

## Solución de problemas

| Síntoma | Causa y arreglo |
|---|---|
| «Todavía no hay mapa» | No existe `datos/atlas.json`. Ejecuta `npm run datos`. Si dice que no encuentra el contenedor, usa `ATLAS_OBSIDIAN`. |
| Una nota nueva no aparece | Con `npm start` no hay vigilancia en vivo: usa el botón de actualizar. Con `npm run dev`, espera ~10 s. |
| Una skill aparece sin descripción | Su `SKILL.md` no tiene `description` en el frontmatter. |
| Una imagen de una nota no carga | El adjunto no está dentro del mismo vault o tiene otro nombre. |
| El grafo de PROGRAMACION se ve como un ovillo | Con más de 1.200 notas los enlaces entre notas se ocultan; actívalos con «Enlaces» o elige una carpeta. |
| `EX_CONFIG 78` en LaunchAgents | No es de este proyecto: es la trampa de permisos (TCC) del sistema de memoria con `~/Documents/OBSIDIAN`. |
