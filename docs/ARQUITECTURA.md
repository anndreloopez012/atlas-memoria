# Arquitectura

El atlas tiene cuatro piezas:

1. Un **detector** que averigua qué tiene el equipo y lo deja en `atlas.config.json`.
2. Un **generador** que lee vaults, skills y agentes y escribe JSON.
3. Un **complemento de Vite** que sirve esos datos y los mantiene al día.
4. Una **página React** que los dibuja.

Encima de todo eso, un **instalador** pensado para que lo ejecute una IA.

```
instalar.sh / instalar.ps1 ─► scripts/instalar.mjs ─► detectar.mjs ─► atlas.config.json
                                      │                                      │
                                      ▼                                      ▼
                              verificar.mjs            vaults · skills · agentes ─► generar-datos.mjs ─► datos/*.json ─► /datos ─► React
                                                                ▲                         ▲                                    │
                                                                └── fs.watch (vite.config.ts) ┘◄──── POST /__atlas/regenerar ───┘
```

## 1. Instalación y detección

| Pieza | Responsabilidad |
|---|---|
| `instalar.sh`, `instalar.ps1` | Deja Node.js 20+ listo si falta y llama al instalador. En macOS usa Homebrew si ya existe; si no, fnm (o nvm si falta `unzip`), sin sudo. En Windows usa winget y recarga el PATH. El resto de su salida va a stderr para que `--json` quede limpio. |
| `scripts/entorno.sh` | Carga Node aunque se haya instalado con fnm o nvm en la misma sesión (lo usan `instalar.sh` e `iniciar.sh`). |
| `scripts/lib/detectar.mjs` | Detecta el equipo a partir de `home`, la plataforma y las variables de entorno: vaults (registro de Obsidian en macOS, Windows y Linux, incluido Flatpak y Snap, más búsqueda acotada en carpetas habituales), skills de cada IA y de plugins activos, agentes de usuario, plugins y proyectos, y un `.memoria-system` opcional. No escribe nada. |
| `scripts/lib/config.mjs` | Configuración efectiva: variables `ATLAS_*` > `atlas.config.json` > detección. Convierte `~` en rutas absolutas y al revés. |
| `scripts/instalar.mjs` | Detecta, mezcla con la configuración previa (respeta lo editado a mano, agrega lo nuevo y quita lo que ya no existe), aplica opciones (`--vault`, `--centro`…), escribe `atlas.config.json`, corre la verificación y genera los datos. Con `--json`, imprime un resumen para la IA. |
| `scripts/verificar.mjs` | Arma un HOME temporal con dos vaults, skills de tres IAs y un agente; corre detección y generación de punta a punta y comprueba enlaces, puentes, agrupación de skills, secretos y pendientes de traducción. Además revisa que las instrucciones para las IAs estén completas. |

### Decisiones

- **Registro primero.** Si Obsidian tiene registro (`obsidian.json`), se usan sus vaults: son los que la persona abre de verdad. Las otras carpetas con `.obsidian` encontradas al buscar se devuelven como **sugerencias** y la IA pregunta antes de agregarlas, porque pueden ser vaults viejos o carpetas `.obsidian` dentro de repositorios.
- **Búsqueda acotada.** Hasta 3 niveles desde Documentos, menos desde el directorio personal, sin entrar en `node_modules`, `Library`, `AppData` ni carpetas ocultas, y con tope de carpetas revisadas. Sigue enlaces simbólicos sin repetir destinos.
- **Plugins activos, no todos.** De Codex se leen los plugins con `enabled = true` en `config.toml` (su versión más reciente en la caché). De Claude Code, `installed_plugins.json` filtrado por `enabledPlugins`. Así no aparecen skills de plugins desactivados.
- **Centro.** Si hay `.memoria-system`, el primer vault de su registro. Si no, uno con nombre de centro (CORE, Inicio, Home, Hub…). Si no hay, al generar se elige el que más puentes tiene con los demás o, en su defecto, el más grande. Siempre se puede fijar con `--centro`.
- **Skills propias.** Son de la persona las skills que viven fuera de las carpetas de las IAs (en un repositorio o carpeta suya enlazada), más las que coinciden con `propias.cuentas` (dueño en GitHub) o `propias.patrones` (texto en el nombre).
- **Nada fijo de un equipo.** Ni rutas, ni nombres de vault, ni prefijos de usuario en el código. Las automatizaciones se muestran si su configuración toca las rutas de los vaults (o si su nombre coincide con un prefijo configurado).

