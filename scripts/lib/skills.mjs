// Inventario de skills de todas las IAs: qué hacen, cuándo se activan, qué archivos
// cargan y con qué otras piezas (skills, agentes, notas) se relacionan.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONFIG } from './config.mjs';
import { contarPalabras, limpiarEnLinea, ocultarSecretos, separarFrontmatter, sinBloquesDeCodigo } from './texto.mjs';

const HOME = os.homedir();
const PREFERENCIA_IA = ['Claude', 'Codex', 'Antigravity', 'Extra'];
const MAX_REF_BYTES = 80_000;
const MAX_DETALLE_BYTES = 1_200_000;

// Paquetes: skills que se instalaron juntas y trabajan como familia.
const PAQUETES = [
  { nombre: 'Impeccable', descripcion: 'Comandos de diseño de interfaces (crear, criticar, pulir, animar…).', test: (n) => ['impeccable', 'adapt', 'animate', 'audit', 'bolder', 'clarify', 'colorize', 'critique', 'delight', 'distill', 'harden', 'layout', 'optimize', 'overdrive', 'polish', 'quieter', 'shape', 'typeset'].includes(n) },
  { nombre: 'HyperFrames', descripcion: 'Video y motion graphics hechos con HTML y renderizados a MP4.', test: (n) => n.startsWith('hyperframes') || ['general-video', 'motion-graphics', 'faceless-explainer', 'embedded-captions', 'music-to-video', 'pr-to-video', 'product-launch-video', 'slideshow', 'talking-head-recut', 'remotion-to-hyperframes', 'website-to-video', 'media-use', 'brag'].includes(n) },
  { nombre: 'Higgsfield', descripcion: 'Generación de imagen, video, audio y 3D con Higgsfield.', test: (n) => n.startsWith('higgsfield') },
  { nombre: 'n8n', descripcion: 'Automatizaciones y flujos en n8n.', test: (n) => n.startsWith('n8n-') },
  { nombre: 'Stripe', descripcion: 'Pagos, suscripciones y facturación con Stripe.', test: (n) => n.includes('stripe') },
  { nombre: 'Vercel', descripcion: 'Despliegue y optimización en Vercel.', test: (n) => n.includes('vercel') },
  { nombre: 'Supabase', descripcion: 'Base de datos Postgres, auth y RLS en Supabase.', test: (n) => n.startsWith('supabase') },
  { nombre: 'Remotion', descripcion: 'Video programático con React.', test: (n) => n.startsWith('remotion') },
  { nombre: 'Node.js', descripcion: 'Backends con Node y Express.', test: (n) => n.startsWith('nodejs-') },
  { nombre: 'React', descripcion: 'Patrones y buenas prácticas de React.', test: (n) => n.startsWith('react-') || n === 'composition-patterns' },
  { nombre: 'Contabilidad', descripcion: 'Auditoría, contabilidad y reportes financieros.', test: (n) => n.startsWith('accounting') || n.startsWith('audit-') || n === 'financial-reporting' },
];

// Respaldo cuando el índice de memoria no trae categoría.
const CATEGORIAS = [
  ['Ciberseguridad y auditoría', /security|seguridad|vulnerab|pentest|harden/i],
  ['Video e imagen', /video|image|imagen|animat|motion|remotion|hyperframes|higgsfield|caption|render|3d|photo|elevenlabs|audio|music/i],
  ['Marketing y contenido', /marketing|seo|copy|brand|marca|content|social|ads|email|instagram|linkedin|campaign/i],
  ['Diseño y frontend', /design|diseñ|ui|ux|frontend|css|tailwind|react|layout|typograph|color|component|shadcn|accessib/i],
  ['Automatización e integraciones', /n8n|workflow|automat|linear|integration|api/i],
  ['Backend e infraestructura', /node|server|backend|deploy|docker|postgres|database|strapi|stripe|supabase|dns|vercel|bun|vite|test/i],
  ['Datos y analítica', /data|analytics|sql|dashboard|metric/i],
  ['Memoria y documentación', /memory|memoria|doc|obsidian|graph/i],
];

const NORMALIZAR_CATEGORIA = {
  'Diseno y frontend': 'Diseño y frontend',
  'Automatizacion e integraciones': 'Automatización e integraciones',
  'Memoria y documentacion': 'Memoria y documentación',
  'Datos y analitica': 'Datos y analítica',
};

