// Detecta lo que tiene cada equipo: vaults de Obsidian, carpetas de skills y de
// agentes de Claude Code, Codex y Antigravity (incluidos sus plugins activos) y
// un posible sistema de memoria tipo `.memoria-system`. No escribe nada: devuelve
// lo encontrado para que el instalador arme atlas.config.json.
//
// Funciona en macOS, Windows y Linux. Todas las rutas se calculan a partir de
// `home` (y de las variables de entorno que cada IA respeta), así se puede probar
// con un HOME falso (ver scripts/verificar.mjs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OMITIR_AL_BUSCAR = new Set(['node_modules', '.git', '.Trash', '.trash', 'Library', 'AppData', 'Applications', '$RECYCLE.BIN', 'dist', 'build', '.next', 'vendor', '__pycache__']);

const existe = (ruta) => {
  try {
    return fs.statSync(ruta).isDirectory();
  } catch {
    return false;
  }
};

const real = (ruta) => {
  try {
    return fs.realpathSync(ruta);
  } catch {
    return path.resolve(ruta);
  }
};

const leerJSON = (archivo) => {
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf8'));
  } catch {
    return null;
  }
};

/** Cuenta SKILL.md bajo una carpeta (sigue enlaces simbólicos, sin repetir carpetas). */
export function contarSkills(dir, profundidad = 4) {
  let total = 0;
  const vistos = new Set();
  const visitar = (actual, nivel) => {
    if (nivel > profundidad) return;
    const r = real(actual);
    if (vistos.has(r)) return;
    vistos.add(r);
    let entradas;
    try {
      entradas = fs.readdirSync(actual, { withFileTypes: true });
    } catch {
      return;
    }
    if (entradas.some((e) => e.name === 'SKILL.md')) total += 1;
    for (const e of entradas) {
      if (OMITIR_AL_BUSCAR.has(e.name) || (e.name.startsWith('.') && e.name !== '.system')) continue;
      const hijo = path.join(actual, e.name);
      if (e.isDirectory() || (e.isSymbolicLink() && existe(hijo))) visitar(hijo, nivel + 1);
    }
  };
  visitar(dir, 0);
  return total;
}

const contarAgentes = (dir) => {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).length;
  } catch {
    return 0;
  }
};

// --- Vaults -------------------------------------------------------------------

/** Archivos donde Obsidian registra los vaults que se abrieron en este equipo. */
export function registrosDeObsidian(home, plataforma, env) {
  if (plataforma === 'darwin') return [path.join(home, 'Library/Application Support/obsidian/obsidian.json')];
  if (plataforma === 'win32') {
    const appdata = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return [path.join(appdata, 'obsidian', 'obsidian.json')];
  }
  const config = env.XDG_CONFIG_HOME || path.join(home, '.config');
  return [
    path.join(config, 'obsidian', 'obsidian.json'),
    path.join(home, '.var/app/md.obsidian.Obsidian/config/obsidian/obsidian.json'),
    path.join(home, 'snap/obsidian/current/.config/obsidian/obsidian.json'),
  ];
}

/** Busca carpetas con `.obsidian/` (un vault) sin entrar en carpetas pesadas. */
function buscarVaults(raices, profundidad = 3, limite = 25_000) {
  const encontrados = [];
  const vistos = new Set();
  let revisadas = 0;
  const visitar = (dir, nivel) => {
    if (nivel > profundidad || revisadas > limite) return;
    const r = real(dir);
    if (vistos.has(r)) return;
    vistos.add(r);
    revisadas += 1;
    let entradas;
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entradas.some((e) => e.name === '.obsidian' && (e.isDirectory() || e.isSymbolicLink()))) {
      encontrados.push(dir);
      return; // un vault dentro de otro es raro: no se sigue bajando
    }
    for (const e of entradas) {
      if (e.name.startsWith('.') || OMITIR_AL_BUSCAR.has(e.name)) continue;
      const hijo = path.join(dir, e.name);
      if (e.isDirectory() || (e.isSymbolicLink() && existe(hijo))) visitar(hijo, nivel + 1);
    }
  };
  // `desde` es el nivel con el que empieza cada raíz: cuanto más alto, menos se baja.
  for (const { ruta, desde } of raices) if (existe(ruta)) visitar(ruta, desde);
  return encontrados;
}