## 2. Generador (`scripts/`)

Node puro (solo depende de `yaml`). Se ejecuta en unos 5 a 8 segundos para unas 4.000 notas y 250 skills.

| Módulo | Responsabilidad |
|---|---|
| `texto.mjs` | Frontmatter (YAML estricto con respaldo tolerante), encabezados, extracto, conteo de palabras, etiquetas en línea, extracción de enlaces y **ocultado de secretos**. |
| `vaults.mjs` | Recorre cada vault configurado, arma el árbol de carpetas, resuelve enlaces al estilo Obsidian, cuenta puentes entre vaults y **reescribe los enlaces** del contenido. Si hay `.memoria-system`, mezcla su registro (propósito, color, entradas, enrutado). |
| `skills.mjs` | Busca `SKILL.md` en las carpetas configuradas, agrupa por nombre, analiza la descripción (qué hace / cuándo / cuándo no / frases activadoras), lista archivos, detecta repositorio Git, paquete (familias conocidas y plugins), categoría, origen y menciones a otras skills. |
| `agentes.mjs` | Agentes (`.md` con frontmatter), automatizaciones (launchd con `plutil` en macOS; systemd de usuario y cron en Linux), docstrings y comandos del motor de memoria si existe. |
| `traduccion.mjs` | Diccionario al español (`traducciones/es.json`): `es(texto)` devuelve la traducción o anota el texto como pendiente; `esDocumento()` traduce markdown largo por piezas sin cortar bloques de código. |
| `generar-datos.mjs` | Orquesta todo, elige el centro, resume las fuentes detectadas, parte el contenido en bloques y escribe `datos/` de forma atómica: cada corrida usa su propia carpeta temporal y al final la intercambia. |

### Decisiones

- **Qué se omite.** Las subcarpetas de `carpetasGeneradas` (por defecto `Graphify`, que crea una nota por archivo de código) y sus notas `_COMMUNITY_*`. Se cuentan para que se sepa que existen, pero no se cargan: no son memoria escrita y harían el atlas inmanejable.
- **Resolución de enlaces.** Igual que Obsidian: ruta exacta → relativa a la carpeta de la nota → final de ruta → nombre de archivo (gana la ruta más corta). `[[nota\|alias]]` dentro de tablas se limpia. Los `obsidian://open?vault=X&file=Y` se resuelven contra el vault X: así se cuentan los **puentes**.
- **Enlaces reescritos.** En el contenido, `[[Nota]]` pasa a `[Título](atlas:<id>)` y los enlaces rotos a `atlas-roto:`. Las imágenes incrustadas (`![[foto.png]]`) apuntan a `/adjunto/<vault>/<ruta>`. Así el navegador no necesita volver a resolver nada.
- **Identificadores estables.** El id de una nota es `sha1("<VAULT>/<ruta>")` recortado a 10 caracteres: no cambia entre regeneraciones, por eso los enlaces del navegador (`#/v/<vault>/<id>`) siguen sirviendo.
- **Contenido en bloques.** El índice de cada vault (metadatos, enlaces, extracto) se carga de una vez; el texto completo va en bloques de unos 450 KB que se piden solo al abrir una nota.
- **Notas relacionadas.** Una skill se relaciona con las notas (de cualquier vault) que se llaman como ella o como `<IA> - <skill>`; un agente, con las notas que lo mencionan. Se guardan como referencias `{ id, vault, título }` para no cargar el vault entero.
- **Secretos.** Se reemplazan por `[oculto]` antes de escribir cualquier archivo. Los patrones ignoran valores que son código (`process.env.X`, `z.string()`, `req.body`) para no romper ejemplos.
- **Todo en español.** Cada texto descriptivo pasa por `es()`. Se detecta el idioma con listas cortas de palabras frecuentes: ante la duda se pide traducción (si ya estaba en español, vuelve igual). Las descripciones se traducen **oración por oración**, así la descripción completa y sus partes («qué hace», «cuándo», «cuándo no») comparten traducciones. La clave del diccionario es la huella SHA-1 del original: si el texto cambia, se vuelve a pedir; si no, nunca se traduce dos veces. Los manuales completos solo se piden con `ATLAS_TRADUCIR_MANUALES=1`. `scripts/traducir.mjs` completa lo pendiente con `claude -p` (o por lotes, para que lo traduzca cualquier IA) y guarda el diccionario con las claves ordenadas para que los cambios sean legibles en git.
- **Skills duplicadas.** La misma skill puede estar en varias IAs (a veces con enlace simbólico al mismo repositorio). Se agrupan por nombre; el contenido sale de la instalación preferida (primero las que no vienen de un plugin; luego Claude → Codex → Antigravity → compartidas) y se listan todas las rutas.
- **Menciones entre skills.** Los nombres compuestos (`web-inmersiva`) se buscan tal cual; los de una palabra (`layout`, `audit`, `polish`) solo cuentan entre `` `comillas` `` o como `/comando`, porque son palabras comunes.