function categoriasDelIndice() {
  const archivo = path.join(CONFIG.obsidian, '.memoria-system/data/memoria_index.json');
  const mapa = new Map();
  try {
    const indice = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    for (const s of indice.ai_skills || []) {
      if (s.name && s.category && !mapa.has(s.name)) mapa.set(s.name, NORMALIZAR_CATEGORIA[s.category] || s.category);
    }
  } catch {
    /* sin índice: se usa el clasificador */
  }
  return mapa;
}

function buscarSkillMd(dir, profundidad = 0, salida = []) {
  if (profundidad > 4) return salida;
  let entradas;
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return salida;
  }
  if (entradas.some((e) => e.name === 'SKILL.md')) salida.push(path.join(dir, 'SKILL.md'));
  for (const e of entradas) {
    if (['node_modules', '.git', 'graphify-out', '__pycache__'].includes(e.name)) continue;
    if (e.name.startsWith('.') && e.name !== '.system') continue;
    const hijo = path.join(dir, e.name);
    let esDir = e.isDirectory();
    if (e.isSymbolicLink()) {
      try {
        esDir = fs.statSync(hijo).isDirectory();
      } catch {
        esDir = false;
      }
    }
    if (esDir) buscarSkillMd(hijo, profundidad + 1, salida);
  }
  return salida;
}

