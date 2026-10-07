# Cambios

## 2.1.0 · 2026-10-07

- El servidor también vigila las carpetas de skills y agentes de todas las IAs: una skill o un agente nuevo (o editado, o borrado) aparece solo en unos segundos, sin tocar ninguna nota ni actualizar a mano.

## 2.0.0 · 2026-10-07

Más funcional sin más botones (plan en [docs/PLAN-2.0.md](docs/PLAN-2.0.md)).

### Centro de mando y navegación más simple
- El buscador pasa a ser el **centro de mando** (botón «Buscar o pedir» o `⌘K`): busca en todo y, sin escribir, muestra lo último que abriste, a dónde ir y las acciones (cambiar el tema, actualizar los datos).
- La barra queda con secciones claras: Universo, Hoy, Vaults, Skills y **Sistema**, que junta «Cómo trabaja» y «Agentes» en pestañas. Las direcciones anteriores (`#/agentes`, `#/agentes/<id>`) siguen funcionando.

### Hoy · novedades desde tu última visita
- Pantalla **Hoy** con lo que escribiste o editaste por vault, las skills y agentes nuevos, y aparte lo que tus herramientas actualizaron solas (por frontmatter `generado: true` o por cambios en lote).
- El navegador recuerda la visita anterior (recargar no cuenta como visita nueva) y un punto en la barra avisa cuando hay novedades.
- Datos nuevos: `recientes.json`, y fechas `m`/`c` en skills y agentes.

### Pendientes
- Las tareas (`- [ ]`) de todas las notas, con fecha y prioridad al estilo del complemento Tasks: las más urgentes en Hoy (dos por nota como máximo) y todas en `#/hoy/tareas`, agrupadas por vencimiento y por nota.
- Se pueden marcar como hechas desde el atlas: el servidor cambia solo esa casilla y solo si la línea no cambió.
- Se omiten plantillas y código; las tareas de notas que reescriben las herramientas quedan aparte.

### Proyectos
- Los proyectos más activos en Hoy y todos en `#/hoy/proyectos`, con su última actividad y su historia reciente (bitácora, decisiones, cambios).
- Salen del frontmatter de las notas (`tipo: proyecto` y `proyecto: <nombre>`); con un sistema de memoria se suma su semáforo y el motivo.
- Datos nuevos: `proyectos.json`.

### Favoritos y recorrido
- Estrella en notas, skills y agentes: los favoritos aparecen arriba en Hoy y en el centro de mando.
- Recorrido guiado de cinco pasos la primera vez; se repite desde el centro de mando.

### ¿Qué skill uso para…?
- Recomendación de skills a partir de una tarea descrita con palabras propias, con el motivo de cada una, en el centro de mando («Skills para eso») y en Skills («Las que mejor encajan»). Sin internet; si nada encaja de verdad, no recomienda.
- Ficha de skill con «Cómo pedirla»: el pedido listo para copiar y el atajo de Claude Code.
- Skills más tranquila: una fila de categorías y el resto de filtros en «Más filtros».

### Uso real de skills
- Cuántas veces usaron Claude Code y Codex cada skill en los últimos 180 días y cuándo fue la última: «Las que más usas» arriba en Skills, el conteo en cada tarjeta, el filtro «Nunca usadas» y un bloque «Uso» en la ficha.
- Solo conteos y fechas; nada del contenido de las conversaciones. Lectura incremental con caché local y tope de tiempo. Se apaga con `"uso": false` o `ATLAS_USO=0`.

### Salud de la memoria
- Pestaña **Salud** en Sistema: enlaces rotos, adjuntos que faltan, títulos repetidos, notas vacías, sueltas y olvidadas, skills con versiones distintas entre IAs, sin descripción y sin uso, y textos sin traducir.
- Arreglo: las notas con punto en el nombre (p. ej. `oms.case_event`) ya no se toman por adjuntos; ahora se enlazan bien en el lector.
- Los enlaces a notas generadas que el atlas omite ya no cuentan como sin resolver.

### Camino entre notas
- Desde el vecindario de una nota: elige otra de cualquier vault y aparece el camino más corto de enlaces entre las dos, paso a paso.