## 3. Servidor (`vite.config.ts`)

Un complemento de Vite (`atlas-datos`) que funciona igual en `vite dev` y `vite preview`. El puerto sale de `ATLAS_PUERTO`/`PORT`, de `atlas.config.json` o es 5190.

| Ruta | Qué hace |
|---|---|
| `GET /datos/*` | Sirve `datos/` leyendo del disco en cada pedido (evita el 404 que Vite da en carpetas sincronizadas recién creadas). |
| `GET /adjunto/<vault>/<ruta>` | Sirve imágenes y archivos de un vault. Las rutas de los vaults salen de `datos/atlas.json`. Rechaza rutas que escapen del vault. |
| `POST /__atlas/regenerar` | Ejecuta el generador (una sola corrida a la vez) y devuelve su salida. |
| `POST /__atlas/tarea` | Marca una tarea como hecha: `{ s: slug del vault, r: ruta de la nota, l: línea, h: huella }`. Solo cambia la casilla de esa línea y solo si la huella coincide (busca hasta 30 líneas arriba y abajo por si la nota se movió); si no, responde 409 sin tocar nada. La lógica está en `scripts/lib/tareas.mjs` (`marcarHecha`) y la prueba `npm run verificar`. |

En desarrollo además:

- Si no hay datos al arrancar, los genera antes de servir.
- Vigila **cada vault** con `fs.watch` recursivo (FSEvents en macOS, ReadDirectoryChangesW en Windows, inotify en Linux) y `atlas.config.json` con `fs.watchFile`. Ignora carpetas ocultas y las generadas. Agrupa cambios 8 s, regenera, vuelve a armar los vigías si cambió la lista de vaults y manda el evento HMR `atlas:datos`; la página vacía su caché y vuelve a pedir los datos sin recargar.

## 4. Página (`src/`)

React 19 + TypeScript, sin enrutador ni gestor de estado externos. Todo lo que depende del equipo (centro, número de vaults, IAs, fuentes) sale de los datos.

