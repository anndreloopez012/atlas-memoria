# Formato de los datos generados

`npm run datos` escribe esta carpeta (no versionada):

```
datos/
├── atlas.json                 # índice general
├── vault/<slug>.json          # índice de notas de cada vault
├── contenido/<slug>-<n>.json  # texto completo de las notas, por bloques
├── skills.json                # catálogo de skills
├── skills/<slug>.json         # SKILL.md y referencias de cada skill
├── agentes.json               # subagentes y automatizaciones
├── recientes.json             # lo que cambió en las últimas semanas (Hoy)
└── pendientes-traduccion.json # textos que aún no tienen traducción al español
```

El `slug` de un vault es su nombre en minúsculas sin acentos ni símbolos: `CORE` → `core`, `Mis Notas` → `mis-notas`, `PERSONAL (YO)` → `personal-yo`.

Los tipos de TypeScript equivalentes están en [`src/lib/tipos.ts`](../src/lib/tipos.ts).

## `atlas.json`

| Campo | Tipo | Descripción |
|---|---|---|
| `version` | número | Versión del formato (2). |
| `generado` | ISO 8601 | Momento de la generación. |
| `centro` | texto o `null` | `slug` del vault central (del que nacen los demás). |
| `ias` | lista | IAs con skills en este equipo, en orden (Claude, Codex, Antigravity, Compartidas…). |
| `totales` | objeto | `vaults`, `notas`, `palabras`, `enlaces`, `sinResolver`, `puentes`, `generados` (notas de Graphify omitidas), `skills`, `instalaciones`, `agentes`, `automatizaciones`, `secretosOcultos`, `sinTraducir`. |
| `vaults[]` | lista | Resumen de cada vault (ver abajo), en el orden de `vaults.json`. |
| `puentes[]` | lista | `{ de, a, n }`: enlaces del vault `de` hacia el vault `a`. |
| `sistema` | objeto | `plataforma` (`darwin`, `win32`, `linux`), `configLocal` (hay `atlas.config.json`), `memoria` (hay `.memoria-system`), `fuentes` (lo detectado: `vaults[]`, `skills[]`, `agentes[]` con ruta y cantidad, y `automatizaciones[]`). Si hay sistema de memoria: ids de sus notas clave en el vault central (`contexto`, `reglas`, `mapaRutas`, `multivault`, `salud`), `routing` (`{ vault, seccion, palabras[] }`) y `motor` (`scripts[]` con `{ nombre, resumen }`, `comandos[]` con `{ comando, ayuda }`). |

Resumen de vault:

| Campo | Descripción |
|---|---|
| `nombre`, `slug`, `color`, `icono` | Identidad (color e icono del sistema de memoria o de `atlas.config.json`). |
| `ruta` | Carpeta del vault en este equipo. |
| `proposito`, `incluye[]`, `noIncluye[]` | Para qué es el vault. |
| `inicio` | Id de la nota de inicio. |
| `entradas[]` | Ids de las notas de entrada. |
| `notas`, `palabras`, `adjuntos`, `generados`, `enlaces` | Cifras. |
| `ultima` | Fecha de la nota modificada más reciente. |
| `etiquetas` | `[etiqueta, veces][]`, las 24 más usadas. |
| `carpetas` | Árbol: `{ n: nombre, p: ruta, d: notas directas, t: notas del subárbol, a: adjuntos, h: hijos[] }`. |
| `complementos[]` | Complementos de Obsidian configurados para el vault. |

## `vault/<slug>.json`

```json
{ "notas": [ … ], "externos": { "<id>": { "v": "CORE", "t": "Título", "f": "Carpeta" } } }
```

Cada nota (claves cortas para que el índice pese poco):

| Clave | Descripción |
|---|---|
| `id` | `sha1("<VAULT>/<ruta>")` recortado a 10 caracteres. Estable. |
| `v` | Vault. |
| `r` | Ruta relativa al vault. |
| `t` | Título (`title` del frontmatter o nombre del archivo). |
| `f` | Carpeta (`''` = raíz). |
| `tg[]` | Etiquetas (frontmatter + `#etiquetas` en el texto). |
| `fm` | Frontmatter compacto (solo valores cortos). |
| `h[]` | Encabezados hasta nivel 3: `{ n: nivel, t: texto }`. |
| `ex` | Extracto de ~240 caracteres. |
| `w` | Palabras. |
| `m` | Última modificación (ISO). |
| `o[]` | Ids de notas del mismo vault a las que enlaza. |
| `x[]` | Ids de notas de **otros** vaults a las que enlaza (puentes salientes). |
| `xb[]` | Ids de notas de otros vaults que la enlazan (puentes entrantes). |
| `c` | Bloque de `contenido/` donde está su texto. |

`externos` trae título, vault y carpeta de toda nota de otro vault que aparezca en `x` o `xb`, para mostrarlas sin cargar ese vault.

## `contenido/<slug>-<n>.json`

`{ "<id>": "<markdown>" }`. El markdown ya viene con:

- Frontmatter quitado.
- `[[Nota]]` → `[Título](atlas:<id>)`; enlaces rotos → `atlas-roto:<destino>`.
- `obsidian://open?…` y enlaces relativos `.md` → `atlas:<id>`.
- `![[imagen.png]]` → `![imagen](/adjunto/<slug>/<ruta>)`.
- Secretos reemplazados por `[oculto]`.
- Notas de más de 300 KB recortadas con un aviso.

