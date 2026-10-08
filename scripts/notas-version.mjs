#!/usr/bin/env node
// Notas de una versión para GitHub Releases: cómo instalar con doble clic y lo
// nuevo de esa versión (sacado de CHANGELOG.md). Uso: node scripts/notas-version.mjs v2.2.0
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = (process.argv[2] || '').replace(/^v/, '');
const cambios = fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf8');
const inicio = cambios.indexOf(`## ${version} `);
const fin = inicio === -1 ? -1 : cambios.indexOf('\n## ', inicio + 4);
const novedades = inicio === -1 ? '' : cambios.slice(inicio, fin === -1 ? undefined : fin).split('\n').slice(1).join('\n').trim();

console.log(`## Instalar con doble clic

1. Descarga **atlas-memoria-v${version}.zip** (abajo, en «Assets») y descomprímelo.
2. Haz doble clic en el instalador de tu sistema:
   - **macOS:** \`Instalar en Mac.command\`. Si macOS dice que es de un desarrollador no identificado: Ajustes del Sistema › Privacidad y seguridad › **Abrir igualmente**.
   - **Windows:** \`Instalar en Windows.cmd\`. Si aparece «Windows protegió tu PC»: **Más información › Ejecutar de todas formas**.
   - **Linux:** \`Instalar en Linux.sh\` (clic derecho › Ejecutar como programa, o \`bash "Instalar en Linux.sh"\`).
3. Listo: desde ahora abre **«Atlas de memoria»** con doble clic. Cada vez que lo abres busca cambios en tus vaults de Obsidian, tus skills y tus agentes, y se apaga solo al cerrar la pestaña.

**Actualizar:** desde la 2.3, la app avisa sola cuando hay una versión nueva («Versión X» en la barra) y se actualiza en un clic, sin tocar tu configuración ni tus notas. Desde una versión anterior, descarga esta y vuelve a ejecutar el instalador.

**Desinstalar:** doble clic en `Desinstalar en Mac.command`, `Desinstalar en Windows.cmd` o `Desinstalar en Linux.sh`. Tus vaults y tus notas nunca se tocan.

También se instala pegándole el enlace del repositorio a Claude Code, Codex o Antigravity y pidiéndole «instala».

## Novedades

${novedades || 'Ver CHANGELOG.md.'}`);
