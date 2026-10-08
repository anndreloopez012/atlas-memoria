#!/usr/bin/env node
// Desinstala el Atlas de memoria de este equipo: lo apaga si está abierto, quita los
// accesos de doble clic (Aplicaciones, Escritorio, menú Inicio o de aplicaciones) y
// borra la app instalada. NUNCA toca tus vaults ni tus notas (tampoco «Mi memoria»).
//
// Lo usan «Desinstalar en Mac.command», «Desinstalar en Windows.cmd» y
// «Desinstalar en Linux.sh» (que preguntan antes). También:
//   npm run desinstalar -- --si     sin preguntar
//   --json                          resumen en JSON (para una IA)
//   --solo-accesos                  solo quita los accesos de doble clic
//
// Una copia con git (la de quien desarrolla) conserva su código: solo se quitan los
// accesos, los datos generados y la caché.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const casa = os.homedir();
const args = process.argv.slice(2);
const comoJSON = args.includes('--json');
const log = (m) => !comoJSON && console.log(m);
const leerJSON = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};

// Dónde dejan la app los instaladores de doble clic.
const INSTALADA = [
  path.join(casa, 'Library', 'Application Support', 'Atlas de memoria'),
  path.join(process.env.LOCALAPPDATA || path.join(casa, 'AppData', 'Local'), 'Atlas de memoria'),
  path.join(process.env.XDG_DATA_HOME || path.join(casa, '.local', 'share'), 'atlas-memoria'),
].map((p) => path.resolve(p));
// Se comparan las rutas reales (en macOS /var es un enlace a /private/var).
const real = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};
const esCopiaGit = fs.existsSync(path.join(RAIZ, '.git'));
const esInstalada = INSTALADA.some((p) => real(p) === real(RAIZ)) && !esCopiaGit;

const config = leerJSON(process.env.ATLAS_CONFIG ? path.resolve(process.env.ATLAS_CONFIG) : path.join(RAIZ, 'atlas.config.json')) ?? {};
const puerto = Number(process.env.ATLAS_PUERTO || config.puerto) || 5190;
const vaults = (config.vaults ?? []).map((v) => v.ruta);

function escritorio() {
  if (process.platform === 'linux') {
    const r = spawnSync('xdg-user-dir', ['DESKTOP'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  if (process.platform === 'win32') {
    const r = spawnSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetFolderPath('Desktop')"], { encoding: 'utf8' });
    if (r.stdout?.trim()) return r.stdout.trim();
  }
  return [path.join(casa, 'Desktop'), path.join(casa, 'Escritorio')].find((d) => fs.existsSync(d)) ?? null;
}

/** Los accesos que dejó scripts/lanzador.mjs en este sistema. */
function accesos() {
  const lista = [];
  const desk = escritorio();
  if (process.platform === 'darwin') {
    lista.push(path.join(casa, 'Applications', 'Atlas de memoria.app'));
    if (desk) lista.push(path.join(desk, 'Atlas de memoria.app'));
  } else if (process.platform === 'win32') {
    const menu = path.join(process.env.APPDATA || path.join(casa, 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    lista.push(path.join(menu, 'Atlas de memoria.lnk'), path.join(menu, 'Desinstalar Atlas de memoria.lnk'));
    if (desk) lista.push(path.join(desk, 'Atlas de memoria.lnk'));
  } else {
    lista.push(path.join(casa, '.local', 'share', 'applications', 'atlas-memoria.desktop'));
    if (desk) lista.push(path.join(desk, 'atlas-memoria.desktop'));
  }
  // Solo los que apuntan a ESTA copia (otra instalación del atlas no se toca).
  return lista.filter((p) => {
    try {
      fs.lstatSync(p);
    } catch {
      return false;
    }
    if (process.platform === 'win32') return true;
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) return true; // acceso del Escritorio al .app
    const contenido = p.endsWith('.app') ? fs.readFileSync(path.join(p, 'Contents', 'MacOS', 'atlas'), 'utf8') : fs.readFileSync(p, 'utf8');
    return contenido.includes(RAIZ) || contenido.includes(real(RAIZ));
  });
}

async function apagar() {
  try {
    const r = await fetch(`http://localhost:${puerto}/__atlas/apagar`, { method: 'POST', signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      await new Promise((ok) => setTimeout(ok, 1200));
      return true;
    }
  } catch {
    /* no estaba abierto */
  }
  return false;
}

const quitar = accesos();
const borrar = args.includes('--solo-accesos') ? [] : esInstalada ? [RAIZ] : ['datos', 'dist', '.atlas-cache'].map((d) => path.join(RAIZ, d)).filter((d) => fs.existsSync(d));

if (!args.includes('--si') && !comoJSON) {
  console.log('');
  console.log('  Atlas de memoria · desinstalar');
  console.log('  ──────────────────────────────');
  console.log('  Se quitará:');
  for (const q of quitar) console.log(`    · ${q.replace(casa, '~')}`);
  for (const b of borrar) console.log(`    · ${b.replace(casa, '~')}${b === RAIZ ? '  (la app)' : ''}`);
  if (!quitar.length && !borrar.length) console.log('    (nada: no encontré la app ni sus accesos)');
  console.log('  No se toca:');
  for (const v of vaults) console.log(`    · ${v}  (tu vault)`);
  if (!vaults.length) console.log('    · tus vaults y tus notas, estén donde estén');
  if (!esInstalada) console.log(`    · ${RAIZ.replace(casa, '~')}  (el código, porque ${esCopiaGit ? 'es una copia con git' : 'no es la carpeta donde instala el instalador'})`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = (await rl.question('\n  ¿Desinstalar? Escribe «si» para confirmar: ')).trim().toLowerCase();
  rl.close();
  if (!['si', 'sí', 's', 'yes', 'y'].includes(respuesta)) {
    console.log('  No se cambió nada.');
    process.exit(0);
  }
}

const apagado = await apagar();
if (apagado) log('→ Atlas apagado.');
const quitados = [];
for (const q of quitar) {
  fs.rmSync(q, { recursive: true, force: true });
  quitados.push(q);
}
// Para borrar la carpeta de la app hay que salir de ella (Windows no deja borrar la carpeta actual).
process.chdir(casa);
const borrados = [];
for (const b of borrar) {
  try {
    fs.rmSync(b, { recursive: true, force: true, maxRetries: 3 });
    borrados.push(b);
  } catch (error) {
    log(`  aviso: no se pudo borrar ${b}: ${error.message}`);
  }
}
if (process.platform === 'linux') spawnSync('update-desktop-database', [path.join(casa, '.local', 'share', 'applications')], { stdio: 'ignore' });

const resumen = { apagado, accesos: quitados, borrados, conservados: { vaults, codigo: esInstalada ? null : RAIZ } };
if (comoJSON) console.log(JSON.stringify(resumen, null, 2));
else {
  log('');
  log(`Listo: el Atlas de memoria se desinstaló${esInstalada ? '' : ' (accesos, datos y caché)'}. Tus vaults y tus notas siguen intactos.`);
  if (!esInstalada) log(`La carpeta del código sigue en ${RAIZ}: bórrala tú si ya no la necesitas.`);
}
