#!/usr/bin/env node
// Instalador del atlas: detecta lo que tiene este equipo, escribe
// atlas.config.json, verifica y genera los datos. Lo ejecutan instalar.sh /
// instalar.ps1 (que antes dejan Node.js listo) o directamente `npm run instalar`.
//
// Pensado para que lo corra una IA (Claude Code, Codex o Antigravity) sin
// preguntas: todo se resuelve con opciones. Con --json imprime al final un
// resumen legible por máquina.
//
//   --vault <ruta>            agrega un vault (se puede repetir)
//   --quitar-vault <nombre>   lo saca de la configuración
//   --centro <nombre>         vault del que nacen los demás
//   --skills <IA>=<ruta>      agrega una carpeta de skills (p. ej. Claude=~/mis-skills)
//   --agentes <IA>=<ruta>     agrega una carpeta de agentes
//   --cuenta <usuario>        marca como tuyas las skills cuyo repositorio es de esa cuenta de GitHub
//   --propia <texto>          marca como tuyas las skills que tienen ese texto en el nombre
//   --puerto <n>              puerto del servidor (por defecto 5190)
//   --redetectar              vuelve a detectar todo (conserva centro, colores, propósitos y puerto)
//   --solo-detectar           actualiza la configuración sin generar datos
//   --sin-verificar           no corre la prueba de humo
//   --sin-lanzador            no crea el acceso de doble clic «Atlas de memoria»
//   --abrir                   al terminar, abre la app en el navegador
//   --json                    resumen final en JSON
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { abreviar, ARCHIVO_CONFIG, configDesdeDeteccion, expandir, leerConfigLocal, PUERTO_POR_DEFECTO, RAIZ } from './lib/config.mjs';
import { contarSkills, detectarEntorno } from './lib/detectar.mjs';

const args = process.argv.slice(2);
const valores = (nombre) => args.flatMap((a, i) => (a === nombre && args[i + 1] ? [args[i + 1]] : []));
const bandera = (nombre) => args.includes(nombre);
const comoJSON = bandera('--json');
const log = (...m) => {
  if (!comoJSON) console.log(...m);
};

// --- 1. Requisitos ------------------------------------------------------------
const mayor = Number(process.versions.node.split('.')[0]);
if (mayor < 20) {
  console.error(`Se necesita Node.js 20 o superior y este equipo tiene ${process.versions.node}. Ejecuta instalar.sh (macOS/Linux) o instalar.ps1 (Windows), que lo instalan.`);
  process.exit(1);
}

if (!fs.existsSync(path.join(RAIZ, 'node_modules', 'vite'))) {
  log('→ Instalando dependencias (npm install)…');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npm, ['install', '--no-fund', '--no-audit'], { cwd: RAIZ, stdio: comoJSON ? 'ignore' : 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error('npm install falló. Revisa la conexión a internet y vuelve a ejecutar.');
    process.exit(1);
  }
}

// --- 2. Detección y mezcla con la configuración existente ----------------------
log('→ Detectando vaults, skills y agentes de este equipo…');
const deteccion = detectarEntorno();
const detectado = configDesdeDeteccion(deteccion);
const previa = leerConfigLocal();
const mismaRuta = (a, b) => path.resolve(expandir(a)) === path.resolve(expandir(b));

let config;
if (!previa || bandera('--redetectar')) {
  config = detectado;
  if (previa) {
    // Se conserva lo que la persona ajustó a mano.
    config.centro = previa.centro ?? config.centro;
    config.puerto = previa.puerto ?? config.puerto;
    config.propias = previa.propias;
    config.carpetasGeneradas = previa.carpetasGeneradas ?? config.carpetasGeneradas;
    config.automatizaciones = previa.automatizaciones ?? config.automatizaciones;
    config.vaults = config.vaults.map((v) => ({ ...(previa.vaults || []).find((p) => mismaRuta(p.ruta, v.ruta)), ...v }));
  }
} else {
  // Se agrega lo nuevo que apareció; lo que ya estaba se respeta tal cual.
  config = { ...detectado, ...previa };
  const agregar = (clave, igual) => {
    for (const nuevo of detectado[clave] || []) if (!(config[clave] || []).some((x) => igual(x, nuevo))) config[clave] = [...(config[clave] || []), nuevo];
  };
  agregar('vaults', (a, b) => mismaRuta(a.ruta, b.ruta));
  agregar('skills', (a, b) => mismaRuta(a.ruta, b.ruta));
  agregar('agentes', (a, b) => mismaRuta(a.ruta, b.ruta));
  config.sistemaMemoria ??= detectado.sistemaMemoria;
  config.centro ??= detectado.centro;
}

