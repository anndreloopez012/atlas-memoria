// Actualizaciones: busca si hay una versión nueva publicada en GitHub (Releases) y
// la instala sobre esta copia sin tocar lo de la persona (configuración, datos,
// caché, dependencias ya instaladas).
//
// - Se revisa como mucho dos veces al día (caché en .atlas-cache/actualizacion.json).
// - Repositorio: `actualizaciones.repo` en atlas.config.json, ATLAS_REPO o el de package.json.
//   `"actualizaciones": false` (o ATLAS_ACTUALIZAR=0) lo apaga.
// - Una copia que es un repositorio git no se actualiza así: se usa git pull.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = path.join(RAIZ, '.atlas-cache');
const ARCHIVO_CACHE = path.join(CACHE, 'actualizacion.json');
const MANIFIESTO = path.join(CACHE, 'manifiesto.json');
const CADA = 12 * 60 * 60 * 1000;
// Lo de la persona: nunca se reemplaza ni se borra.
const PROTEGIDO = /^(atlas\.config\.json|datos|dist|node_modules|\.atlas-cache|\.git)(\/|$)/;

const leerJSON = (archivo, otro = null) => {
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf8'));
  } catch {
    return otro;
  }
};

export const versionActual = () => leerJSON(path.join(RAIZ, 'package.json'), {}).version ?? '0.0.0';

function ajustes() {
  const config = leerJSON(process.env.ATLAS_CONFIG ? path.resolve(process.env.ATLAS_CONFIG) : path.join(RAIZ, 'atlas.config.json'), {});
  const paquete = leerJSON(path.join(RAIZ, 'package.json'), {});
  const desdePaquete = String(paquete.repository?.url ?? paquete.repository ?? '').match(/github(?:\.com[/:]|:)([\w.-]+\/[\w.-]+?)(?:\.git)?$/)?.[1];
  const apagado = process.env.ATLAS_ACTUALIZAR === '0' || config.actualizaciones === false;
  return {
    activo: !apagado,
    repo: process.env.ATLAS_REPO || config.actualizaciones?.repo || desdePaquete || null,
    api: (process.env.ATLAS_API_GITHUB || 'https://api.github.com').replace(/\/+$/, ''),
  };
}