function detectarVaults(home, plataforma, env) {
  // 1) Lo que Obsidian ya conoce: son los vaults que la persona abre de verdad.
  const registrados = [];
  for (const archivo of registrosDeObsidian(home, plataforma, env)) {
    const datos = leerJSON(archivo);
    for (const v of Object.values(datos?.vaults || {})) {
      if (v?.path && existe(path.join(v.path, '.obsidian'))) registrados.push({ ruta: v.path, origen: 'obsidian' });
    }
  }

  // 2) Búsqueda en las carpetas habituales (por si Obsidian no está instalado o
  //    los vaults llegaron por sincronización).
  const raices = [
    { ruta: path.join(home, 'Documents'), desde: 0 },
    { ruta: path.join(home, 'Documentos'), desde: 0 },
    { ruta: path.join(home, 'Obsidian'), desde: 0 },
    { ruta: path.join(home, 'Desktop'), desde: 1 },
    { ruta: path.join(home, 'Dropbox'), desde: 1 },
    { ruta: path.join(home, 'OneDrive'), desde: 1 },
    { ruta: path.join(home, 'Library/Mobile Documents/iCloud~md~obsidian/Documents'), desde: 1 },
    { ruta: home, desde: 2 },
  ];
  if (env.ATLAS_OBSIDIAN) raices.unshift({ ruta: env.ATLAS_OBSIDIAN, desde: 0 });
  const buscados = buscarVaults(raices).map((ruta) => ({ ruta, origen: 'busqueda' }));

  // Si Obsidian tiene registro, se usan sus vaults; lo demás queda como sugerencia
  // (puede ser un vault viejo o una carpeta .obsidian dentro de un repositorio).
  const unicos = (lista) => {
    const vistos = new Set();
    return lista.filter((v) => {
      const r = real(v.ruta);
      if (vistos.has(r)) return false;
      vistos.add(r);
      return true;
    });
  };
  const forzados = env.ATLAS_OBSIDIAN ? buscados.filter((v) => real(v.ruta).startsWith(real(env.ATLAS_OBSIDIAN))) : [];
  const principales = unicos(registrados.length ? [...registrados, ...forzados] : buscados);
  const yaIncluidos = new Set(principales.map((v) => real(v.ruta)));
  const sugerencias = unicos(buscados).filter((v) => !yaIncluidos.has(real(v.ruta)));
  return { principales, sugerencias };
}

/** `.memoria-system` junto a los vaults (el motor de memoria multi-vault). */
function detectarSistemaMemoria(vaults, env) {
  const candidatos = new Set(vaults.map((v) => path.dirname(v.ruta)));
  if (env.ATLAS_OBSIDIAN) candidatos.add(env.ATLAS_OBSIDIAN);
  for (const contenedor of candidatos) {
    const dir = path.join(contenedor, '.memoria-system');
    if (fs.existsSync(path.join(dir, 'config', 'vaults.json'))) return dir;
  }
  return null;
}

// Nombre visible de cada vault: el de la carpeta (como en Obsidian). Si dos se
// llaman igual, se agrega la carpeta de arriba para distinguirlos.
function nombrarVaults(lista) {
  const conteo = new Map();
  for (const v of lista) conteo.set(path.basename(v.ruta), (conteo.get(path.basename(v.ruta)) || 0) + 1);
  return lista.map((v) => {
    const base = path.basename(v.ruta);
    return { ...v, nombre: conteo.get(base) > 1 ? `${base} (${path.basename(path.dirname(v.ruta))})` : base };
  });
}

// --- Skills y agentes ---------------------------------------------------------