| Pieza | Detalle |
|---|---|
| `lib/rutas.ts` | Enrutador por hash con `useSyncExternalStore`. Cada vista tiene URL; `#/v` sin vault abre el central. |
| `lib/datos.ts` | Caché de promesas por archivo + versión global. `recargarDatos()` vacía la caché y re-renderiza a quien use `useDatos`. |
| `lib/atlas.ts` | Ayudas que dependen del equipo: vault central, vault por nombre, ruta de una nota en el disco. |
| `lib/markdown.ts` | `marked` con renderizador propio: callouts de Obsidian (anidables), enlaces `atlas:`, bloques Dataview/Bases etiquetados, tablas con desplazamiento. Todo pasa por DOMPurify. |
| `lib/tema.ts` | Tema oscuro («Observatorio») y claro («Carta»); colores equivalentes para el canvas, que no lee variables CSS. |
| `lib/formato.ts` | Números, fechas, color e inicial de cada IA (las desconocidas reciben un color estable) y números en palabras. |
| `componentes/Grafo.tsx` | Envoltorio de `force-graph` (canvas), cargado aparte (`React.lazy`) porque es lo más pesado. Los datos se recargan solo si cambia `clave`; foco y hover solo repintan. El acomodo se **precalcula** antes del primer cuadro (`warmupTicks`, menos iteraciones en grafos grandes) y se encuadra enseguida; las posiciones finales se guardan por `clave` y al volver el grafo aparece quieto donde quedó. Extras: **territorios** (una fuerza junta cada nodo con el centro de su grupo y se dibuja un halo con el nombre detrás), enlaces curvos, brillo en los nodos más conectados y destellos sobre los enlaces del nodo enfocado. Las fuerzas reciben los dos nodos de cada enlace, así el que lo usa puede dar más espacio a los grupos grandes. |
| `pantallas/Universo.tsx` | SVG a mano: el núcleo con su interfaz holográfica (`HudNucleo`: barrido, marcas, anillos segmentados y lecturas ubicadas entre los haces), un cerebro por vault en órbita elíptica (los grandes se alejan un poco para no tapar las lecturas), haces nerviosos con impulsos, puentes curvos y el zodiaco. En pantallas angostas cambia el `viewBox` para encuadrar los cerebros. El anillo se reparte por **largo de arco real** para que cada categoría tenga espacio para su nombre; las etiquetas siguen la curva (`<textPath>`), arriba en sentido horario y abajo antihorario, para que nunca queden de cabeza. |
| `lib/neuronas.ts` | Generador de cerebros: silueta lateral de un cerebro humano y sus surcos en coordenadas normalizadas; neuronas por muestreo «mejor candidato» dentro de la silueta y lejos de los surcos (así los surcos se leen como huecos); sinapsis con las vecinas más cercanas sin cruzar surcos; lóbulos repartidos por punto más lejano; fibras entre lóbulos; dendritas; caminos de impulsos y chispas. Todo con un azar con semilla (el vault) y guardado en memoria: el mismo vault dibuja siempre el mismo cerebro. `neuronasPara(notas)` da la cantidad (crece con la raíz de las notas, con mínimo y tope). |
| `componentes/CerebroNeuronal.tsx` | Dibuja un cerebro dentro de cualquier `<svg>`: lo escala al tamaño pedido y convierte los grosores para que no dependan de la escala. Las animaciones son CSS (`dibujar`, `encender`, `chispa`, `impulso`) y respetan `prefers-reduced-motion`. Se usa en el Universo, en la portada del vault y, solo con la silueta, en el carril de vaults. |
| `pantallas/Vault.tsx` | Portada, carpetas, las tres vistas y el lector. La Constelación es un grafo **estructurado**: raíz → carpetas → notas (enlaces fuertes) más enlaces entre notas (débiles). Cada carpeta lleva su **peso** (notas que cuelgan de ella): se aleja de su madre según √peso y sus notas quedan pegadas a ella, así cada carpeta forma un racimo. Con más de 1.200 notas los enlaces entre notas se apagan por defecto: si no, todo colapsa en un ovillo. |
| `componentes/vault/PortadaVault.tsx` | Cerebro del vault (`OrbeVault`, con retícula holográfica), propósito, entradas, etiquetas, cifras, pulso semanal y barra de puentes. |
| `componentes/vault/MapaCarpetas.tsx` | Círculos anidados con `d3-hierarchy` (`pack`). Los círculos se generan una vez por vault y filtro; el zoom solo cambia la transformación de un grupo (`requestAnimationFrame`), así miles de notas no se vuelven a renderizar. Un clic baja un nivel (al hijo directo del foco que contiene el punto). |
| `componentes/vault/Actividad.tsx` | Calendario de calor del último año en SVG (escala logarítmica: una importación masiva no apaga los demás días) y línea de tiempo agrupada por cercanía, de a 120 notas, con `content-visibility` para no pintar lo que no se ve. |
| `componentes/vault/Vecindario.tsx` | Mapa SVG de una nota: la citan (izquierda), enlaza (derecha), puentes (abajo). |
| `lib/actividad.ts` | Cálculos de fechas: día local, pulso semanal, calendario (semanas que empiezan en lunes), grupos «Hoy», «Ayer»… |
| `pantallas/Sistema.tsx` | Diagrama del flujo y fuentes detectadas. Con `.memoria-system`, también su enrutado, motor y comandos. |
| `componentes/CentroMando.tsx` | El centro de mando (⌘K): MiniSearch sobre títulos, rutas, etiquetas, encabezados y extractos de todas las notas, más skills (también por su descripción original) y agentes. Todo se arma como **filas** (resultado, destino o acción) agrupadas; sin texto muestra recientes, destinos y acciones. Las funciones nuevas entran como filas o grupos, no como botones en la interfaz. Cualquier pantalla puede abrirlo con `abrirCentro(texto)`. |
| `pantallas/Hoy.tsx` | Lo que importa ahora. Novedades desde la última visita: notas propias por vault (con «nueva» si se creó en ese lapso), skills y agentes nuevos, y aparte, plegado, lo que actualizaron las herramientas solas. |
| `pantallas/Tareas.tsx`, `componentes/FilaTarea.tsx` | Vista completa de pendientes (`#/hoy/tareas`) y la fila de cada tarea, que marca la casilla con `POST /__atlas/tarea`. |
| `pantallas/Proyectos.tsx` | Tarjeta de Hoy con los proyectos más activos y la vista completa `#/hoy/proyectos` (buscador y filtro por estado). Los datos salen de `scripts/lib/proyectos.mjs`. |
| `lib/favoritos.ts`, `componentes/EstrellaFavorito.tsx` | Favoritos en `localStorage` con aviso entre componentes (`useSyncExternalStore`) y entre pestañas (evento `storage`). |
| `componentes/Recorrido.tsx` | Recorrido guiado de cinco pasos: se muestra solo la primera vez y se repite con el evento `atlas:recorrido` (acción del centro de mando). Ilumina cada parte con una caja y una sombra enorme; si la parte no está a la vista, la tarjeta va al centro. |
| `lib/visita.ts` | Recuerda en el navegador cuándo fue la visita anterior: una visita termina tras 30 minutos sin usar el atlas, así recargar no borra las novedades. Sin almacenamiento, Hoy muestra los últimos 7 días. |
| `lib/recientes.ts` | Lo último que abriste (notas, skills, agentes), en `localStorage` de este navegador; si no se puede guardar, no recuerda. |
| `pantallas/Sistema.tsx` | Pestañas «Cómo trabaja» y «Agentes» (`#/sistema`, `#/sistema/agentes`; `#/agentes` lleva a la misma pestaña y la ficha de cada agente conserva `#/agentes/<id>`). |