### Preguntar a tu memoria
- Desde el centro de mando: el atlas busca las notas que responden la pregunta y la IA instalada (Claude Code, Codex o Gemini CLI) responde solo con ellas y las cita. Avisa qué se envía y a quién.
- Si una IA no tiene la sesión iniciada, prueba la siguiente; sin IA, muestra las notas que responden. Configurable con `preguntar.ia`.

### Capturar
- Desde el centro de mando (o empezando con `+`): guarda una idea como nota nueva con `memoria capturar` si existe, o en `Bandeja/` del vault central. Dice dónde quedó y ofrece abrirla en Obsidian.

### Voz
- Micrófono en el centro de mando (si el navegador lo permite): «abre Programación», «ve a las tareas», «busca…», «qué skill uso para…», «pregúntale…», «anota…».

### Exportar
- Acción del centro de mando: «Exportar esta vista como imagen» guarda un PNG del Universo, del vault con su vista actual o de la página, con tipografías, cerebros y grafo.

### Teléfono
- La barra muestra las cinco secciones completas; actualizar y cambiar de tema quedan en el centro de mando.

## 1.4.0 · 2026-10-05

### Una sola mente
- Cada vault del Universo es ahora un **cerebro de neuronas** que crece con sus notas: silueta de cerebro humano con sus surcos, sinapsis, dendritas, chispas que se encienden e impulsos que recorren las conexiones. Las neuronas grandes son las carpetas principales: muestran su nombre al pasar el cursor y llevan directo a esa carpeta.
- El vault central es el **núcleo**, dentro de una interfaz holográfica al estilo JARVIS: barrido de radar, marcas de escala, anillos segmentados que giran en sentidos opuestos y lecturas con neuronas, sinapsis, puentes, vaults y skills.
- Los vaults nacen del núcleo por **haces nerviosos** con impulsos que van y vuelven; los puentes entre vaults también llevan impulsos.
- Al pasar sobre un vault su retícula se fija y la ficha aparece del lado contrario, sin taparlo; el tooltip se abre hacia la izquierda cerca del borde.
- La portada de cada vault muestra su cerebro dentro de una retícula, y el carril de vaults usa la silueta del cerebro de cada uno.
- En el teléfono el Universo encuadra los cerebros para que se vean grandes.
- Los cerebros se generan una sola vez por vault (con semilla, siempre iguales) y todo se anima con CSS: va fluido con todas las animaciones activas.

## 1.3.0 · 2026-10-05

### Vaults con otra cara
- **Portada** de cada vault: el vault como planeta (sus lunas son las carpetas principales), su lugar respecto al centro, propósito, notas de entrada, etiquetas que filtran con un clic, cifras, pulso de las últimas 26 semanas y barra de puentes con cada vault vecino.
- Tres formas de ver el vault, y se recuerda la elegida:
  - **Constelación**: cada carpeta principal forma su racimo con un halo y su nombre; brillo en los nodos más conectados, enlaces curvos y destellos sobre los enlaces de la nota abierta. Aparece ya acomodada y encuadrada, y recuerda dónde quedó cada nodo.
  - **Mapa**: carpetas dentro de carpetas como círculos anidados, con zoom de a un nivel, migas y títulos de notas al acercarse.
  - **Actividad**: calendario de calor del último año (clic en un día para filtrar) y línea de tiempo agrupada en Hoy, Ayer, Esta semana, Este mes y por mes.
- **Lector**: barra de progreso de lectura y el **vecindario** de la nota (quién la cita, a qué enlaza y sus puentes), con cada punto navegable. `Esc` lo cierra.
- Carpetas con barra de peso y color propio; filtro por `#etiqueta`; estados de carga y de vault vacío.
- **Teléfono**: la página del vault se desplaza, las carpetas pasan a una fila de chips, el lienzo tiene alto propio y el lector ocupa la pantalla.

### Más liviano
- Las pantallas Vault, Skills, Agentes y Cómo trabaja, y el grafo, se cargan aparte, solo cuando se usan.
- El grafo precalcula su acomodo antes de dibujarse y usa menos iteraciones en vaults de miles de notas.

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
