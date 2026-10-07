---
name: instalar-atlas
description: Instala y deja funcionando el Atlas de memoria en este equipo (Node.js si falta, dependencias, detección de los vaults de Obsidian y de las skills y agentes de Claude Code, Codex y Antigravity, verificación, datos y traducción al español) y lo abre en el navegador. Úsala cuando pidan instalar, configurar, reinstalar, actualizar o abrir el atlas, o agregarle un vault o una carpeta de skills.
---

# Instalar el Atlas de memoria

La persona solo dio la URL del repositorio y dijo «instala». Haz todo tú; pregunta únicamente donde se indica. Detalle completo y casos raros: `AGENTS.md` e `INSTALAR.md` en la raíz del repositorio.

## Pasos

1. **Repositorio.** Si no estás dentro de él, clónalo en la carpeta de proyectos de la persona (`~/Documents/PROYECTOS`, `~/Projects`, `~/proyectos` o `~/code`, la primera que exista; si no, `~/atlas-memoria`). Privado → `gh repo clone <dueño>/<repo>`; sin sesión en `gh`, pregunta si puede ejecutar `gh auth login`.
2. **Instalador** (deja Node.js 20+ listo si falta, sin sudo):
   - macOS / Linux: `bash instalar.sh --json`
   - Windows: `powershell -ExecutionPolicy Bypass -File instalar.ps1 --json`
3. **Resumen JSON** (lo último que imprime):
   - `vaults` vacío → pregunta dónde están sus vaults y agrégalos con `npm run instalar -- --vault "<ruta>" --json`.
   - `sugerenciasDeVaults` → pregunta si son suyos antes de agregarlos.
   - `centro` → cámbialo con `--centro "<nombre>"` si la persona usa otro vault como principal.
4. **Español.** Si `totales.sinTraducir` > 0: `npm run traducir -- --lotes <carpeta>`, traduce cada `lote-NN.json` a `resultado-NN.json` (`{ clave: traducción }`, reglas en AGENTS.md → «Traducción») y `npm run traducir -- --importar <carpeta>`. Fuera de Claude Code también sirve `npm run traducir`.
5. **Abrir.** El instalador ya dejó el acceso de doble clic «Atlas de memoria» (`lanzadores` en el resumen). Ábrelo una vez con `npm run abrir`: busca cambios, abre el navegador y deja el servidor en segundo plano (se apaga solo).

## Comprobar

- `npm run verificar` termina en «Todo en orden».
- La URL responde y la portada muestra el vault central con los demás en órbita (o, sin vaults, el anillo de skills).
- Cuéntale a la persona qué se encontró y que desde ahora lo abre con **doble clic** en «Atlas de memoria» (`siguiente.dobleClic`); al abrirlo siempre busca cambios en vaults, skills y agentes.

## Actualizar

`git pull` y de nuevo `bash instalar.sh --json`: conserva su configuración y suma lo nuevo.