## `skills.json`

```json
{ "skills": [ … ], "paquetes": [ { "nombre", "descripcion", "skills": [] } ], "categorias": [], "ias": [], "totalInstalaciones": 415 }
```

Cada skill:

| Campo | Descripción |
|---|---|
| `id`, `nombre`, `titulo` | Nombre del frontmatter y primer `#` del manual. |
| `descripcion` | Descripción del frontmatter, en español. |
| `descripcionOriginal` | La misma descripción tal como está en el archivo (la usa la búsqueda). |
| `que[]`, `cuando[]`, `noPara[]` | La descripción partida en oraciones, en español: qué hace, cuándo se activa, cuándo no. |
| `activadores[]` | Frases entre comillas de la descripción (lo que la despierta), en español. |
| `categoria` | Del índice del sistema de memoria o de un clasificador por palabras. |
| `paquete` | Familia a la que pertenece (Impeccable, HyperFrames…, o `Plugin <nombre>` si viene de un plugin), o `null`. |
| `origen` | `propia` (vive fuera de las carpetas de las IAs o coincide con `propias` de la configuración), `instalada`, `plugin` o `sistema`. |
| `padre` | Si es una sub-skill dentro de otra. |
| `repo` | `{ remoto, raiz }` si vive en un repositorio Git. |
| `instalaciones[]` | `{ ia, ruta, real }` (`real` = destino del enlace simbólico). |
| `ias[]` | IAs donde está instalada. |
| `secciones[]` | `## ` y `### ` del manual con un resumen: `{ n, t, r }`. |
| `palabras` | Palabras del `SKILL.md`. |
| `archivos[]` | `{ r: ruta, b: bytes, k: referencias \| scripts \| recursos \| otros, t?: título }`. |
| `relacionadas[]` | Otras skills que menciona. |
| `agentes[]` | Ids de agentes que la mencionan. |
| `notas[]` | Notas de cualquier vault que se llaman como la skill o como `<IA> - <skill>`: `{ id, v (vault), t (título) }`. |
| `extras` | Resto del frontmatter (`license`, `version`, `user-invocable`…). |
| `archivoDetalle` | Nombre del archivo en `skills/`. |
| `m`, `c` | Última modificación y primera instalación (ISO) entre todas sus instalaciones; `c` es `null` si el sistema no da la fecha de creación. |

## `skills/<slug>.json`

`{ "cuerpo": "<SKILL.md sin frontmatter>", "traducido": false, "referencias": { "<ruta>": "<texto>" } }`. Solo archivos `.md`/`.txt`, hasta 80 KB cada uno y ~1,2 MB por skill. `cuerpo` sale en español si el manual ya está traducido (`traducido: true`); si no, es el texto original.

## `recientes.json`

Lo que cambió en los últimos `dias` días (45 por defecto; `novedades.dias` en la configuración). La pantalla Hoy lo compara con la última visita guardada en el navegador.

```json
{ "dias": 45, "notas": [ { "id", "v", "t", "f", "m", "c", "g"? } ], "skills": [ { "nombre", "categoria", "m", "c" } ], "agentes": [ { "id", "nombre", "ia", "m", "c" } ] }
```

- `m` es la última modificación y `c` la creación (o `null` si el sistema no la da).
- `g: 1` marca las notas que reescribe una herramienta: las que tienen `generado: true` (o `generated`, `autogenerado`) en el frontmatter y las que cambiaron **en lote** (20 o más del mismo vault con menos de 90 s de diferencia). Hoy las muestra aparte para que no tapen lo que escribió la persona.
- Hasta 800 notas propias y 400 automáticas, de la más reciente a la más antigua.

## `pendientes-traduccion.json`

Lista de `{ clave, tipo, texto }` con cada texto que todavía no tiene traducción. `tipo` es `frase`, `titulo`, `activador`, `documento` (instrucciones de agentes y docstrings) o `manual` (solo con `ATLAS_TRADUCIR_MANUALES=1`). `npm run traducir` lo consume.

## `traducciones/es.json` (versionado, fuera de `datos/`)

`{ "<huella>": "<traducción>" }`. La huella son los primeros 16 caracteres del SHA-1 del texto original sin espacios a los lados.

## `agentes.json`

`{ "agentes": [ … ] }` con dos tipos:

**`tipo: "ia"`** — `id`, `nombre`, `ia` (Claude, Codex, Antigravity…), `ambito` («Usuario», «Proyecto x», «Plugin y»), `descripcion` (en español), `descripcionOriginal`, `que[]`, `cuando[]`, `noPara[]`, `activadores[]`, `modelo`, `herramientas[]`, `color`, `skills[]` (mencionadas), `cuerpo` (instrucciones, en español), `ruta`, `notas[]` (notas de cualquier vault que lo mencionan: `{ id, v, t }`).

**`tipo: "automatizacion"`** — `id`, `nombre` (label de launchd, unidad de systemd o `cron · <script>`), `ia` (`launchd`, `systemd` o `cron`), `ambito`, `descripcion`, `detalle` (docstring del script), `script`, `intervalo` (segundos), `programacion` (expresión de cron, si aplica), `alIniciar`, `vigila[]` (carpetas), `logs[]`, `ruta` (plist, unidad o `crontab -l`), `pausar[]` (comandos para pausarla y reactivarla).
