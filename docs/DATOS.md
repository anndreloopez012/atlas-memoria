# Formato de los datos generados

`npm run datos` escribe esta carpeta (no versionada):

```
datos/
├── atlas.json                 # índice general
├── vault/<slug>.json          # índice de notas de cada vault
├── contenido/<slug>-<n>.json  # texto completo de las notas, por bloques
├── skills.json                # catálogo de skills
├── skills/<slug>.json         # SKILL.md y referencias de cada skill
└── agentes.json               # subagentes y automatizaciones
```

El `slug` de un vault es su nombre en minúsculas sin acentos ni símbolos: `CORE` → `core`, `TALLERES IA` → `talleres-ia`, `PERSONAL (YO)` → `personal-yo`.

Los tipos de TypeScript equivalentes están en [`src/lib/tipos.ts`](../src/lib/tipos.ts).

## `atlas.json`

| Campo | Tipo | Descripción |
|---|---|---|
| `version` | número | Versión del formato (1). |
| `generado` | ISO 8601 | Momento de la generación. |
| `origen` | texto | Ruta del contenedor de Obsidian. |
| `totales` | objeto | `vaults`, `notas`, `palabras`, `enlaces`, `sinResolver`, `puentes`, `generados` (notas de Graphify omitidas), `skills`, `instalaciones`, `agentes`, `automatizaciones`, `secretosOcultos`. |
| `vaults[]` | lista | Resumen de cada vault (ver abajo), en el orden de `vaults.json`. |
| `puentes[]` | lista | `{ de, a, n }`: enlaces del vault `de` hacia el vault `a`. |
| `sistema` | objeto | Ids de notas clave de CORE (`contexto`, `reglas`, `mapaRutas`, `multivault`, `salud`), `routing` (`{ vault, seccion, palabras[] }`) y `motor` (`scripts[]` con `{ nombre, resumen }`, `comandos[]` con `{ comando, ayuda }`). |

Resumen de vault:

| Campo | Descripción |
|---|---|
| `nombre`, `slug`, `color`, `icono` | Identidad (color e icono de `vaults.json`). |
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
{ "skills": [ … ], "paquetes": [ { "nombre", "descripcion", "skills": [] } ], "categorias": [], "totalInstalaciones": 415 }
```

Cada skill:

| Campo | Descripción |
|---|---|
| `id`, `nombre`, `titulo` | Nombre del frontmatter y primer `#` del manual. |
| `descripcion` | Descripción completa del frontmatter. |
| `que[]`, `cuando[]`, `noPara[]` | La descripción partida en oraciones: qué hace, cuándo se activa, cuándo no. |
| `activadores[]` | Frases entre comillas de la descripción (lo que la despierta). |
| `categoria` | Del índice del sistema de memoria o de un clasificador por palabras. |
| `paquete` | Familia a la que pertenece (Impeccable, HyperFrames…), o `null`. |
| `origen` | `propia` (repositorio tuyo o carpeta en PROYECTOS), `instalada` o `sistema`. |
| `padre` | Si es una sub-skill dentro de otra. |
| `repo` | `{ remoto, raiz }` si vive en un repositorio Git. |
| `instalaciones[]` | `{ ia, ruta, real }` (`real` = destino del enlace simbólico). |
| `ias[]` | IAs donde está instalada. |
| `secciones[]` | `## ` y `### ` del manual con un resumen: `{ n, t, r }`. |
| `palabras` | Palabras del `SKILL.md`. |
| `archivos[]` | `{ r: ruta, b: bytes, k: referencias \| scripts \| recursos \| otros, t?: título }`. |
| `relacionadas[]` | Otras skills que menciona. |
| `agentes[]` | Ids de agentes que la mencionan. |
| `notas[]` | Ids de sus notas en `TALLERES IA/Skills`. |
| `extras` | Resto del frontmatter (`license`, `version`, `user-invocable`…). |
| `archivoDetalle` | Nombre del archivo en `skills/`. |

## `skills/<slug>.json`

`{ "cuerpo": "<SKILL.md sin frontmatter>", "referencias": { "<ruta>": "<texto>" } }`. Solo archivos `.md`/`.txt`, hasta 80 KB cada uno y ~1,2 MB por skill.

## `agentes.json`

`{ "agentes": [ … ] }` con dos tipos:

**`tipo: "ia"`** — `id`, `nombre`, `ia` (Claude/Codex), `ambito`, `descripcion`, `que[]`, `cuando[]`, `noPara[]`, `activadores[]`, `modelo`, `herramientas[]`, `color`, `skills[]` (mencionadas), `cuerpo` (instrucciones), `ruta`, `notas[]` (notas de TALLERES IA que lo mencionan).

**`tipo: "automatizacion"`** — `id`, `nombre` (label de launchd), `ia: "launchd"`, `ambito`, `descripcion`, `detalle` (docstring del script), `script`, `intervalo` (segundos), `alIniciar`, `vigila[]` (vaults), `logs[]`, `ruta` (plist).