// --- 3. Opciones de la línea de comandos --------------------------------------
for (const ruta of valores('--vault')) {
  const abs = expandir(ruta);
  if (!fs.existsSync(abs)) {
    console.error(`No existe la carpeta del vault: ${abs}`);
    process.exit(1);
  }
  if (!config.vaults.some((v) => mismaRuta(v.ruta, abs))) config.vaults.push({ nombre: path.basename(abs), ruta: abreviar(abs) });
}
for (const nombre of valores('--quitar-vault')) config.vaults = config.vaults.filter((v) => v.nombre !== nombre);
for (const par of valores('--skills')) {
  const [ia, ruta] = par.split(/=(.+)/);
  if (ia && ruta && !config.skills.some((s) => mismaRuta(s.ruta, ruta))) config.skills.push({ ia, ruta: abreviar(expandir(ruta)) });
}
for (const par of valores('--agentes')) {
  const [ia, ruta] = par.split(/=(.+)/);
  if (ia && ruta && !config.agentes.some((a) => mismaRuta(a.ruta, ruta))) config.agentes.push({ ia, ambito: 'Usuario', ruta: abreviar(expandir(ruta)) });
}
for (const [opcion, destino] of [['--cuenta', 'cuentas'], ['--propia', 'patrones']]) {
  for (const valor of valores(opcion)) {
    config.propias ??= { cuentas: [], patrones: [] };
    config.propias[destino] ??= [];
    if (!config.propias[destino].includes(valor)) config.propias[destino].push(valor);
  }
}
if (valores('--centro')[0]) config.centro = valores('--centro')[0];
if (valores('--puerto')[0]) config.puerto = Number(valores('--puerto')[0]);
config.puerto ||= PUERTO_POR_DEFECTO;

// Lo que ya no existe en el disco se avisa y se quita.
const ausentes = [];
for (const clave of ['vaults', 'skills', 'agentes']) {
  config[clave] = (config[clave] || []).filter((x) => {
    const ok = fs.existsSync(expandir(x.ruta));
    if (!ok) ausentes.push(`${clave}: ${x.ruta}`);
    return ok;
  });
}
if (config.centro && !config.vaults.some((v) => v.nombre === config.centro)) config.centro = config.vaults[0]?.nombre ?? null;

fs.writeFileSync(ARCHIVO_CONFIG, `${JSON.stringify({ $comentario: 'Configuración local del Atlas de memoria para este equipo (no se sube a git). La escribe npm run instalar; puedes editarla a mano. Referencia: docs/CONFIGURACION.md', ...config }, null, 2)}\n`);

// --- 4. Resumen de lo detectado -----------------------------------------------
const resumen = {
  config: ARCHIVO_CONFIG,
  plataforma: process.platform,
  node: process.versions.node,
  centro: config.centro,
  vaults: config.vaults.map((v) => ({ nombre: v.nombre, ruta: v.ruta })),
  sugerenciasDeVaults: deteccion.sugerenciasDeVaults.map(abreviar),
  sistemaMemoria: config.sistemaMemoria,
  skills: config.skills.map((s) => ({ ia: s.ia, ruta: s.ruta, skills: contarSkills(expandir(s.ruta)), ...(s.paquete ? { paquete: s.paquete } : {}) })),
  agentes: config.agentes,
  ausentes,
  puerto: config.puerto,
};

log('');
log(`  Configuración: ${abreviar(ARCHIVO_CONFIG)}`);
log(`  Vaults (${resumen.vaults.length})${config.centro ? ` · centro: ${config.centro}` : ''}`);
for (const v of resumen.vaults) log(`    · ${v.nombre}  ${v.ruta}`);
if (!resumen.vaults.length) log('    (ninguno: el atlas mostrará solo skills y agentes; agrega uno con --vault "<ruta>")');
if (resumen.sugerenciasDeVaults.length) {
  log('  Otras carpetas con .obsidian que Obsidian no tiene registradas (agrégalas con --vault si son tuyas):');
  for (const s of resumen.sugerenciasDeVaults) log(`    ? ${s}`);
}
log(`  Skills: ${resumen.skills.reduce((t, s) => t + s.skills, 0)} en ${resumen.skills.length} carpetas`);
for (const s of resumen.skills.filter((x) => !x.paquete)) log(`    · ${s.ia.padEnd(12)} ${String(s.skills).padStart(4)}  ${s.ruta}`);
const deplugins = resumen.skills.filter((x) => x.paquete);
if (deplugins.length) log(`    · ${deplugins.length} plugins activos con ${deplugins.reduce((t, s) => t + s.skills, 0)} skills`);
log(`  Agentes: ${config.agentes.length} carpetas`);
for (const a of config.agentes) log(`    · ${a.ia.padEnd(12)} ${a.ambito.padEnd(22)} ${a.ruta}`);
if (config.sistemaMemoria) log(`  Sistema de memoria: ${config.sistemaMemoria}`);
if (ausentes.length) log(`  Se quitaron rutas que ya no existen: ${ausentes.join(' · ')}`);

