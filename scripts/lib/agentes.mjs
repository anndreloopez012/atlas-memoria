// Agentes de IA (subagentes de Claude y Codex) y automatizaciones de launchd que
// mantienen viva la memoria. También lista el motor y los comandos `memoria`.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.mjs';
import { analizarDescripcion } from './skills.mjs';
import { idCorto, ocultarSecretos, separarFrontmatter } from './texto.mjs';

function herramientas(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.map(String);
  return String(valor)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function notasQueMencionan(notas, termino, limite = 8) {
  if (!termino || termino.length < 4) return [];
  const salida = [];
  for (const n of notas) {
    if (n._texto.includes(termino)) {
      salida.push(n.id);
      if (salida.length >= limite) break;
    }
  }
  return salida;
}

export function leerAgentesIA(contadorSecretos, mencionadas, notasTalleres) {
  const agentes = [];
  for (const fuente of CONFIG.fuentesAgentes) {
    if (!fs.existsSync(fuente.dir)) continue;
    for (const archivo of fs.readdirSync(fuente.dir).filter((f) => f.endsWith('.md')).sort()) {
      const ruta = path.join(fuente.dir, archivo);
      const crudo = ocultarSecretos(fs.readFileSync(ruta, 'utf8'), contadorSecretos);
      const { fm, cuerpo } = separarFrontmatter(crudo);
      const nombre = String(fm.name || archivo.replace(/\.md$/, ''));
      const descripcion = String(fm.description || '').replace(/\s+/g, ' ').trim();
      const analisis = analizarDescripcion(descripcion);
      agentes.push({
        id: `${fuente.ia.toLowerCase()}-${nombre}`,
        nombre,
        ia: fuente.ia,
        ambito: fuente.ambito,
        tipo: 'ia',
        descripcion,
        que: analisis.que,
        cuando: analisis.cuando,
        noPara: analisis.noPara,
        activadores: analisis.activadores,
        modelo: fm.model ? String(fm.model) : 'hereda la sesión',
        herramientas: herramientas(fm.tools),
        color: fm.color ? String(fm.color) : null,
        skills: mencionadas(`${descripcion}\n${cuerpo}`, null).slice(0, 30),
        cuerpo,
        ruta,
        notas: notasQueMencionan(notasTalleres, nombre),
      });
    }
  }
  return agentes;
}

function docstringPython(archivo) {
  try {
    const texto = fs.readFileSync(archivo, 'utf8').slice(0, 6000);
    const m = texto.match(/^(?:#![^\n]*\n)?(?:\s*#[^\n]*\n)*\s*("""|''')([\s\S]*?)\1/);
    return m ? m[2].trim() : '';
  } catch {
    return '';
  }
}

const DESCRIPCIONES_CONOCIDAS = {
  'auto_refresh_graphify_memory.py':
    'Cada 10 minutos revisa si cambió algún proyecto o vault y, si hace falta, regenera la memoria: fichas de proyecto, contexto para IA, grafos de Graphify y estadísticas de CORE.',
};

function leerPlist(archivo) {
  try {
    return JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', archivo], { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  } catch {
    return null;
  }
}

export function leerAutomatizaciones() {
  if (!fs.existsSync(CONFIG.launchAgents)) return [];
  const salida = [];
  for (const archivo of fs.readdirSync(CONFIG.launchAgents).sort()) {
    if (!archivo.endsWith('.plist') || !CONFIG.prefijosLaunch.some((p) => archivo.startsWith(p))) continue;
    const plist = leerPlist(path.join(CONFIG.launchAgents, archivo));
    if (!plist) continue;
    const args = plist.ProgramArguments || [];
    const script = args.find((a) => /\.(py|sh|mjs|js)$/.test(a)) || args.join(' ');
    const doc = docstringPython(script);
    const nombreScript = path.basename(script);
    salida.push({
      id: `launchd-${plist.Label}`,
      nombre: plist.Label,
      tipo: 'automatizacion',
      ia: 'launchd',
      ambito: 'macOS · LaunchAgent',
      descripcion: DESCRIPCIONES_CONOCIDAS[nombreScript] || doc.split('\n\n')[0].replace(/\s+/g, ' ') || `Ejecuta ${nombreScript}.`,
      detalle: doc,
      script,
      intervalo: plist.StartInterval || null,
      alIniciar: Boolean(plist.RunAtLoad),
      vigila: (plist.WatchPaths || []).map((p) => path.basename(p)),
      logs: [plist.StandardOutPath, plist.StandardErrorPath].filter(Boolean),
      ruta: path.join(CONFIG.launchAgents, archivo),
    });
  }
  return salida;
}

export function leerMotor() {
  const bin = path.join(CONFIG.obsidian, '.memoria-system/bin');
  if (!fs.existsSync(bin)) return { scripts: [], comandos: [] };
  const scripts = fs
    .readdirSync(bin)
    .filter((f) => f.endsWith('.py'))
    .sort()
    .map((f) => {
      const doc = docstringPython(path.join(bin, f));
      return { nombre: f, resumen: doc.split('\n').find((l) => l.trim())?.trim() || '' };
    });
  const comandos = [];
  try {
    const texto = fs.readFileSync(path.join(bin, 'memoria'), 'utf8');
    for (const m of texto.matchAll(/add_parser\(\s*["']([\w-]+)["']\s*,\s*help\s*=\s*["']([^"']+)["']/g)) {
      comandos.push({ comando: `memoria ${m[1]}`, ayuda: m[2] });
    }
  } catch {
    /* sin CLI */
  }
  return { scripts, comandos };
}

export function notaPorRuta(notas, vault, rel) {
  const id = idCorto(`${vault}/${rel}`);
  return notas.some((n) => n.id === id) ? id : null;
}
