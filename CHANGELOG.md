# Cambios

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
