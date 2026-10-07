// Preguntar a la memoria: busca las notas que mejor responden una pregunta y, si
// hay una IA instalada en el equipo (Claude Code, Codex o Gemini CLI), le pide que
// responda solo con esas notas y que las cite. Sin IA, devuelve solo las notas.
// La pregunta y esas notas se envían a la IA elegida: la interfaz lo dice.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import MiniSearch from 'minisearch';

const VACIAS = new Set(
  'a al como con cual cuales cuando de del donde el en es esa ese esta este hay la las le lo los me mi mis para pero por que quien se sin sobre su sus te tengo tu un una y ya the of to in and is what how when where who which'.split(' '),
);
const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let cache = { mtime: -1, indice: null, notas: null };

/** Índice de todas las notas (se rehace cuando cambian los datos). */
function indiceDeNotas(datos) {
  const mtime = fs.statSync(path.join(datos, 'atlas.json')).mtimeMs;
  if (cache.mtime === mtime) return cache;
  const atlas = JSON.parse(fs.readFileSync(path.join(datos, 'atlas.json'), 'utf8'));
  const notas = new Map();
  for (const v of atlas.vaults) {
    const vault = JSON.parse(fs.readFileSync(path.join(datos, 'vault', `${v.slug}.json`), 'utf8'));
    for (const n of vault.notas) notas.set(n.id, { ...n, s: v.slug });
  }
  const indice = new MiniSearch({
    fields: ['t', 'h', 'tg', 'ex', 'f'],
    storeFields: ['id'],
    extractField: (doc, campo) => (campo === 'h' ? doc.h.map((x) => x.t).join(' ') : campo === 'tg' ? doc.tg.join(' ') : doc[campo]),
    processTerm: (t) => {
      const n = normalizar(t);
      return n.length < 2 || VACIAS.has(n) ? null : n;
    },
    searchOptions: { boost: { t: 3, h: 2, tg: 1.5 }, prefix: (t) => t.length > 3, fuzzy: (t) => (t.length > 5 ? 0.15 : false) },
  });
  indice.addAll([...notas.values()]);
  cache = { mtime, indice, notas };
  return cache;
}

/** Las notas que mejor responden la pregunta, con un trozo de su contenido. */
export function fuentesPara(pregunta, datos, cuantas = 8) {
  const { indice, notas } = indiceDeNotas(datos);
  const bloques = new Map();
  return indice
    .search(pregunta)
    .slice(0, cuantas)
    .map((r) => {
      const n = notas.get(r.id);
      if (!bloques.has(n.c)) {
        try {
          bloques.set(n.c, JSON.parse(fs.readFileSync(path.join(datos, 'contenido', `${n.c}.json`), 'utf8')));
        } catch {
          bloques.set(n.c, {});
        }
      }
      const texto = String(bloques.get(n.c)[n.id] ?? n.ex ?? '').replace(/\(atlas:[0-9a-f]+\)/g, '');
      // El primer encabezado suele leerse mejor que el nombre del archivo.
      const titulo = n.h?.find((h) => h.n === 1)?.t || n.t;
      return { id: n.id, s: n.s, v: n.v, t: titulo, f: n.f, m: n.m, texto: texto.slice(0, 3000) };
    });
}

// --- IAs instaladas ---------------------------------------------------------------
const IAS = [
  { id: 'claude', nombre: 'Claude Code', comando: 'claude', args: ['-p'], porEntrada: true },
  { id: 'codex', nombre: 'Codex', comando: 'codex', args: ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '-'], porEntrada: true },
  { id: 'gemini', nombre: 'Gemini CLI', comando: 'gemini', args: ['-p'], porEntrada: false },
];

function enRuta(comando) {
  const extensiones = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of extensiones) {
      const abs = path.join(dir, comando + ext);
      try {
        if (fs.statSync(abs).isFile()) return abs;
      } catch {
        /* no está aquí */
      }
    }
  }
  return null;
}