/** ¿`a` es más nueva que `b`? (1.10.0 > 1.9.3) */
export function esMasNueva(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.-]/).map((x) => Number(x) || 0);
  const pb = String(b).replace(/^v/, '').split(/[.-]/).map((x) => Number(x) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

/** Esta copia se maneja con git (una persona que desarrolla): no se actualiza sola. */
export const esCopiaGit = () => fs.existsSync(path.join(RAIZ, '.git'));

/**
 * Busca la última versión publicada.
 * @returns {Promise<{ actual: string, nueva: null | { version: string, notas: string, url: string, zip: string }, error?: string, git?: boolean }>}
 */
export async function buscarActualizacion({ forzar = false } = {}) {
  const actual = versionActual();
  const { activo, repo, api } = ajustes();
  if (!activo || !repo) return { actual, nueva: null };
  const previa = leerJSON(ARCHIVO_CACHE);
  let ultima = previa?.repo === repo && !forzar && Date.now() - previa.revisado < CADA ? previa.ultima : undefined;
  if (ultima === undefined) {
    try {
      const r = await fetch(`${api}/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'atlas-memoria' }, signal: AbortSignal.timeout(8000) });
      if (r.status === 404) ultima = null; // sin versiones publicadas (o repositorio privado)
      else if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
      else {
        const d = await r.json();
        const zip = (d.assets ?? []).find((a) => a.name.endsWith('.zip'))?.browser_download_url;
        ultima = zip ? { version: String(d.tag_name).replace(/^v/, ''), notas: String(d.body ?? ''), url: d.html_url, zip } : null;
      }
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(ARCHIVO_CACHE, JSON.stringify({ repo, revisado: Date.now(), ultima }));
    } catch (error) {
      return { actual, nueva: null, error: `No se pudo revisar si hay versión nueva: ${error.message}` };
    }
  }
  const nueva = ultima && esMasNueva(ultima.version, actual) ? ultima : null;
  return { actual, nueva, ...(nueva && esCopiaGit() ? { git: true } : {}) };
}

/** Descomprime un zip (deflate o sin comprimir) en `destino`. Sin dependencias externas. */
export function descomprimir(buffer, destino) {
  const fin = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fin < 0) throw new Error('El archivo descargado no es un zip');
  const total = buffer.readUInt16LE(fin + 10);
  let p = buffer.readUInt32LE(fin + 16);
  const archivos = [];
  for (let i = 0; i < total; i++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) throw new Error('Zip dañado');
    const metodo = buffer.readUInt16LE(p + 10);
    const tamano = buffer.readUInt32LE(p + 20);
    const largoNombre = buffer.readUInt16LE(p + 28);
    const largoExtra = buffer.readUInt16LE(p + 30);
    const largoComentario = buffer.readUInt16LE(p + 32);
    const atributos = buffer.readUInt32LE(p + 38);
    const local = buffer.readUInt32LE(p + 42);
    const nombre = buffer.toString('utf8', p + 46, p + 46 + largoNombre);
    p += 46 + largoNombre + largoExtra + largoComentario;
    const abs = path.resolve(destino, nombre);
    if (!abs.startsWith(path.resolve(destino) + path.sep)) throw new Error(`Ruta no válida en el zip: ${nombre}`);
    if (nombre.endsWith('/')) {
      fs.mkdirSync(abs, { recursive: true });
      continue;
    }
    const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const datos = buffer.subarray(inicio, inicio + tamano);
    const contenido = metodo === 0 ? datos : metodo === 8 ? zlib.inflateRawSync(datos) : null;
    if (!contenido) throw new Error(`Compresión no soportada en ${nombre}`);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contenido);
    const modo = (atributos >>> 16) & 0o777;
    if (modo && process.platform !== 'win32') fs.chmodSync(abs, modo);
    archivos.push(nombre);
  }
  return archivos;
}

function listar(dir, base = dir, salida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) listar(abs, base, salida);
    else salida.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return salida;
}

/**
 * Descarga e instala la versión nueva sobre esta copia.
 * @param {{ version: string, zip: string }} nueva
 * @param {(paso: string) => void} [avisar]
 */
export async function aplicarActualizacion(nueva, avisar = () => {}) {
  if (esCopiaGit()) return { ok: false, error: 'Esta copia es un repositorio git: actualízala con git pull.' };
  const trabajo = path.join(CACHE, 'actualizacion');
  fs.rmSync(trabajo, { recursive: true, force: true });
  fs.mkdirSync(trabajo, { recursive: true });

  avisar(`Descargando la versión ${nueva.version}…`);
  const r = await fetch(nueva.zip, { headers: { 'User-Agent': 'atlas-memoria' }, signal: AbortSignal.timeout(120_000) });
  if (!r.ok) return { ok: false, error: `No se pudo descargar (${r.status})` };
  const zip = Buffer.from(await r.arrayBuffer());

  avisar('Preparando los archivos…');
  const extraida = path.join(trabajo, 'nueva');
  descomprimir(zip, extraida);
  // El zip trae una carpeta raíz («Atlas de memoria/»).
  const entradas = fs.readdirSync(extraida);
  const raizNueva = entradas.length === 1 && fs.statSync(path.join(extraida, entradas[0])).isDirectory() ? path.join(extraida, entradas[0]) : extraida;
  if (!fs.existsSync(path.join(raizNueva, 'package.json')) || !fs.existsSync(path.join(raizNueva, 'scripts', 'abrir.mjs'))) return { ok: false, error: 'La descarga no parece una versión del atlas' };

  avisar('Instalando…');
  const nuevos = listar(raizNueva).filter((rel) => !PROTEGIDO.test(rel));
  const lockAntes = fs.existsSync(path.join(RAIZ, 'package-lock.json')) ? fs.readFileSync(path.join(RAIZ, 'package-lock.json'), 'utf8') : '';
  for (const rel of nuevos) {
    const destino = path.join(RAIZ, rel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(path.join(raizNueva, rel), destino);
    fs.chmodSync(destino, fs.statSync(path.join(raizNueva, rel)).mode & 0o777);
  }
  // Lo que traía la versión anterior y ya no existe en la nueva se quita.
  const anteriores = leerJSON(MANIFIESTO, []);
  for (const rel of anteriores) if (!nuevos.includes(rel) && !PROTEGIDO.test(rel)) fs.rmSync(path.join(RAIZ, rel), { force: true });
  fs.writeFileSync(MANIFIESTO, JSON.stringify(nuevos));

  const lockDespues = fs.readFileSync(path.join(RAIZ, 'package-lock.json'), 'utf8');
  if (lockDespues !== lockAntes) {
    avisar('Actualizando dependencias…');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const i = spawnSync(npm, ['install', '--no-fund', '--no-audit'], { cwd: RAIZ, encoding: 'utf8', shell: process.platform === 'win32' });
    if (i.status !== 0) return { ok: false, error: 'npm install falló: revisa la conexión a internet y vuelve a intentar.' };
  }
  fs.rmSync(trabajo, { recursive: true, force: true });
  fs.rmSync(ARCHIVO_CACHE, { force: true });
  return { ok: true, version: nueva.version };
}
