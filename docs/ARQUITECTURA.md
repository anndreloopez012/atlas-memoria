# Arquitectura

El atlas tiene tres piezas: un **generador** que lee la Mac y escribe JSON, un **complemento de Vite** que sirve esos datos y los mantiene al día, y una **página React** que los dibuja.

```
vaults · skills · agentes ──► scripts/generar-datos.mjs ──► datos/*.json ──► /datos ──► React
          ▲                                ▲                                      │
          └──── fs.watch (vite.config.ts) ─┘◄──────── POST /__atlas/regenerar ────┘
```

## 1. Generador (`scripts/`)

Node puro (solo depende de `yaml`). Se ejecuta en ~5 s para ~4.200 notas.

| Módulo | Responsabilidad |
|---|---|
| `config.mjs` | Rutas de origen y límites. Todo se puede cambiar con variables `ATLAS_*`. |
| `texto.mjs` | Frontmatter (YAML estricto con respaldo tolerante), encabezados, extracto, conteo de palabras, etiquetas en línea, extracción de enlaces y **ocultado de secretos**. |
| `vaults.mjs` | Recorre cada vault, arma el árbol de carpetas, resuelve enlaces al estilo Obsidian, cuenta puentes entre vaults y **reescribe los enlaces** del contenido. |
| `skills.mjs` | Busca `SKILL.md` en las carpetas de cada IA, agrupa por nombre, analiza la descripción (qué hace / cuándo / cuándo no / frases activadoras), lista archivos, detecta repositorio Git, paquete, categoría y menciones a otras skills. |
| `agentes.mjs` | Subagentes (`.md` con frontmatter), LaunchAgents (`plutil -convert json`), docstrings de los scripts del motor y comandos `memoria`. |
| `generar-datos.mjs` | Orquesta todo, parte el contenido en bloques y escribe `datos/` de forma atómica (escribe en `datos.nuevo/` y renombra). |

### Decisiones

- **Qué se omite.** `<vault>/Graphify/<proyecto>/` y las notas `_COMMUNITY_*` las genera Graphify (una por archivo de código: ~35.000). Se cuentan para que se sepa que existen, pero no se cargan: no son memoria escrita y harían el atlas inmanejable.
- **Resolución de enlaces.** Igual que Obsidian: ruta exacta → relativa a la carpeta de la nota → final de ruta → nombre de archivo (gana la ruta más corta). `[[nota\|alias]]` dentro de tablas se limpia. Los `obsidian://open?vault=X&file=Y` se resuelven contra el vault X: así se cuentan los **puentes**.
- **Enlaces reescritos.** En el contenido, `[[Nota]]` pasa a `[Título](atlas:<id>)` y los enlaces rotos a `atlas-roto:`. Las imágenes incrustadas (`![[foto.png]]`) apuntan a `/adjunto/<vault>/<ruta>`. Así el navegador no necesita volver a resolver nada.
- **Identificadores estables.** El id de una nota es `sha1("<VAULT>/<ruta>")` recortado a 10 caracteres: no cambia entre regeneraciones, por eso los enlaces del navegador (`#/v/core/<id>`) siguen sirviendo.
- **Contenido en bloques.** El índice de cada vault (metadatos, enlaces, extracto) se carga de una vez; el texto completo va en bloques de ~450 KB que se piden solo al abrir una nota.
- **Secretos.** Se reemplazan por `[oculto]` antes de escribir cualquier archivo. Los patrones ignoran valores que son código (`process.env.X`, `z.string()`, `req.body`) para no romper ejemplos.
- **Skills duplicadas.** La misma skill puede estar en Claude, Codex y Antigravity (a veces con enlace simbólico al mismo repositorio). Se agrupan por nombre; el contenido sale de la instalación preferida (Claude → Codex → Antigravity) y se listan todas las rutas.
- **Menciones entre skills.** Los nombres compuestos (`web-inmersiva`) se buscan tal cual; los de una palabra (`layout`, `audit`, `polish`) solo cuentan entre `` `comillas` `` o como `/comando`, porque son palabras comunes.

## 2. Servidor (`vite.config.ts`)