function carpetasBase(home, env) {
  return {
    claude: env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'),
    codex: env.CODEX_HOME || path.join(home, '.codex'),
    gemini: path.join(home, '.gemini'),
    agents: path.join(home, '.agents'),
  };
}

/** Plugins activos de Codex: `[plugins."nombre@mercado"] enabled = true` en config.toml. */
function pluginsDeCodex(codex) {
  let texto = '';
  try {
    texto = fs.readFileSync(path.join(codex, 'config.toml'), 'utf8');
  } catch {
    return [];
  }
  const activos = [];
  for (const m of texto.matchAll(/^\[plugins\."([^"]+)"\]\s*\n((?:(?!\[).*\n?)*)/gm)) {
    if (!/^\s*enabled\s*=\s*true/m.test(m[2])) continue;
    const [nombre, mercado] = m[1].split('@');
    const base = path.join(codex, 'plugins', 'cache', mercado || '', nombre);
    let versiones = [];
    try {
      versiones = fs
        .readdirSync(base)
        .map((v) => path.join(base, v))
        .filter(existe)
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    } catch {
      continue;
    }
    if (versiones[0]) activos.push({ nombre, dir: versiones[0] });
  }
  return activos;
}

/** Plugins instalados de Claude Code (installed_plugins.json + enabledPlugins). */
function pluginsDeClaude(claude) {
  const instalados = leerJSON(path.join(claude, 'plugins', 'installed_plugins.json'));
  if (!instalados) return [];
  const ajustes = leerJSON(path.join(claude, 'settings.json')) || {};
  const habilitados = ajustes.enabledPlugins || {};
  const salida = [];
  for (const [clave, valor] of Object.entries(instalados.plugins || instalados)) {
    if (habilitados[clave] === false) continue;
    const entradas = Array.isArray(valor) ? valor : [valor];
    const dir = entradas.map((e) => e?.installPath).find((p) => p && existe(p));
    if (dir) salida.push({ nombre: clave.split('@')[0], dir });
  }
  return salida;
}

function detectarSkills(home, env) {
  const b = carpetasBase(home, env);
  const candidatas = [
    { ia: 'Claude', ruta: path.join(b.claude, 'skills') },
    { ia: 'Codex', ruta: path.join(b.codex, 'skills') },
    { ia: 'Antigravity', ruta: path.join(b.gemini, 'config', 'skills') },
    { ia: 'Antigravity', ruta: path.join(b.gemini, 'antigravity', 'skills') },
    { ia: 'Antigravity', ruta: path.join(b.gemini, 'skills') },
    { ia: 'Antigravity', ruta: path.join(b.gemini, 'antigravity', 'builtin', 'skills'), sistema: true },
    // Carpeta del estándar abierto de skills: la comparten varias IAs.
    { ia: 'Compartidas', ruta: path.join(b.agents, 'skills') },
  ];
  for (const p of pluginsDeCodex(b.codex)) candidatas.push({ ia: 'Codex', ruta: path.join(p.dir, 'skills'), paquete: p.nombre, plugin: true });
  for (const p of pluginsDeClaude(b.claude)) candidatas.push({ ia: 'Claude', ruta: path.join(p.dir, 'skills'), paquete: p.nombre, plugin: true });
  return candidatas
    .filter((c) => existe(c.ruta))
    .map((c) => ({ ...c, skills: contarSkills(c.ruta) }))
    .filter((c) => c.skills > 0);
}