### Diseño

- Tipografía: **Instrument Serif** (títulos editoriales), **Bricolage Grotesque** (interfaz) y **JetBrains Mono** (rutas, cifras y rótulos). Se empaquetan con Fontsource: funciona sin internet.
- Atmósfera de carta celeste: retícula fina que se desvanece, resplandor azul del centro y grano. Acento latón para lo interactivo.
- Los colores de cada vault salen del sistema de memoria o de `atlas.config.json`; si no hay, de una paleta fija.
- Respeta `prefers-reduced-motion`.
- Rendimiento: las pantallas que no son el Universo y el grafo se cargan aparte, solo cuando se usan; el mapa y la actividad evitan volver a renderizar lo que no cambia.
- En el teléfono (≤ 760 px) la página del vault se desplaza: portada arriba, lienzo con alto propio y el lector a pantalla completa.

## Cómo extenderlo

- **Otra carpeta de skills o agentes en un equipo:** `npm run instalar -- --skills "IA=ruta"` o `--agentes "IA=ruta"`.
- **Que la detección encuentre algo nuevo para todos** (una IA nueva, otra ubicación estándar): agrega la candidata en `scripts/lib/detectar.mjs`, un caso en `scripts/verificar.mjs` y documenta la ubicación en el README y en AGENTS.md.
- **Otro paquete de skills:** agrega una entrada a `PAQUETES` en `scripts/lib/skills.mjs`.
- **Otro campo de las notas:** agrégalo en `scripts/lib/vaults.mjs`, en `src/lib/tipos.ts` (`Nota`) y en [DATOS.md](DATOS.md).
- **Otra pantalla:** agrega la vista en `src/lib/rutas.ts`, el enlace en `secciones()` de `BarraSuperior.tsx` y el caso en `App.tsx`.
