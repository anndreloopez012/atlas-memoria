#!/usr/bin/env node
// Abre la app del atlas: es lo que ejecuta el acceso de doble clic (macOS, Windows
// y Linux). Pensado para personas sin experiencia técnica: no deja ventanas
// abiertas y se encarga de todo.
//
// 1. Si el atlas ya está abierto, solo abre el navegador.
// 2. Busca ubicaciones nuevas (vaults, carpetas de skills y de agentes) y las suma
//    a la configuración.
// 3. La primera vez (o tras una actualización) prepara la app y los datos.
// 4. Arranca el servidor en segundo plano, abre el navegador y termina. El servidor
//    vuelve a leer notas, skills y agentes al arrancar (la página se actualiza sola),
//    los sigue vigilando y se apaga solo unos minutos después de cerrar la pestaña.
//
//   node scripts/abrir.mjs              (lo usan iniciar.sh / iniciar.ps1)
//   node scripts/abrir.mjs --sin-navegador
//   node scripts/abrir.mjs --reiniciar   (tras actualizarse: espera a que se apague la instancia anterior)
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, '.atlas-cache');
fs.mkdirSync(CACHE, { recursive: true });
const registro = path.join(CACHE, 'abrir.log');
const log = (m) => {
  console.log(m);
  fs.appendFileSync(registro, `${new Date().toISOString()} ${m}\n`);
};

function puerto() {
  try {
    return Number(process.env.ATLAS_PUERTO || JSON.parse(fs.readFileSync(path.join(RAIZ, 'atlas.config.json'), 'utf8')).puerto) || 5190;
  } catch {
    return 5190;
  }
}
const URL_ATLAS = `http://localhost:${puerto()}`;

async function estaAbierto() {
  try {
    const r = await fetch(`${URL_ATLAS}/__atlas/estado`, { signal: AbortSignal.timeout(1500) });
    return r.ok && (await r.json()).atlas === true;
  } catch {
    return false;
  }
}

function abrirNavegador() {
  if (process.argv.includes('--sin-navegador')) return;
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [URL_ATLAS]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', URL_ATLAS]] : ['xdg-open', [URL_ATLAS]];
  spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).unref();
}

const node = (script, args = []) => spawnSync(process.execPath, [path.join(RAIZ, 'scripts', script), ...args], { cwd: RAIZ, encoding: 'utf8', windowsHide: true });

// Huella del código de la página: si cambió (una actualización), se vuelve a preparar.
function huellaDelCodigo() {
  const h = crypto.createHash('sha1');
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(abs);
      else h.update(`${path.relative(RAIZ, abs)}:${fs.statSync(abs).size}:${fs.statSync(abs).mtimeMs}`);
    }
  };
  recorrer(path.join(RAIZ, 'src'));
  for (const f of ['index.html', 'vite.config.ts', 'package.json']) h.update(`${f}:${fs.statSync(path.join(RAIZ, f)).mtimeMs}`);
  return h.digest('hex');
}

// Tras una actualización, la instancia anterior se apaga sola: se espera a que libere el puerto.
if (process.argv.includes('--reiniciar')) {
  for (let i = 0; i < 40 && (await estaAbierto()); i++) await new Promise((r) => setTimeout(r, 500));
}

if (await estaAbierto()) {
  log('El atlas ya está abierto: abro el navegador.');
  abrirNavegador();
  process.exit(0);
}

// Ubicaciones nuevas (un vault, otra IA, un plugin con skills): se suman solas.
log('→ Buscando vaults, skills y agentes nuevos…');
const deteccion = node('instalar.mjs', ['--solo-detectar', '--json']);
if (deteccion.status !== 0) log(`  aviso: no se pudo actualizar la detección (${(deteccion.stderr || '').trim().split('\n').pop()})`);

// Primera vez: los datos se generan antes de abrir (después se actualizan en segundo plano).
if (!fs.existsSync(path.join(RAIZ, 'datos', 'atlas.json'))) {
  log('→ Leyendo tus vaults, skills y agentes por primera vez (puede tardar un minuto)…');
  const g = node('generar-datos.mjs');
  if (g.status !== 0) {
    log(`No se pudieron generar los datos:\n${g.stdout}\n${g.stderr}`);
    process.exit(1);
  }
}

// La app (la página ya compilada) se prepara la primera vez y tras cada actualización.
const huella = huellaDelCodigo();
const archivoHuella = path.join(RAIZ, 'dist', '.atlas-huella');
if (!fs.existsSync(archivoHuella) || fs.readFileSync(archivoHuella, 'utf8') !== huella) {
  log('→ Preparando la app (solo la primera vez o tras una actualización)…');
  const b = spawnSync(process.execPath, [path.join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: RAIZ, encoding: 'utf8', windowsHide: true });
  if (b.status !== 0) {
    log(`No se pudo preparar la app:\n${b.stdout}\n${b.stderr}`);
    process.exit(1);
  }
  fs.writeFileSync(archivoHuella, huella);
}

// Servidor en segundo plano: se apaga solo cuando nadie lo usa.
log(`→ Abriendo el atlas en ${URL_ATLAS}…`);
const salidaServidor = fs.openSync(path.join(CACHE, 'servidor.log'), 'a');
const servidor = spawn(process.execPath, [path.join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(puerto()), '--strictPort'], {
  cwd: RAIZ,
  detached: true,
  windowsHide: true,
  stdio: ['ignore', salidaServidor, salidaServidor],
  env: { ...process.env, ATLAS_APAGAR_SIN_USO: '1' },
});
servidor.unref();

for (let i = 0; i < 60 && !(await estaAbierto()); i++) await new Promise((r) => setTimeout(r, 500));
if (!(await estaAbierto())) {
  log(`El servidor no arrancó. Revisa ${path.join(CACHE, 'servidor.log')}`);
  process.exit(1);
}
abrirNavegador();
log('Listo: el atlas está abierto en tu navegador. Se apaga solo unos minutos después de cerrar la pestaña.');
process.exit(0);
