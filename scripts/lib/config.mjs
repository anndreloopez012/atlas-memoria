// Configuración del atlas para ESTE equipo.
//
// Prioridad: variables de entorno ATLAS_* > atlas.config.json (lo escribe
// `npm run instalar` y no se sube a git) > detección automática. Así el mismo
// código sirve en cualquier computadora: nada de rutas fijas de nadie.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectarEntorno } from './detectar.mjs';

export const RAIZ = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const ARCHIVO_CONFIG = process.env.ATLAS_CONFIG ? path.resolve(process.env.ATLAS_CONFIG) : path.join(RAIZ, 'atlas.config.json');
export const PUERTO_POR_DEFECTO = 5190;

/** `~/algo` → ruta absoluta en este equipo. */
export function expandir(ruta) {
  if (typeof ruta !== 'string' || !ruta) return ruta;
  if (ruta === '~') return os.homedir();
  if (ruta.startsWith('~/') || ruta.startsWith('~\\')) return path.join(os.homedir(), ruta.slice(2));
  return path.resolve(ruta);
}

/** Ruta absoluta → `~/algo` (más corta y portable dentro del archivo de configuración). */
export function abreviar(ruta) {
  const home = os.homedir();
  if (typeof ruta !== 'string') return ruta;
  return ruta === home ? '~' : ruta.startsWith(home + path.sep) ? `~/${ruta.slice(home.length + 1).split(path.sep).join('/')}` : ruta;
}

export function leerConfigLocal() {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO_CONFIG, 'utf8'));
  } catch {
    return null;
  }
}

/** Convierte lo detectado al mismo formato que atlas.config.json. */
export function configDesdeDeteccion(d) {
  return {
    version: 1,
    centro: d.centro,
    vaults: d.vaults.map((v) => ({ nombre: v.nombre, ruta: abreviar(v.ruta) })),
    sistemaMemoria: d.sistemaMemoria ? abreviar(d.sistemaMemoria) : null,
    skills: d.skills.map(({ ia, ruta, sistema, paquete, plugin }) => ({ ia, ruta: abreviar(ruta), ...(sistema ? { sistema } : {}), ...(paquete ? { paquete } : {}), ...(plugin ? { plugin } : {}) })),
    agentes: d.agentes.map(({ ia, ambito, ruta }) => ({ ia, ambito, ruta: abreviar(ruta) })),
    automatizaciones: d.automatizaciones,
    carpetasGeneradas: ['Graphify'],
    puerto: PUERTO_POR_DEFECTO,
  };
}

const lista = (valor) => (valor ? valor.split(path.delimiter).filter(Boolean) : []);

function construir() {
  const local = leerConfigLocal();
  const base = local ?? configDesdeDeteccion(detectarEntorno());
  const env = process.env;

  const vaults = (base.vaults || [])
    .map((v) => ({ ...v, ruta: expandir(v.ruta) }))
    .filter((v) => v.nombre && v.ruta);

  const fuentesSkills = (base.skills || []).map((s) => ({
    ia: s.ia,
    dir: expandir(s.ruta),
    sistema: Boolean(s.sistema),
    paquete: s.paquete || null,
    plugin: Boolean(s.plugin),
  }));
  for (const dir of lista(env.ATLAS_SKILLS_EXTRA)) fuentesSkills.push({ ia: 'Extra', dir: expandir(dir), sistema: false, paquete: null, plugin: false });

  const automatizaciones = {
    prefijos: env.ATLAS_LAUNCH_PREFIJOS ? env.ATLAS_LAUNCH_PREFIJOS.split(',').filter(Boolean) : base.automatizaciones?.prefijos || [],
    relacionadasConVaults: base.automatizaciones?.relacionadasConVaults !== false,
  };

  return {
    tieneConfigLocal: Boolean(local),
    salida: env.ATLAS_SALIDA ? path.resolve(env.ATLAS_SALIDA) : path.join(RAIZ, 'datos'),
    vaults,
    centro: base.centro || null,
    sistemaMemoria: base.sistemaMemoria ? expandir(base.sistemaMemoria) : null,
    fuentesSkills,
    fuentesAgentes: (base.agentes || []).map((a) => ({ ia: a.ia, ambito: a.ambito || 'Usuario', dir: expandir(a.ruta) })),
    automatizaciones,
    // Qué skills son de la persona además de las que viven fuera de las carpetas de
    // las IAs: cuentas de GitHub suyas y partes de nombre (p. ej. su marca).
    propias: { cuentas: base.propias?.cuentas || [], patrones: base.propias?.patrones || [] },
    // Carpetas que generan herramientas (p. ej. Graphify: una nota por archivo de
    // código). Sus subcarpetas se cuentan pero no se cargan.
    carpetasGeneradas: new Set(base.carpetasGeneradas || ['Graphify']),
    puerto: Number(env.ATLAS_PUERTO || env.PORT || base.puerto || PUERTO_POR_DEFECTO),
    plataforma: process.platform,
    launchAgents: path.join(os.homedir(), 'Library', 'LaunchAgents'),
    ignorar: new Set(['.obsidian', '.smart-env', '.trash', '.git', 'node_modules']),
    maxBytesNota: 300_000,
    maxBytesBloque: 450_000,
  };
}

export const CONFIG = construir();
