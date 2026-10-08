# Atlas de memoria

Una página interactiva para **ver y recorrer toda tu memoria en un solo lugar**: tus vaults de Obsidian (con un vault central del que nacen los demás), las **skills** de Claude Code, Codex y Antigravity, y los **agentes** que trabajan por ti. Sirve para recordar qué hace cada pieza, leer cualquier nota y moverte entre vaults de forma gráfica.

Se instala en cualquier computadora (macOS, Windows o Linux) y **se acopla a lo que tenga cada persona**: encuentra sola sus vaults, sus skills y sus agentes. Corre en tu equipo, no sube nada a internet y se mantiene sincronizado: si cambias una nota en Obsidian, el atlas se actualiza en segundos.

---

## Descargar e instalar (sin terminal)

1. Descarga el último **`atlas-memoria-vX.Y.Z.zip`** de [Releases](https://github.com/anndreloopez012/atlas-memoria/releases/latest) y descomprímelo.
2. Haz **doble clic** en el instalador de tu sistema:

| Sistema | Instalador | La primera vez |
|---|---|---|
| macOS | `Instalar en Mac.command` | macOS avisa que es de un desarrollador no identificado: ve a **Ajustes del Sistema › Privacidad y seguridad › Abrir igualmente** (o clic derecho › Abrir). |
| Windows | `Instalar en Windows.cmd` | Si aparece «Windows protegió tu PC», elige **Más información › Ejecutar de todas formas**. |
| Linux | `Instalar en Linux.sh` | Clic derecho › **Ejecutar como programa** (o `bash "Instalar en Linux.sh"`). |

El instalador copia la app a una carpeta fija (puedes borrar la descarga), instala Node.js si falta, encuentra tus vaults, skills y agentes, crea el acceso **«Atlas de memoria»** con su ícono y lo abre en tu navegador.

**Desde ahí, ábrelo con doble clic** en «Atlas de memoria» (macOS: Aplicaciones y Escritorio · Windows: Escritorio y menú Inicio · Linux: menú de aplicaciones y Escritorio). Cada vez que lo abres **busca cambios** en tus vaults de Obsidian, tus skills y tus agentes (y ubicaciones nuevas), los sigue vigilando mientras lo usas y **se apaga solo** unos minutos después de cerrar la pestaña. No quedan ventanas abiertas.

**Actualizaciones:** al abrirse, la app revisa (dos veces al día como mucho) si hay una versión nueva en Releases. Si la hay, aparece «Versión X» en la barra: ábrelo, lee qué trae y toca **Actualizar ahora**; se descarga, se instala sin tocar tu configuración, tus datos ni tus vaults, se reinicia y la página se recarga sola. También: `npm run actualizar`. Con el repositorio privado, solo funciona para quien tenga acceso (GitHub no publica las versiones de un repositorio privado).

## Instalar con IA

Abre **Claude Code**, **Codex** o **Antigravity** y escribe:

```text
Instala este repositorio: https://github.com/anndreloopez012/atlas-memoria
```

La IA hace todo:

1. Clona el repositorio.
2. Instala lo que falte en el equipo (Node.js y dependencias).
3. Detecta tus vaults, skills, agentes y automatizaciones.
4. Verifica que funcione, traduce al español lo que haga falta, crea el acceso de doble clic **«Atlas de memoria»** y te lo deja abierto en <http://localhost:5190>.

Solo te pregunta si no encuentra tus vaults o si hay carpetas dudosas.

| Si eres… | Lee |
|---|---|
| La IA que va a instalar | [AGENTS.md](AGENTS.md) (Codex y Antigravity lo leen solos; [CLAUDE.md](CLAUDE.md) y [GEMINI.md](GEMINI.md) lo importan). Skill: `/instalar-atlas`. |
| Una persona que quiere hacerlo a mano o entender los pasos | [INSTALAR.md](INSTALAR.md) |

A mano, en dos comandos (macOS / Linux; en Windows `instalar.ps1` e `iniciar.ps1`):

```bash
bash instalar.sh
```

```bash
bash iniciar.sh
```

> El repositorio es privado: para compartirlo, agrega a la persona como colaboradora en GitHub. Su IA clonará con su propia sesión.

---

## Índice

- [Qué puedes hacer](#qué-puedes-hacer)
- [Cómo se acopla a cada equipo](#cómo-se-acopla-a-cada-equipo)
- [Comandos](#comandos)
- [Cómo se mantiene sincronizado](#cómo-se-mantiene-sincronizado)
- [Todo en español](#todo-en-español)
- [Privacidad](#privacidad)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Arquitectura](#arquitectura)
- [Flujo de trabajo con Git](#flujo-de-trabajo-con-git)
- [Atajos](#atajos)
- [Solución de problemas](#solución-de-problemas)

---

## Qué puedes hacer

### Universo (`#/`)
El mapa completo como **una sola mente**: cada vault es un **cerebro de neuronas** que crece con sus notas (más notas, cerebro más grande y más neuronas). **Tu vault central es el núcleo**, rodeado de una interfaz holográfica al estilo JARVIS (anillos que giran, marcas de escala, barrido de radar y lecturas con las cifras del atlas), y los demás vaults **nacen de él** unidos por haces nerviosos por los que viajan impulsos. El centro se elige solo: un vault llamado CORE, Inicio o Home; si no hay, el que más enlaces tiene con los otros. También se puede fijar.

- Cada cerebro tiene su silueta y sus surcos, sinapsis entre neuronas vecinas, dendritas, chispas que se encienden al azar e impulsos que recorren las conexiones. Las **neuronas grandes son las carpetas principales** (lóbulos): pasa el cursor para ver cuál es y haz clic para entrar directo a esa carpeta.
- Al pasar sobre un vault, su retícula se fija, los demás se atenúan y aparece su ficha del lado contrario.
- Las curvas doradas son los **puentes**: enlaces de un vault a otro. Pasa el cursor para ver cuántos hay en cada sentido.
- El **anillo exterior** es el zodiaco de tus skills (un punto por skill, agrupadas por categoría) y tus agentes (rombos). Los puntos con borde dorado son skills tuyas.
- Debajo, el **árbol de vaults**: el centro como tronco y una rama por vault, con propósito, cifras y carpetas.
- Funciona con un vault, con muchos o con ninguno (en ese caso muestra tus skills y agentes), en tema claro u oscuro y en el teléfono (se encuadran los cerebros).

### Hoy (`#/hoy`)
Lo que importa ahora, en una sola página tranquila:

- **Lo nuevo desde tu última visita**: las notas que escribiste o editaste, agrupadas por vault (con «nueva» si es recién creada), y las skills y agentes que llegaron o cambiaron. La primera vez muestra los últimos 7 días.
- Lo que tus herramientas actualizaron solas (reportes, fichas, cambios en lote) queda aparte y plegado, para que no tape lo tuyo.
- Un punto discreto junto a «Hoy» en la barra avisa cuando hay algo nuevo.
- **Pendientes**: las tareas (`- [ ]`) de todas tus notas, con su fecha (`📅 2026-10-12` o `[due:: …]`) y prioridad (⏫ 🔼 🔽) al estilo del complemento Tasks. En Hoy aparecen las más urgentes; `#/hoy/tareas` las muestra todas, agrupadas en vencidas, hoy, esta semana, más adelante y sin fecha (por nota), con un buscador y filtro por vault. Se omiten las plantillas y el código, y las de notas que reescriben tus herramientas quedan aparte.
- **Proyectos**: los más activos en Hoy y todos en `#/hoy/proyectos`, cada uno con su última actividad y las entradas recientes de su historia (bitácora, decisiones, cambios). Un proyecto es una nota con `tipo: proyecto` (o `proyecto-moc`, `project`) y su historia son las notas con `proyecto: <nombre>`. Si tienes un sistema de memoria con semáforo, se muestra su estado (al día, por revisar, con problemas, archivado) y el motivo.
- **Marcar como hecha** desde el atlas: el servidor cambia solo la casilla de esa línea (`[ ]` → `[x]`) después de comprobar que la línea sigue igual; si la nota cambió, no toca nada y lo avisa.

### Favoritos y recorrido
- La **estrella** junto a una nota (en el lector), una skill o un agente los guarda en favoritos: aparecen arriba en Hoy y en el centro de mando. Se guardan en el navegador.
- La primera vez que abres el atlas, un **recorrido** de cinco pasos muestra cómo se usa (`Esc` para saltarlo). Se repite desde el centro de mando: «Ver el recorrido».

### Vaults (`#/v/<vault>`)
Cada vault tiene una **portada**: el vault dibujado como su cerebro de neuronas dentro de una retícula (las neuronas grandes son las carpetas principales), su lugar respecto al centro, su propósito, sus notas de entrada, sus etiquetas principales (un clic filtra por ellas) y un tablero con cifras, el **pulso** de las últimas 26 semanas y la barra de **puentes** con cada vault vecino. El carril de arriba salta a cualquier otro vault.

Debajo, el vault se puede ver de tres formas (la elegida se recuerda):

| Vista | Qué muestra |
|---|---|
| **Constelación** | Red viva: cada carpeta principal forma su propio racimo con un halo y su nombre (su **territorio**), los nodos más conectados brillan y, al abrir una nota, unos destellos recorren sus enlaces. Aparece ya acomodada y recuerda la posición de lo que ya viste. |
| **Mapa** | Carpetas dentro de carpetas como círculos anidados: un clic entra un nivel con zoom, clic afuera sube, y la ruta queda arriba como migas. Al acercarse se leen los títulos de las notas. |
| **Actividad** | Calendario de calor del último año (clic en un día para ver solo lo que cambió) y la línea de tiempo de notas agrupadas en Hoy, Ayer, Esta semana, Este mes y por mes. |

- **Carpetas** a la izquierda (en el teléfono, una fila de chips) con una barra que muestra el peso de cada una. La carpeta elegida queda en la URL y manda en las tres vistas.
- **Filtro** por título, carpeta o `#etiqueta`.
- **Lector**: la nota renderizada (callouts, tablas, tareas, imágenes del vault), sus propiedades, índice, una barra de progreso de lectura y su **vecindario**: un mapa chico con quién la cita (izquierda), a qué enlaza (derecha) y sus puentes con otros vaults (abajo); cada punto lleva a esa nota. `Esc` lo cierra.
- **Camino entre notas**: bajo el vecindario, «¿Cómo se conecta con otra nota?» busca cualquier nota de cualquier vault y muestra el camino más corto de enlaces entre las dos, paso a paso (cada paso se puede abrir). Si no hay camino, lo dice.
- Los enlaces dentro de una nota llevan a la nota destino, **aunque esté en otro vault**.
- «Abrir en Obsidian» abre la misma nota en la app.
- Funciona igual en el teléfono (la página se desplaza y el lector ocupa la pantalla), en tema claro u oscuro y con vaults de miles de notas.

### Skills (`#/skills`)
Catálogo de todas las skills del equipo, de **Claude Code, Codex y Antigravity**: las instaladas, las de la carpeta compartida `~/.agents/skills`, las que traen los **plugins activos** y las de sistema. Se agrupan por nombre: una skill instalada en tres IAs aparece una vez, con las tres insignias.

- **¿Qué skill uso para…?** Escribe la tarea con tus palabras («un video de lanzamiento», «cobrar con tarjeta») y la lista se ordena por cuánto encaja cada skill, con el motivo (la frase de la skill que más se parece a lo que pides). Funciona sin internet y entiende pedidos en español aunque la skill esté descrita en inglés. Si nada encaja de verdad, no inventa.
- Una fila de categorías; IA, origen (propias, instaladas, de plugins, sistema), paquete y uso quedan en «Más filtros».
- **Uso real**: cuántas veces usaron tus IAs cada skill en los últimos 180 días y cuándo fue la última, leyendo los historiales locales de Claude Code (cada llamada a la herramienta Skill o `/<skill>`) y Codex (cada sesión que lee su `SKILL.md`). Arriba aparecen **las que más usas**, cada tarjeta lleva su conteo y «Más filtros › Nunca usadas» ayuda a limpiar. Solo se guardan conteos y fechas, nunca el contenido de las conversaciones, y nada sale del equipo. Se desactiva con `"uso": false` en `atlas.config.json` o `ATLAS_USO=0`.
- Vista **Red**: qué skill menciona a cuál y qué agentes las usan.
- **Ficha de cada skill** (`#/skills/<nombre>`):
  - **Para qué sirve**, **cuándo se activa** (con las frases que la despiertan) y **cuándo no usarla**.
  - **Cómo pedirla**: el pedido listo para copiar en cualquier IA y, si está en Claude Code, su atajo `/<nombre>`.
  - **Cómo trabaja**, paso a paso: tu pedido → la IA la elige → lee el manual → consulta referencias → ejecuta scripts → usa plantillas → entrega.
  - Las secciones del manual con su resumen, el `SKILL.md` completo y cada archivo de referencia legible en un visor.
  - Dónde está instalada, su repositorio en GitHub, skills con las que trabaja, agentes que la usan y las notas de tus vaults que hablan de ella.

### Sistema (`#/sistema`)
Cómo funciona todo y quién lo hace, en pestañas:

- **Cómo trabaja**: el flujo completo, de dónde **entra** el conocimiento, quién lo **procesa**, dónde **vive** y quién lo **consulta**, más la lista de **fuentes que el atlas encontró** en el equipo. Si usas un sistema de memoria multi-vault (`.memoria-system`), muestra además su motor, sus reglas de enrutado y sus comandos.
- **Salud** (`#/sistema/salud`): chequeos para mantener todo en orden, cada uno en verde si está bien o con su lista para revisar: enlaces rotos, adjuntos que faltan, títulos repetidos, notas vacías, notas sueltas (sin enlaces), notas olvidadas (más de un año sin cambios y sin citas), skills con versiones distintas entre IAs, skills sin descripción, skills sin uso y textos sin traducir. Las notas que mantienen tus herramientas no se revisan.
- **Agentes** (`#/sistema/agentes`):
  - **Agentes de IA** (subagentes de Claude Code, Codex y Antigravity, del usuario, de proyectos y de plugins): para qué sirven, cuándo se les delega, sus herramientas, modelo, skills que usan y sus instrucciones completas.
  - **Automatizaciones** que trabajan sobre tus vaults (launchd en macOS, systemd y cron en Linux): cada cuánto corren, qué vigilan, qué script ejecutan, dónde dejan registro y cómo pausarlas.

### Centro de mando
El botón **Buscar o pedir** (o `⌘K`, o `/`) es el único lugar para hacer cosas, así la interfaz no se llena de botones:

- Escribe y busca entre todas las notas, las skills y los agentes a la vez. Si describes una tarea, primero aparecen las **skills para eso**.
- Sin escribir nada muestra tus **favoritos**, lo **último que abriste**, a dónde ir y las **acciones** (exportar la vista, ver el recorrido, cambiar el tema, actualizar los datos).
- **Preguntar a tu memoria**: escribe una pregunta («¿qué decidimos sobre…?») y elige «Preguntar a tu memoria». El atlas busca las notas que mejor la responden y, si hay una IA instalada en el equipo (Claude Code, Codex o Gemini CLI, en ese orden, o la que fijes con `"preguntar": { "ia": "codex" }`), le pide que responda **solo con esas notas** y que las cite como [1], [2]… Se envían a esa IA la pregunta y esas notas, y la pantalla lo avisa. Si una IA no tiene la sesión iniciada se prueba la siguiente; sin IA, muestra las notas que responden. `"ia": "ninguna"` lo deja siempre en modo notas.
- **Capturar**: escribe una idea y elige «Guardar … como nota nueva» (o empieza con `+` para ir directo). Si tienes un sistema de memoria con `memoria capturar`, la clasifica y la deja en su bandeja; si no, se guarda en `Bandeja/` del vault central (`"captura": { "vault": "…", "carpeta": "…" }` lo cambia). Dice dónde quedó, ofrece abrirla en Obsidian y aparece en el atlas en segundos.
- **Voz**: si el navegador sabe reconocer voz, aparece un micrófono. Di «abre Programación», «ve a las tareas», «busca Stripe», «qué skill uso para cobrar con tarjeta», «pregúntale qué decidimos sobre…» o «anota llamar a Pedro» (la captura queda lista para confirmar con ↵). El reconocimiento lo hace el navegador: en Chrome el audio pasa por el servicio de Google y en Safari por el de Apple.
- **Exportar esta vista como imagen** (acción): guarda un PNG de lo que estás viendo (el Universo completo, el vault con su vista actual o la página) para compartirlo. Incluye las tipografías y el grafo.
- Las funciones nuevas se suman aquí como grupos o acciones.

---

## Cómo se acopla a cada equipo

El instalador detecta lo que hay y lo guarda en `atlas.config.json`. Ese archivo es local, no se sube a git, y se puede editar a mano: [docs/CONFIGURACION.md](docs/CONFIGURACION.md).

| Qué | Dónde lo busca |
|---|---|
| Vaults de Obsidian | El registro de Obsidian (macOS, Windows y Linux, incluido Flatpak y Snap); si no existe, carpetas con `.obsidian` en Documentos, Escritorio, Dropbox, OneDrive e iCloud |
| Skills de Claude Code | `~/.claude/skills` y los plugins activos de Claude Code |
| Skills de Codex | `$CODEX_HOME/skills` (o `~/.codex/skills`, incluido `.system`) y los plugins activos de `config.toml` |
| Skills de Antigravity | `~/.gemini/config/skills`, `~/.gemini/antigravity/skills`, `~/.gemini/skills` y las incluidas de fábrica |
| Skills compartidas | `~/.agents/skills` (estándar abierto que leen varias IAs) |
| Agentes | `~/.claude/agents`, `~/.codex/agents`, `~/.gemini/agents`, agentes de plugins y `<proyecto>/.claude/agents` (y equivalentes) en tus carpetas de proyectos |
| Automatizaciones | launchd (macOS), systemd de usuario y cron (Linux) que tocan las rutas de tus vaults |
| Sistema de memoria | Una carpeta `.memoria-system/` junto a tus vaults (opcional) |

Lo que no se detecta se agrega con una opción: `--vault`, `--skills`, `--agentes`, `--centro`… (ver [INSTALAR.md](INSTALAR.md#3-ajustar-si-hace-falta)).

---

## Comandos

| Comando | Qué hace |
|---|---|
| `bash instalar.sh` · `instalar.ps1` | Instalación o actualización completa: Node.js si falta, dependencias, detección, verificación y datos. |
| `bash iniciar.sh` · `iniciar.ps1` | Abre el atlas con sincronización en vivo (si no está instalado, lo instala primero). |
| `npm run instalar -- <opciones>` | El instalador sin el paso de Node.js; con opciones para ajustar vaults, skills, agentes, centro y puerto. |
| `npm run detectar` | Vuelve a buscar vaults, skills y agentes nuevos y actualiza la configuración. |
| `npm run datos` | Vuelve a leer todo y reescribe `datos/`. |
| `npm run actualizar` | Instala la versión nueva publicada en Releases, si la hay (`-- --buscar` solo avisa). Una copia con git se actualiza con `git pull`. |
| `npm run traducir` | Traduce al español los textos nuevos (ver [Todo en español](#todo-en-español)). |
| `npm run verificar` | Prueba de humo en un equipo falso más una revisión de las instrucciones para IAs. No toca tus datos. |
| `npm run dev` | Servidor de desarrollo (lo que usa `iniciar`). |
| `npm start` | Compila y sirve la versión optimizada (sin vigilancia en vivo; usa el botón de actualizar). |
| `npm run build` | Revisa tipos y compila en `dist/`. |

---

## Cómo se mantiene sincronizado

1. **Al abrir:** el acceso de doble clic busca ubicaciones nuevas (vaults, carpetas de skills y de agentes), abre el navegador con lo último que tenía y vuelve a leer todo en segundo plano; la página se actualiza sola (en la barra se ve «buscando cambios…»).
2. **En vivo:** mientras el atlas está abierto (doble clic, `iniciar` o `npm run dev`), el servidor vigila tus vaults, las carpetas de **skills** (un `SKILL.md` nuevo o editado) y de **agentes** de todas las IAs detectadas, y `atlas.config.json`. Cuando algo cambia, espera 8 segundos para agrupar los guardados, regenera el atlas y avisa al navegador, que recarga los datos sin perder la vista. Una nota, skill o agente nuevo aparece solo en unos 15-20 segundos.
3. **Bajo pedido:** el botón de la barra superior (muestra «hace X min») o «Actualizar los datos ahora» en el centro de mando vuelve a leer todo.
4. **Ubicaciones nuevas** (un vault nuevo, otra IA o un plugin recién activado con su propia carpeta de skills): `npm run detectar` las agrega.
5. **Desde la terminal:** `npm run datos`.

Los datos generados viven en `datos/` y **no se suben a Git**: son contenido personal y cambian a cada rato. El repositorio solo guarda el código que los genera y los dibuja.

---

## Todo en español

Todo texto descriptivo se muestra **en español**: descripciones, «para qué sirve», «cuándo se activa», títulos y resúmenes de las secciones de cada manual, títulos de las referencias, instrucciones de los agentes, docstrings y metadatos. En inglés solo quedan los **nombres** de vaults, skills y agentes, además del código, los comandos y las rutas.

Cómo funciona:

1. El generador detecta qué textos no están en español y busca su traducción en `traducciones/es.json`, que se versiona. La clave es la huella del texto original: si una skill cambia su descripción, ese texto vuelve a quedar pendiente.
2. Lo que falta se anota en `datos/pendientes-traduccion.json` y se cuenta en Sistema › Cómo trabaja.
3. `npm run traducir` lo traduce con Claude Code (`claude -p`, modelo Sonnet, 3 lotes a la vez) y regenera los datos.

`claude -p` no puede abrirse dentro de otra sesión de Claude Code. Desde una sesión de Claude (o desde Codex o Antigravity), la IA traduce los lotes ella misma:

| Opción | Uso |
|---|---|
| `npm run traducir -- --lotes <carpeta>` | Parte lo pendiente en `lote-NN.json` para traducirlo aparte. |
| `npm run traducir -- --importar <carpeta>` | Incorpora los `resultado-NN.json` (`{ clave: traducción }`) al diccionario y regenera. |
| `--modelo opus` · `--paralelo 5` · `--tamano 20000` | Ajustes del traductor automático. |

Las traducciones se comparten: lo que ya se tradujo en un equipo sirve para todos los que tengan esas skills.

**Manuales completos.** El texto íntegro de cada `SKILL.md` y de sus referencias es el documento que lee la IA; se muestra tal cual, marcado como «texto original», y su resumen en español aparece en la ficha. Para traducir también los manuales completos:

```bash
ATLAS_TRADUCIR_MANUALES=1 npm run traducir
```

Las notas de los vaults son tus propios archivos: el atlas las muestra como están.

---

## Privacidad

- Todo corre en tu equipo: no hay servidor externo ni analítica.
- `datos/` y `atlas.config.json` no se suben a git.
- Antes de escribir los datos, el generador **oculta** cualquier valor con forma de secreto: llaves privadas; tokens de Stripe, GitHub, AWS, Google, Slack, OpenAI y Anthropic; JWT; y pares `password=…` o `token: …`. En la página aparecen como `[oculto]` y el total se muestra en Sistema › Cómo trabaja.
- El servidor solo sirve archivos que estén dentro de `datos/` o de un vault configurado (no se puede escapar con `../`).

---

## Estructura del proyecto

```
atlas-memoria/
├── AGENTS.md · CLAUDE.md · GEMINI.md   # instrucciones para Codex, Antigravity, Claude Code y Gemini CLI
├── .agents/skills/instalar-atlas/      # skill de instalación (Antigravity, Codex)
├── .claude/skills/instalar-atlas/      # copia idéntica (Claude Code)
├── INSTALAR.md                         # guía de instalación paso a paso
├── instalar.sh · instalar.ps1          # instalación completa por sistema operativo
├── iniciar.sh · iniciar.ps1            # abrir el atlas
├── atlas.config.ejemplo.json           # formato de la configuración local
├── scripts/
│   ├── instalar.mjs                    # detección + configuración + verificación + datos
│   ├── verificar.mjs                   # prueba de humo en un equipo falso
│   ├── generar-datos.mjs               # escribe datos/
│   ├── traducir.mjs                    # completa las traducciones (claude -p, lotes o importación)
│   ├── entorno.sh                      # carga o instala Node.js (macOS/Linux)
│   └── lib/
│       ├── detectar.mjs                # qué tiene este equipo
│       ├── config.mjs                  # configuración efectiva (ATLAS_* > atlas.config.json > detección)
│       ├── texto.mjs                   # frontmatter, enlaces, extractos, ocultar secretos
│       ├── vaults.mjs                  # notas, carpetas, resolución de enlaces y puentes
│       ├── skills.mjs                  # inventario de skills de todas las IAs y plugins
│       ├── agentes.mjs                 # agentes, automatizaciones y motor de memoria
│       └── traduccion.mjs              # diccionario al español y textos pendientes
├── src/
│   ├── App.tsx                         # barra, rutas y búsqueda
│   ├── pantallas/                      # Universo, Vault, Skills, SkillDetalle, Agentes, Sistema
│   ├── componentes/                    # CentroMando, Grafo, LectorNota, ArbolCarpetas, Pipeline…
│   │   ├── CerebroNeuronal.tsx         # un vault dibujado como cerebro de neuronas
│   │   └── vault/                      # PortadaVault, OrbeVault, MapaCarpetas, Actividad, Vecindario
│   ├── lib/                            # datos, rutas, atlas, neuronas, actividad, markdown, tema, formato, tipos
│   └── estilos/                        # tokens y atmósfera, app, markdown
├── traducciones/es.json                # traducciones al español (versionado)
├── docs/                               # ARQUITECTURA, DATOS, CONFIGURACION, FLUJO-GIT
├── vite.config.ts                      # servidor: datos, adjuntos, regeneración y vigilancia en vivo
├── atlas.config.json                   # configuración de este equipo (no versionado)
└── datos/                              # generado (no versionado)
```

## Arquitectura

```mermaid
flowchart LR
  subgraph Equipo
    O[(Registro de Obsidian)]
    V[(Vaults)]
    S[(Skills<br/>Claude · Codex · Antigravity)]
    A[(Agentes y automatizaciones)]
  end
  D{{detectar.mjs}} --> C[atlas.config.json]
  O --> D
  S --> D
  A --> D
  C --> G[generar-datos.mjs]
  V --> G
  S --> G
  A --> G
  G -->|JSON| DATOS[(datos/)]
  W{{vigía · vite.config.ts}} -->|regenera| G
  V -.cambio en .md.-> W
  DATOS -->|/datos| P[Página React]
  V -->|/adjunto| P
  W -->|aviso HMR| P
```

Detalle de cada pieza, decisiones de diseño y cómo extenderlo en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). El formato de los datos está en [docs/DATOS.md](docs/DATOS.md).

---

## Flujo de trabajo con Git

- Cada cambio va en su propia rama (`feat/<tema>` o `fix/<tema>`), creada desde el punto común de `dev` y `main`.
- Commits con el formato `feat(<pantalla>): <explicación>` o `fix(<pantalla>): <explicación>`.
- Al terminar: `npm run verificar` y `npm run build` deben pasar; se sube la rama, se fusiona con `--no-ff` en `dev` y en `main`, y se suben ambas. `dev` y `main` siempre quedan iguales.
- Todo cambio mantiene el proyecto **reutilizable**: nada fijo de un equipo en particular, compatible con las tres IAs y con la documentación al día.

Comandos paso a paso en [docs/FLUJO-GIT.md](docs/FLUJO-GIT.md).

## Atajos

| Tecla | Acción |
|---|---|
| `⌘K` / `Ctrl K` / `/` | Abrir el centro de mando |
| `↑` `↓` `↵` | Moverse y abrir en el centro de mando |
| `Esc` | Cerrar el centro de mando, el visor o la nota abierta |
| Rueda / arrastrar | Zoom y desplazamiento en los grafos |

## Solución de problemas

| Síntoma | Causa y arreglo |
|---|---|
| «Todavía no hay mapa» | No se generaron los datos: `bash instalar.sh` (o `npm run instalar`). |
| «Todavía no hay vaults» | No se encontró ningún vault. En la portada: «Crear mi primer vault» (notas guía en Documentos/Mi memoria) o «Ya tengo un vault». Por terminal: `npm run instalar -- --vault-inicial` o `--vault "<ruta>"`. |
| Falta un vault, una carpeta de skills o de agentes | `npm run detectar`; si sigue faltando, agrégalo con `--vault`, `--skills` o `--agentes`. |
| Una nota nueva no aparece | Con `npm start` no hay vigilancia en vivo: usa el botón de actualizar. Con `iniciar` o `npm run dev`, espera unos 10 segundos. |
| Aparece texto en inglés | Es nuevo y aún no tiene traducción: `npm run traducir` (o los lotes, desde una IA). |
| Una imagen de una nota no carga | El adjunto no está dentro del mismo vault o tiene otro nombre. |
| El grafo de un vault grande se ve como un ovillo | Con más de 1.200 notas los enlaces entre notas se ocultan; actívalos con «Enlaces» o elige una carpeta. |
| `node: command not found` | Abre una terminal nueva o usa `bash iniciar.sh`, que carga Node aunque se haya instalado con fnm o nvm. |

Más casos en [INSTALAR.md](INSTALAR.md#problemas-frecuentes).