const cacheGit = new Map();
function infoGit(dir) {
  if (cacheGit.has(dir)) return cacheGit.get(dir);
  let info = null;
  try {
    const raiz = execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    // Las carpetas de configuración (~/.claude, ~/.codex) a veces son repos; no cuentan.
    if (raiz && raiz !== HOME && !raiz.startsWith(`${HOME}${path.sep}.`)) {
      let remoto = '';
      try {
        remoto = execFileSync('git', ['-C', raiz, 'config', '--get', 'remote.origin.url'], { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim()
          .replace(/\.git$/, '')
          .replace(/^git@github\.com:/, 'https://github.com/')
          .replace(/https:\/\/[^@/]+@/, 'https://');
      } catch {
        /* repo sin remoto */
      }
      info = { raiz, remoto };
    }
  } catch {
    info = null;
  }
  cacheGit.set(dir, info);
  return info;
}

function oraciones(texto) {
  return texto
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ"“(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function analizarDescripcion(descripcion) {
  const que = [];
  const cuando = [];
  const noPara = [];
  for (const o of oraciones(descripcion)) {
    if (/^(not for|do not|don't|never|no es para|no usar|skip|not a )/i.test(o)) noPara.push(o);
    else if (/^(use|úsala|usar|trigger|triggers|also use|also trigger|reach for|invoke|activate|mandatory|call with|spanish triggers|examples?:)/i.test(o) || /\b(use when|use whenever|use this skill|trigger on)\b/i.test(o)) cuando.push(o);
    else que.push(o);
  }
  const activadores = new Set();
  for (const m of descripcion.matchAll(/["“]([^"”]{2,70})["”]/g)) activadores.add(m[1].trim());
  return { que, cuando, noPara, activadores: [...activadores].slice(0, 40) };
}

function seccionesConResumen(cuerpo) {
  const lineas = cuerpo.split('\n');
  const salida = [];
  let enCodigo = false;
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (/^(```|~~~)/.test(linea)) enCodigo = !enCodigo;
    if (enCodigo) continue;
    const m = linea.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!m) continue;
    let resumen = '';
    for (let j = i + 1; j < lineas.length && j < i + 25; j++) {
      const l = lineas[j].trim();
      if (/^#{1,6}\s/.test(l)) break;
      if (!l || /^(```|~~~|\||---|<)/.test(l)) {
        if (resumen) break;
        continue;
      }
      resumen += `${limpiarEnLinea(l.replace(/^[-*+>]\s+|^\d+\.\s+/, ''))} `;
      if (resumen.length > 220) break;
    }
    resumen = resumen.trim();
    salida.push({ n: m[1].length, t: limpiarEnLinea(m[2]), r: resumen.length > 230 ? `${resumen.slice(0, 229)}…` : resumen });
    if (salida.length >= 60) break;
  }
  return salida;
}

function clasificarArchivo(rel) {
  const primero = rel.split('/')[0].toLowerCase();
  if (['references', 'referencias', 'reference', 'docs', 'rules', 'reglas', 'guides', 'knowledge'].includes(primero)) return 'referencias';
  if (['scripts', 'bin', 'tools', 'herramientas'].includes(primero) || /\.(mjs|cjs|js|ts|py|sh|rb)$/.test(rel)) return 'scripts';
  if (['assets', 'templates', 'plantillas', 'examples', 'ejemplos', 'resources', 'recursos', 'fonts', 'images'].includes(primero)) return 'recursos';
  return 'otros';
}

function listarArchivos(dirSkill) {
  const salida = [];
  const pila = [['', 0]];
  while (pila.length && salida.length < 400) {
    const [rel, prof] = pila.pop();
    let entradas;
    try {
      entradas = fs.readdirSync(path.join(dirSkill, rel), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entradas) {
      if (e.name.startsWith('.') || ['node_modules', 'graphify-out', '__pycache__'].includes(e.name)) continue;
      const relHijo = rel ? `${rel}/${e.name}` : e.name;
      const abs = path.join(dirSkill, relHijo);
      let stat;
      try {
        stat = fs.statSync(abs);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        // Una subcarpeta con su propio SKILL.md es otra skill: se lista aparte.
        if (fs.existsSync(path.join(abs, 'SKILL.md'))) continue;
        if (prof < 4) pila.push([relHijo, prof + 1]);
      } else if (relHijo !== 'SKILL.md') {
        salida.push({ r: relHijo, b: stat.size, k: clasificarArchivo(relHijo) });
      }
    }
  }
  return salida.sort((a, b) => a.r.localeCompare(b.r));
}

function tituloDeArchivo(abs) {
  try {
    const texto = fs.readFileSync(abs, 'utf8').slice(0, 4000);
    const { fm, cuerpo } = separarFrontmatter(texto);
    if (typeof fm.title === 'string') return fm.title;
    if (typeof fm.name === 'string' && typeof fm.description === 'string') return fm.description.slice(0, 120);
    const h = cuerpo.match(/^#\s+(.+)$/m);
    return h ? limpiarEnLinea(h[1]) : '';
  } catch {
    return '';
  }
}

// Detecta menciones a otras skills. Los nombres de una sola palabra («layout»,
// «audit», «polish») son palabras comunes: solo cuentan entre `comillas` o como /comando.
export function crearDetectorDeMenciones(nombres) {
  const compuestos = [];
  const simples = new Set();
  for (const n of nombres) (n.includes('-') ? compuestos.push(n) : simples.add(n));
  const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reCompuestos = compuestos.length
    ? new RegExp(`(?<![\\w-])(${compuestos.sort((a, b) => b.length - a.length).map(escapar).join('|')})(?![\\w-])`, 'g')
    : null;
  return (texto, excluir) => {
    const encontrados = new Set();
    if (reCompuestos) for (const m of texto.matchAll(reCompuestos)) encontrados.add(m[1]);
    for (const m of texto.matchAll(/(?:`\/?([a-z0-9][a-z0-9:_-]*)`|(?:^|\s)\/([a-z][a-z0-9-]+)\b)/g)) {
      const n = (m[1] || m[2] || '').split(':').pop();
      if (simples.has(n) || nombres.has(n)) encontrados.add(n);
    }
    encontrados.delete(excluir);
    return [...encontrados];
  };
}

export function leerSkills(contadorSecretos, notasTodas) {
  const categorias = categoriasDelIndice();
  const instalaciones = [];
  const vistos = new Set();

  for (const fuente of CONFIG.fuentesSkills) {
    if (!fs.existsSync(fuente.dir)) continue;
    for (const archivo of buscarSkillMd(fuente.dir)) {
      const clave = `${fuente.ia}|${archivo}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const dir = path.dirname(archivo);
      let real = dir;
      try {
        real = fs.realpathSync(dir);
      } catch {
        /* enlace roto */
      }
      let crudo;
      try {
        crudo = fs.readFileSync(archivo, 'utf8');
      } catch {
        continue;
      }
      const { fm, cuerpo } = separarFrontmatter(crudo);
      const nombre = String(fm.name || path.basename(dir)).trim();
      const relFuente = path.relative(fuente.dir, dir);
      const padre = relFuente.includes(path.sep) ? relFuente.split(path.sep)[0] : null;
      instalaciones.push({ ia: fuente.ia, nombre, dir, real, fm, cuerpo, sistema: relFuente.startsWith('.system'), padre: padre && padre !== '.system' ? padre : null });
    }
  }

  // Agrupar por nombre; el contenido se toma de la instalación preferida.
  const grupos = new Map();
  for (const inst of instalaciones) {
    if (!grupos.has(inst.nombre)) grupos.set(inst.nombre, []);
    grupos.get(inst.nombre).push(inst);
  }
  const nombres = new Set(grupos.keys());
  const mencionadas = crearDetectorDeMenciones(nombres);

  const notasSkills = new Map();
  for (const n of notasTodas) {
    if (n.v !== 'TALLERES IA') continue;
    const m = n.nb.match(/^(Claude|Codex|Antigravity) - (.+)$/);
    if (m && n.f === 'Skills') {
      if (!notasSkills.has(m[2])) notasSkills.set(m[2], []);
      notasSkills.get(m[2]).push(n.id);
    }
  }

  const skills = [];
  const detalles = new Map();
  for (const [nombre, lista] of grupos) {
    lista.sort((a, b) => PREFERENCIA_IA.indexOf(a.ia) - PREFERENCIA_IA.indexOf(b.ia));
    const principal = lista[0];
    const cuerpo = ocultarSecretos(principal.cuerpo, contadorSecretos);
    const descripcion = ocultarSecretos(String(principal.fm.description || '').replace(/\s+/g, ' ').trim(), contadorSecretos);
    const analisis = analizarDescripcion(descripcion);
    const archivos = listarArchivos(principal.real);
    const git = infoGit(principal.real);
    const h1 = cuerpo.match(/^#\s+(.+)$/m);
    const paquete = PAQUETES.find((p) => p.test(nombre));
    const enProyectos = /\/PROYECTOS\//.test(principal.real);
    const propia = enProyectos || /anndreloopez012/.test(git?.remoto || '') || /alcore|campuslands|kinvo|softplus/i.test(nombre);
    const categoria =
      categorias.get(nombre) || CATEGORIAS.find(([, re]) => re.test(`${nombre} ${descripcion}`))?.[0] || 'General';

    // Referencias en texto: se guardan para leerlas dentro del atlas.
    const referencias = {};
    let bytes = cuerpo.length;
    for (const a of archivos) {
      if (!/\.(md|txt)$/i.test(a.r) || a.b > MAX_REF_BYTES * 3) continue;
      if (bytes > MAX_DETALLE_BYTES) break;
      try {
        let texto = fs.readFileSync(path.join(principal.real, a.r), 'utf8');
        if (texto.length > MAX_REF_BYTES) texto = `${texto.slice(0, MAX_REF_BYTES)}\n\n…(recortado: abre el archivo para verlo completo)`;
        referencias[a.r] = ocultarSecretos(texto, contadorSecretos);
        bytes += texto.length;
        a.t = tituloDeArchivo(path.join(principal.real, a.r));
      } catch {
        /* archivo ilegible */
      }
    }

    const extras = {};
    for (const [k, v] of Object.entries(principal.fm)) {
      if (['name', 'description'].includes(k) || v == null) continue;
      extras[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }

    skills.push({
      id: nombre,
      nombre,
      titulo: h1 ? limpiarEnLinea(h1[1]) : nombre,
      descripcion,
      que: analisis.que,
      cuando: analisis.cuando,
      noPara: analisis.noPara,
      activadores: analisis.activadores,
      categoria,
      paquete: paquete?.nombre || null,
      origen: principal.sistema ? 'sistema' : propia ? 'propia' : 'instalada',
      padre: principal.padre && nombres.has(principal.padre) ? principal.padre : null,
      repo: git ? { remoto: git.remoto, raiz: git.raiz } : null,
      instalaciones: lista.map((i) => ({ ia: i.ia, ruta: i.dir, real: i.real !== i.dir ? i.real : null })),
      ias: [...new Set(lista.map((i) => i.ia))],
      secciones: seccionesConResumen(cuerpo),
      palabras: contarPalabras(cuerpo),
      archivos,
      relacionadas: mencionadas(`${sinBloquesDeCodigo(cuerpo)} ${(cuerpo.match(/`[^`\n]+`/g) || []).join(' ')}`, nombre).slice(0, 30),
      extras,
      notas: (notasSkills.get(nombre) || []).slice(0, 6),
      ruta: principal.real,
    });
    detalles.set(nombre, { cuerpo, referencias });
  }

  const paquetes = PAQUETES.map((p) => ({ nombre: p.nombre, descripcion: p.descripcion, skills: skills.filter((s) => s.paquete === p.nombre).map((s) => s.id) })).filter((p) => p.skills.length);

  return { skills: skills.sort((a, b) => a.nombre.localeCompare(b.nombre)), detalles, paquetes, nombres, mencionadas, totalInstalaciones: instalaciones.length };
}