/** Las IAs que pueden responder, en orden: la configurada (`preguntar.ia`) o todas las instaladas. */
export function iasParaPreguntar(preferida = 'auto') {
  if (preferida === 'ninguna') return [];
  const candidatas = preferida === 'auto' ? IAS : IAS.filter((x) => x.id === preferida);
  return candidatas.map((ia) => ({ ...ia, ruta: enRuta(ia.comando) })).filter((ia) => ia.ruta);
}

/**
 * Pregunta a la primera IA disponible; si una falla por no tener sesión iniciada
 * (o credenciales), prueba con la siguiente.
 */
const SIN_SESION = /log ?in|sesi[oó]n|auth|api[ _-]?key|credential|unauthori[sz]ed|401|refresh token/i;

/** Un error de la terminal en una línea legible (sin colores ni marcas de tiempo). */
const limpiarError = (texto) =>
  texto
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

export async function responder(ias, pedido) {
  const sinSesion = [];
  for (const ia of ias) {
    try {
      return { ia: ia.nombre, respuesta: await preguntarIA(ia, pedido) };
    } catch (error) {
      const texto = String(error.message || error);
      if (SIN_SESION.test(texto)) {
        sinSesion.push(ia.nombre);
        continue;
      }
      return { ia: ia.nombre, respuesta: null, error: limpiarError(texto) };
    }
  }
  // Ninguna tenía la sesión iniciada: se dice cuáles y cómo arreglarlo.
  return {
    ia: sinSesion.at(-1) ?? null,
    respuesta: null,
    error: `${sinSesion.join(' y ')} ${sinSesion.length === 1 ? 'no tiene' : 'no tienen'} la sesión iniciada en este equipo. Abre una terminal e inicia sesión (por ejemplo, ejecuta «claude» o «codex login») para que redacten la respuesta`,
  };
}

export function armarPedido(pregunta, fuentes) {
  const notas = fuentes
    .map((f, i) => `[${i + 1}] «${f.t}» (${f.v}${f.f ? ` / ${f.f}` : ''}, modificada ${f.m.slice(0, 10)})\n${f.texto}`)
    .join('\n\n---\n\n');
  return [
    'Eres el asistente del atlas de memoria de una persona (sus notas de Obsidian).',
    'Responde en español, breve y concreto, usando SOLO la información de las notas de abajo.',
    'Si las notas no alcanzan para responder, dilo con claridad y no inventes.',
    'Cita las notas que uses con su número entre corchetes, por ejemplo [1] o [2][3].',
    'No uses herramientas ni leas archivos: todo lo que necesitas está aquí.',
    '',
    `Pregunta: ${pregunta}`,
    '',
    'Notas:',
    notas,
  ].join('\n');
}

/** Ejecuta la IA con el pedido y devuelve su respuesta (texto). */
export function preguntarIA(ia, pedido, tiempo = 120_000) {
  return new Promise((resolve, reject) => {
    // Si el servidor se abrió desde una sesión de Claude Code, la marca de sesión
    // anidada impediría responder: la pregunta es independiente de esa sesión.
    const entorno = { ...process.env };
    delete entorno.CLAUDECODE;
    delete entorno.CLAUDE_CODE_ENTRYPOINT;
    const args = ia.porEntrada ? ia.args : [...ia.args, pedido];
    const hijo = spawn(ia.ruta, args, { env: entorno, cwd: process.cwd(), shell: process.platform === 'win32' });
    let salida = '';
    let errores = '';
    const reloj = setTimeout(() => {
      hijo.kill();
      reject(new Error(`${ia.nombre} tardó demasiado en responder`));
    }, tiempo);
    hijo.stdout.on('data', (d) => (salida += d));
    hijo.stderr.on('data', (d) => (errores += d));
    hijo.on('error', (e) => {
      clearTimeout(reloj);
      reject(e);
    });
    hijo.on('close', (codigo) => {
      clearTimeout(reloj);
      if (codigo === 0 && salida.trim()) resolve(salida.trim());
      else reject(new Error((errores || salida || `${ia.nombre} terminó con código ${codigo}`).trim().split('\n').slice(-3).join(' ')));
    });
    if (ia.porEntrada) hijo.stdin.end(pedido);
    else hijo.stdin.end();
  });
}