Un complemento de Vite (`atlas-datos`) que funciona igual en `vite dev` y `vite preview`:

| Ruta | Qué hace |
|---|---|
| `GET /datos/*` | Sirve `datos/` leyendo del disco en cada pedido (evita el 404 que Vite da en carpetas de iCloud recién creadas). |
| `GET /adjunto/<vault>/<ruta>` | Sirve imágenes y archivos de un vault. Rechaza rutas que escapen del vault. |
| `POST /__atlas/regenerar` | Ejecuta el generador (una sola corrida a la vez) y devuelve su salida. |

En desarrollo además:

- Si no hay datos al arrancar, los genera antes de servir.
- Vigila el contenedor con `fs.watch` recursivo (FSEvents en macOS, barato aunque haya 40.000 archivos). Ignora `.obsidian`, `.git`, `.memoria-system` y `Graphify`. Agrupa cambios 8 s, regenera y manda el evento HMR `atlas:datos`; la página vacía su caché y vuelve a pedir los datos sin recargar.

## 3. Página (`src/`)

React 19 + TypeScript, sin enrutador ni gestor de estado externos.

| Pieza | Detalle |
|---|---|
| `lib/rutas.ts` | Enrutador por hash con `useSyncExternalStore`. Cada vista tiene URL: atrás/adelante y enlaces directos funcionan. |
| `lib/datos.ts` | Caché de promesas por archivo + versión global. `recargarDatos()` vacía la caché y re-renderiza a quien use `useDatos`. |
| `lib/markdown.ts` | `marked` con renderizador propio: callouts de Obsidian (anidables), enlaces `atlas:`, bloques Dataview/Bases etiquetados, tablas con desplazamiento. Todo pasa por DOMPurify. |
| `lib/tema.ts` | Tema oscuro («Observatorio») y claro («Carta»); colores equivalentes para el canvas, que no lee variables CSS. |
| `componentes/Grafo.tsx` | Envoltorio de `force-graph` (canvas). Los datos se recargan solo si cambia `clave`; foco y hover solo repintan. Encuadra a mitad del acomodo y al terminar. |
| `pantallas/Universo.tsx` | SVG a mano: CORE al centro, órbita elíptica, rayos con flujo animado, puentes curvos y el zodiaco. El anillo se reparte por **largo de arco real** para que cada categoría tenga espacio para su nombre; las etiquetas siguen la curva (`<textPath>`) arriba en sentido horario y abajo antihorario, para que nunca queden de cabeza. |
| `pantallas/Vault.tsx` | Grafo **estructurado**: raíz → carpetas → notas (enlaces fuertes) más enlaces entre notas (débiles). Con más de 1.200 notas los enlaces entre notas se apagan por defecto: si no, todo colapsa en un ovillo. |
| `componentes/Buscador.tsx` | MiniSearch sobre títulos, rutas, etiquetas, encabezados y extractos de todas las notas, más skills y agentes. Se construye la primera vez que se abre. |

### Diseño

- Tipografía: **Instrument Serif** (títulos editoriales), **Bricolage Grotesque** (interfaz) y **JetBrains Mono** (rutas, cifras y rótulos). Se empaquetan con Fontsource: funciona sin internet.
- Atmósfera de carta celeste: retícula fina que se desvanece, resplandor azul de CORE y grano. Acento latón para lo interactivo.
- Los colores de cada vault salen de `vaults.json` (los mismos que usa Obsidian).
- Respeta `prefers-reduced-motion`.

## Cómo extenderlo

- **Otra fuente de skills:** `ATLAS_SKILLS_EXTRA=/ruta/a/skills npm run dev`, o agrega la fuente en `CONFIG.fuentesSkills`.
- **Otro paquete de skills:** agrega una entrada a `PAQUETES` en `scripts/lib/skills.mjs`.
- **Otro campo de las notas:** agrégalo en `scripts/lib/vaults.mjs` (objeto de cada nota), en `src/lib/tipos.ts` (`Nota`) y documéntalo en [DATOS.md](DATOS.md).
- **Otra pantalla:** agrega la vista en `src/lib/rutas.ts`, el enlace en `SECCIONES` de `BarraSuperior.tsx` y el caso en `App.tsx`.
