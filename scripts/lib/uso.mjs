// Uso real de las skills: cuántas veces las usaron tus IAs y cuándo fue la última,
// leyendo los historiales locales de Claude Code y Codex. Solo se guardan conteos y
// fechas: nunca el contenido de las conversaciones, y nada sale del equipo.
//
// - Claude Code (`~/.claude/projects/**/*.jsonl`): cada llamada a la herramienta
//   Skill y cada `/<skill>` escrito por la persona cuenta como un uso.
// - Codex (`~/.codex/sessions/**/*.jsonl`): una sesión que lee el SKILL.md de una
//   skill (con una herramienta, no la lista de skills disponibles) cuenta como un uso.
//
// Los historiales pesan gigas: se buscan solo las marcas con búsquedas binarias, se
// recuerda lo leído de cada archivo (por tamaño y fecha) y cada corrida tiene un
// tope de tiempo; lo que falte se lee en las siguientes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONFIG } from './config.mjs';

const DIAS = 180;
const TOPE_MS = 6000;
const VERSION_CACHE = 1;

function listar(dir, desde) {
  const salida = [];
  const pila = [dir];
  while (pila.length) {
    const actual = pila.pop();
    let entradas;
    try {
      entradas = fs.readdirSync(actual, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entradas) {
      const abs = path.join(actual, e.name);
      if (e.isDirectory()) pila.push(abs);
      else if (e.name.endsWith('.jsonl')) {
        try {
          const st = fs.statSync(abs);
          if (st.mtimeMs >= desde) salida.push({ abs, m: st.mtimeMs, b: st.size });
        } catch {
          /* archivo que desapareció */
        }
      }
    }
  }
  return salida;
}

const MARCAS = {
  Claude: ['"name":"Skill"', '<command-name>'].map((t) => Buffer.from(t)),
  Codex: [Buffer.from('SKILL.md')],
};

/** Lee un historial y devuelve { skill: [usos, últimaFecha] }. */
function leerArchivo(ia, abs, nombres) {
  const usos = {};
  const contar = (skill, fecha, unaVezPorArchivo) => {
    const nombre = skill.replace(/^[^:]+:/, '');
    if (!nombres.has(nombre)) return;
    const actual = usos[nombre] || [0, ''];
    if (!(unaVezPorArchivo && actual[0] > 0)) actual[0] += 1;
    if (fecha > actual[1]) actual[1] = fecha;
    usos[nombre] = actual;
  };
  let datos;
  try {
    datos = fs.readFileSync(abs);
  } catch {
    return usos;
  }
  const vistas = new Set();
  for (const marca of MARCAS[ia]) {
    let pos = datos.indexOf(marca);
    while (pos !== -1) {
      const inicio = datos.lastIndexOf(10, pos) + 1;
      let fin = datos.indexOf(10, pos);
      if (fin === -1) fin = datos.length;
      if (!vistas.has(inicio)) {
        vistas.add(inicio);
        // Solo lo necesario de la línea: el principio (tipo y fecha) y alrededor de la marca.
        const cabeza = datos.toString('utf8', inicio, Math.min(fin, inicio + 400));
        const fecha = (cabeza.match(/"timestamp":"([^"]+)"/) || datos.toString('utf8', Math.max(inicio, fin - 300), fin).match(/"timestamp":"([^"]+)"/) || [])[1] || '';
        const zona = datos.toString('utf8', Math.max(inicio, pos - 400), Math.min(fin, pos + 300));
        if (ia === 'Claude') {
          for (const m of zona.matchAll(/"name":"Skill","input":\{"skill":"([^"]+)"/g)) contar(m[1], fecha, false);
          for (const m of zona.matchAll(/<command-name>\/?([^<\s]+)<\/command-name>/g)) contar(m[1], fecha, false);
        } else if (/"type":"function_call"|"function_call"/.test(cabeza)) {
          for (const m of zona.matchAll(/skills\/([A-Za-z0-9._-]+)\/SKILL\.md/g)) contar(m[1], fecha, true);
        }
      }
      pos = datos.indexOf(marca, fin);
    }
  }
  return usos;
}

/**
 * @param {Set<string>} nombres nombres de las skills de este equipo
 * @returns {{ porSkill: Map<string, { total: number, ultimo: string, ias: Record<string, number> }>, resumen: object }}
 */
export function leerUso(nombres) {
  const resumen = { activo: CONFIG.uso, dias: DIAS, fuentes: [], completo: true, leidos: 0, total: 0 };
  const porSkill = new Map();
  if (!CONFIG.uso) return { porSkill, resumen };

  const desde = Date.now() - DIAS * 86_400_000;
  const casa = os.homedir();
  const fuentes = [
    { ia: 'Claude', dir: path.join(process.env.CLAUDE_CONFIG_DIR || path.join(casa, '.claude'), 'projects') },
    { ia: 'Codex', dir: path.join(process.env.CODEX_HOME || path.join(casa, '.codex'), 'sessions') },
  ].filter((f) => fs.existsSync(f.dir));

  const archivoCache = path.join(path.dirname(CONFIG.salida), '.atlas-cache', 'uso.json');
  let cache = { version: VERSION_CACHE, archivos: {} };
  try {
    const leido = JSON.parse(fs.readFileSync(archivoCache, 'utf8'));
    if (leido.version === VERSION_CACHE) cache = leido;
  } catch {
    /* primera vez */
  }

  const inicio = Date.now();
  const vigentes = {};
  for (const { ia, dir } of fuentes) {
    const archivos = listar(dir, desde).sort((a, b) => b.m - a.m);
    resumen.fuentes.push({ ia, archivos: archivos.length });
    resumen.total += archivos.length;
    for (const a of archivos) {
      const previo = cache.archivos[a.abs];
      if (previo && previo.m === a.m && previo.b === a.b) {
        vigentes[a.abs] = previo;
      } else if (Date.now() - inicio < TOPE_MS) {
        // Un historial de más de 1,5 GB no se lee (no cabe de una vez en memoria).
        vigentes[a.abs] = { ia, m: a.m, b: a.b, usos: a.b > 1_500_000_000 ? {} : leerArchivo(ia, a.abs, nombres) };
      } else {
        resumen.completo = false;
        if (previo) vigentes[a.abs] = previo;
        continue;
      }
      resumen.leidos += 1;
    }
  }

  // Se guardan solo los archivos que siguen existiendo y en la ventana de días.
  try {
    fs.mkdirSync(path.dirname(archivoCache), { recursive: true });
    fs.writeFileSync(archivoCache, JSON.stringify({ version: VERSION_CACHE, archivos: vigentes }));
  } catch {
    /* sin caché: la próxima corrida vuelve a leer */
  }

  for (const { ia, usos } of Object.values(vigentes)) {
    for (const [skill, [n, fecha]] of Object.entries(usos)) {
      if (!nombres.has(skill)) continue;
      const u = porSkill.get(skill) || { total: 0, ultimo: '', ias: {} };
      u.total += n;
      u.ias[ia] = (u.ias[ia] || 0) + n;
      if (fecha > u.ultimo) u.ultimo = fecha;
      porSkill.set(skill, u);
    }
  }
  return { porSkill, resumen };
}