/** Carpetas de agentes dentro de proyectos (`<proyecto>/.claude/agents`, etc.). */
function buscarAgentesDeProyecto(home) {
  const encontrados = [];
  const vistos = new Set();
  const marcas = [
    ['.claude', 'agents', 'Claude'],
    ['.codex', 'agents', 'Codex'],
    ['.gemini', 'agents', 'Antigravity'],
    ['.agents', 'agents', 'Compartidas'],
  ];
  const visitar = (dir, nivel) => {
    if (nivel > 3) return;
    const r = real(dir);
    if (vistos.has(r)) return;
    vistos.add(r);
    for (const [oculta, sub, ia] of marcas) {
      const candidata = path.join(dir, oculta, sub);
      if (nivel > 0 && existe(candidata) && contarAgentes(candidata)) encontrados.push({ ia, ambito: `Proyecto ${path.basename(dir)}`, ruta: candidata });
    }
    let entradas;
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entradas) {
      if (e.name.startsWith('.') || OMITIR_AL_BUSCAR.has(e.name)) continue;
      const hijo = path.join(dir, e.name);
      if (e.isDirectory() || (e.isSymbolicLink() && existe(hijo))) visitar(hijo, nivel + 1);
    }
  };
  for (const raiz of ['Documents', 'Documentos', 'Projects', 'Proyectos', 'proyectos', 'code', 'dev', 'src', 'workspace', 'repos']) {
    const dir = path.join(home, raiz);
    if (existe(dir)) visitar(dir, 0);
  }
  return encontrados;
}

function detectarAgentes(home, env) {
  const b = carpetasBase(home, env);
  const candidatas = [
    { ia: 'Claude', ambito: 'Usuario', ruta: path.join(b.claude, 'agents') },
    { ia: 'Codex', ambito: 'Usuario', ruta: path.join(b.codex, 'agents') },
    { ia: 'Antigravity', ambito: 'Usuario', ruta: path.join(b.gemini, 'agents') },
    ...pluginsDeClaude(b.claude).map((p) => ({ ia: 'Claude', ambito: `Plugin ${p.nombre}`, ruta: path.join(p.dir, 'agents') })),
    ...pluginsDeCodex(b.codex).map((p) => ({ ia: 'Codex', ambito: `Plugin ${p.nombre}`, ruta: path.join(p.dir, 'agents') })),
    ...buscarAgentesDeProyecto(home),
  ];
  const vistos = new Set();
  return candidatas
    .filter((c) => existe(c.ruta) && contarAgentes(c.ruta) > 0)
    .filter((c) => {
      const r = real(c.ruta);
      if (vistos.has(r)) return false;
      vistos.add(r);
      return true;
    })
    .map((c) => ({ ...c, agentes: contarAgentes(c.ruta) }));
}

// --- Centro -------------------------------------------------------------------

const NOMBRES_DE_CENTRO = /^(core|inicio|home|hub|central|centro|cerebro|main|index|principal)$/i;

// --- Entrada ------------------------------------------------------------------

export function detectarEntorno({ home = os.homedir(), plataforma = process.platform, env = process.env } = {}) {
  const { principales, sugerencias } = detectarVaults(home, plataforma, env);
  let vaults = nombrarVaults(principales);
  const sistemaMemoria = detectarSistemaMemoria(vaults, env);

  // Si hay un sistema de memoria, su registro manda el orden (y el primero es el centro).
  let centro = null;
  if (sistemaMemoria) {
    const registro = leerJSON(path.join(sistemaMemoria, 'config', 'vaults.json'));
    const orden = (registro?.vaults || []).map((v) => v.name);
    vaults.sort((a, b) => (orden.indexOf(a.nombre) + 1 || 999) - (orden.indexOf(b.nombre) + 1 || 999));
    centro = orden.find((n) => vaults.some((v) => v.nombre === n)) || null;
  } else {
    vaults.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  centro ??= vaults.find((v) => NOMBRES_DE_CENTRO.test(v.nombre))?.nombre ?? null;

  const automatizaciones = { prefijos: [], relacionadasConVaults: true };
  return {
    plataforma,
    home,
    vaults: vaults.map(({ nombre, ruta, origen }) => ({ nombre, ruta, origen })),
    sugerenciasDeVaults: sugerencias.map((v) => v.ruta),
    centro,
    sistemaMemoria,
    skills: detectarSkills(home, env),
    agentes: detectarAgentes(home, env),
    automatizaciones,
  };
}
