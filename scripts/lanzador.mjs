#!/usr/bin/env node
// Crea el acceso de doble clic «Atlas de memoria» con su ícono:
//   macOS    → ~/Applications/Atlas de memoria.app  (y un acceso en el Escritorio)
//   Windows  → acceso directo en el Escritorio y en el menú Inicio
//   Linux    → entrada en el menú de aplicaciones (y en el Escritorio)
// Todos ejecutan iniciar.sh / iniciar.ps1, que abren la app (scripts/abrir.mjs).
// Lo corre el instalador al terminar; también: npm run lanzador
//
//   --json        imprime dónde quedó cada acceso
//   --sin-escritorio   solo en Aplicaciones / menú, no en el Escritorio
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOMBRE = 'Atlas de memoria';
const casa = os.homedir();
const conEscritorio = !process.argv.includes('--sin-escritorio');
const creados = [];

/** Carpeta del Escritorio (en Linux puede tener otro nombre según el idioma). */
function escritorio() {
  if (process.platform === 'linux') {
    const r = spawnSync('xdg-user-dir', ['DESKTOP'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim() && fs.existsSync(r.stdout.trim())) return r.stdout.trim();
  }
  for (const nombre of ['Desktop', 'Escritorio']) if (fs.existsSync(path.join(casa, nombre))) return path.join(casa, nombre);
  return null;
}

function mac() {
  const app = path.join(casa, 'Applications', `${NOMBRE}.app`);
  fs.rmSync(app, { recursive: true, force: true });
  fs.mkdirSync(path.join(app, 'Contents', 'MacOS'), { recursive: true });
  fs.mkdirSync(path.join(app, 'Contents', 'Resources'), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, 'instalador', 'atlas.icns'), path.join(app, 'Contents', 'Resources', 'atlas.icns'));
  fs.writeFileSync(
    path.join(app, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>${NOMBRE}</string>
  <key>CFBundleDisplayName</key><string>${NOMBRE}</string>
  <key>CFBundleIdentifier</key><string>local.atlas-memoria</string>
  <key>CFBundleExecutable</key><string>atlas</string>
  <key>CFBundleIconFile</key><string>atlas</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).version}</string>
  <key>LSUIElement</key><true/>
</dict></plist>
`,
  );
  // El ejecutable de la app solo llama a iniciar.sh (con el PATH de una sesión normal).
  const ejecutable = path.join(app, 'Contents', 'MacOS', 'atlas');
  fs.writeFileSync(ejecutable, `#!/bin/bash\n# Abre el Atlas de memoria (lo creó scripts/lanzador.mjs).\nexec /bin/bash "${path.join(RAIZ, 'iniciar.sh').replace(/"/g, '\\"')}" >> "${path.join(RAIZ, '.atlas-cache', 'lanzador.log')}" 2>&1\n`);
  fs.chmodSync(ejecutable, 0o755);
  // Que el Finder tome el ícono nuevo.
  spawnSync('touch', [app]);
  creados.push(app);
  const destino = conEscritorio && escritorio();
  if (destino) {
    const acceso = path.join(destino, `${NOMBRE}.app`);
    fs.rmSync(acceso, { recursive: true, force: true });
    fs.symlinkSync(app, acceso);
    creados.push(acceso);
  }
}

function windows() {
  const objetivo = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const argumentos = `-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "${path.join(RAIZ, 'iniciar.ps1')}"`;
  const icono = path.join(RAIZ, 'instalador', 'atlas.ico');
  const menuInicio = path.join(process.env.APPDATA || path.join(casa, 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
  const lugares = [menuInicio];
  if (conEscritorio) {
    const r = spawnSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetFolderPath('Desktop')"], { encoding: 'utf8' });
    if (r.stdout?.trim()) lugares.push(r.stdout.trim());
  }
  // En el menú Inicio también queda «Desinstalar Atlas de memoria».
  const accesos = lugares.map((carpeta) => ({ lnk: path.join(carpeta, `${NOMBRE}.lnk`), objetivo, argumentos, descripcion: `${NOMBRE}: vaults, skills y agentes` }));
  accesos.push({
    lnk: path.join(menuInicio, `Desinstalar ${NOMBRE}.lnk`),
    objetivo: path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe'),
    argumentos: `/c "${path.join(RAIZ, 'Desinstalar en Windows.cmd')}"`,
    descripcion: `Quita ${NOMBRE} (tus vaults y notas no se tocan)`,
  });
  for (const { lnk, objetivo, argumentos, descripcion } of accesos) {
    fs.mkdirSync(path.dirname(lnk), { recursive: true });
    const ps = [
      '$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:ATLAS_LNK)',
      '$s.TargetPath = $env:ATLAS_OBJETIVO',
      '$s.Arguments = $env:ATLAS_ARGS',
      '$s.WorkingDirectory = $env:ATLAS_RAIZ',
      '$s.IconLocation = $env:ATLAS_ICONO',
      '$s.Description = $env:ATLAS_DESCRIPCION',
      '$s.Save()',
    ].join('; ');
    const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], {
      env: { ...process.env, ATLAS_LNK: lnk, ATLAS_OBJETIVO: objetivo, ATLAS_ARGS: argumentos, ATLAS_RAIZ: RAIZ, ATLAS_ICONO: icono, ATLAS_DESCRIPCION: descripcion },
      encoding: 'utf8',
    });
    if (r.status === 0) creados.push(lnk);
    else console.error(`No se pudo crear ${lnk}: ${r.stderr}`);
  }
}

function linux() {
  // En el formato .desktop, dentro de comillas se escapan " ` $ y \.
  const comillas = (t) => `"${t.replace(/(["`$\\])/g, '\\$1')}"`;
  const entrada = `[Desktop Entry]
Type=Application
Name=${NOMBRE}
Comment=Tus vaults de Obsidian, skills y agentes en un mapa interactivo
Exec=/bin/bash ${comillas(path.join(RAIZ, 'iniciar.sh'))}
Icon=${path.join(RAIZ, 'instalador', 'atlas.png')}
Terminal=false
Categories=Office;Utility;
StartupNotify=false
Actions=desinstalar;

[Desktop Action desinstalar]
Name=Desinstalar
Exec=/bin/bash ${comillas(path.join(RAIZ, 'Desinstalar en Linux.sh'))}
`;
  const menu = path.join(casa, '.local', 'share', 'applications', 'atlas-memoria.desktop');
  fs.mkdirSync(path.dirname(menu), { recursive: true });
  fs.writeFileSync(menu, entrada, { mode: 0o755 });
  creados.push(menu);
  const destino = conEscritorio && escritorio();
  if (destino) {
    const acceso = path.join(destino, 'atlas-memoria.desktop');
    fs.writeFileSync(acceso, entrada, { mode: 0o755 });
    // GNOME pide «Permitir ejecutar» a los lanzadores del Escritorio; se marca como confiable.
    spawnSync('gio', ['set', acceso, 'metadata::trusted', 'true'], { stdio: 'ignore' });
    creados.push(acceso);
  }
  spawnSync('update-desktop-database', [path.dirname(menu)], { stdio: 'ignore' });
}

try {
  if (process.platform === 'darwin') mac();
  else if (process.platform === 'win32') windows();
  else linux();
} catch (error) {
  console.error(`No se pudo crear el acceso de doble clic: ${error.message}`);
  process.exit(1);
}

if (process.argv.includes('--json')) console.log(JSON.stringify({ lanzadores: creados }));
else {
  console.log('Acceso de doble clic listo:');
  for (const c of creados) console.log(`  · ${c.replace(casa, '~')}`);
}