if (bandera('--solo-detectar')) {
  if (comoJSON) console.log(JSON.stringify(resumen, null, 2));
  process.exit(0);
}

// --- 5. Prueba de humo y datos -----------------------------------------------
const correr = (script, extra = []) => spawnSync(process.execPath, [path.join(RAIZ, 'scripts', script), ...extra], { cwd: RAIZ, stdio: comoJSON ? 'pipe' : 'inherit', encoding: 'utf8' });

if (!bandera('--sin-verificar')) {
  log('');
  log('→ Verificando que el atlas funcione en este equipo…');
  const v = correr('verificar.mjs');
  if (v.status !== 0) {
    if (comoJSON) console.error(v.stdout, v.stderr);
    console.error('La verificación falló: revisa el mensaje de arriba.');
    process.exit(1);
  }
}

log('');
log('→ Generando los datos del atlas…');
const g = correr('generar-datos.mjs');
if (g.status !== 0) {
  if (comoJSON) console.error(g.stdout, g.stderr);
  console.error('La generación de datos falló: revisa el mensaje de arriba.');
  process.exit(1);
}

let totales = {};
try {
  totales = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos', 'atlas.json'), 'utf8')).totales;
} catch {
  /* sin datos */
}
resumen.totales = totales;

// --- 6. Acceso de doble clic ----------------------------------------------------
// Así quien instala (o la IA que instala por la persona) deja la app lista para
// abrirse con doble clic desde el Escritorio o las Aplicaciones.
if (!bandera('--sin-lanzador')) {
  const l = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'lanzador.mjs'), '--json'], { cwd: RAIZ, encoding: 'utf8' });
  try {
    resumen.lanzadores = JSON.parse((l.stdout || '').trim().split('\n').pop()).lanzadores;
  } catch {
    resumen.avisos = [...(resumen.avisos || []), 'No se pudo crear el acceso de doble clic: npm run lanzador lo reintenta.'];
  }
}
resumen.siguiente = {
  dobleClic: resumen.lanzadores?.length ? `Abre «Atlas de memoria» con doble clic (${process.platform === 'darwin' ? 'en Aplicaciones o el Escritorio' : process.platform === 'win32' ? 'en el Escritorio o el menú Inicio' : 'en el menú de aplicaciones o el Escritorio'})` : null,
  iniciar: process.platform === 'win32' ? 'powershell -ExecutionPolicy Bypass -File iniciar.ps1' : 'bash iniciar.sh',
  url: `http://localhost:${config.puerto}`,
  traducir: totales.sinTraducir ? 'npm run traducir   (o, desde una IA: npm run traducir -- --lotes <carpeta> y luego --importar <carpeta>)' : null,
};

// ¿Está git disponible? Solo se usa para mostrar el repositorio de cada skill.
try {
  execFileSync('git', ['--version'], { stdio: 'ignore' });
} catch {
  resumen.avisos = ['git no está instalado: el atlas funciona igual, pero no mostrará el repositorio de cada skill.'];
}

if (comoJSON) {
  console.log(JSON.stringify(resumen, null, 2));
} else {
  log('');
  log('Listo. Para abrir el atlas:');
  if (resumen.siguiente.dobleClic) {
    log(`  ${resumen.siguiente.dobleClic}.`);
    for (const l of resumen.lanzadores) log(`    · ${abreviar(l)}`);
    log('  o desde la terminal:');
  }
  log(`  ${resumen.siguiente.iniciar}`);
  log(`  y entra a ${resumen.siguiente.url}`);
  if (resumen.siguiente.traducir) log(`  ${totales.sinTraducir} textos esperan traducción al español: ${resumen.siguiente.traducir}`);
  for (const a of resumen.avisos || []) log(`  aviso: ${a}`);
}

// Abrir la app al terminar (lo piden los instaladores de doble clic).
if (bandera('--abrir')) spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'abrir.mjs')], { cwd: RAIZ, stdio: comoJSON ? 'ignore' : 'inherit' });
