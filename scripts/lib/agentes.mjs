// Agentes de IA (subagentes de Claude Code, Codex y Antigravity) y las
// automatizaciones del sistema que trabajan sobre los vaults (launchd en macOS,
// systemd y cron en Linux). Si hay un sistema de memoria, también su motor.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONFIG } from './config.mjs';
import { analizarDescripcion, traducirAnalisis } from './skills.mjs';
import { es, esDocumento } from './traduccion.mjs';
import { creado, idCorto, ocultarSecretos, separarFrontmatter } from './texto.mjs';

function herramientas(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.map(String);
  return String(valor)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Notas que mencionan a un agente. Los nombres compuestos (`skill-orchestrator`)
// se buscan como palabra; los de una sola palabra común («general», «research»)
// solo cuentan entre comillas invertidas, para no confundirlos con texto normal.
function notasQueMencionan(notas, termino, limite = 8) {
  if (!termino || termino.length < 4) return [];
  const escapado = termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patron = termino.includes('-') ? new RegExp(`(?<![\\w-])${escapado}(?![\\w-])`) : new RegExp(`\`@?${escapado}\``);
  const salida = [];
  for (const n of notas) {
    if (patron.test(n._texto)) {
      salida.push({ id: n.id, v: n.v, t: n.t });
      if (salida.length >= limite) break;
    }
  }
  return salida;
}

export function leerAgentesIA(contadorSecretos, mencionadas, notasTodas) {
  const agentes = [];
  for (const fuente of CONFIG.fuentesAgentes) {
    if (!fs.existsSync(fuente.dir)) continue;
    for (const archivo of fs.readdirSync(fuente.dir).filter((f) => f.endsWith('.md')).sort()) {
      const ruta = path.join(fuente.dir, archivo);
      const crudo = ocultarSecretos(fs.readFileSync(ruta, 'utf8'), contadorSecretos);
      const st = fs.statSync(ruta);
      const { fm, cuerpo } = separarFrontmatter(crudo);
      const nombre = String(fm.name || archivo.replace(/\.md$/, ''));
      const descripcion = String(fm.description || '').replace(/\s+/g, ' ').trim();
      const analisis = analizarDescripcion(descripcion);
      agentes.push({
        id: `${fuente.ia.toLowerCase()}-${fuente.ambito.startsWith('Proyecto') || fuente.ambito.startsWith('Plugin') ? `${fuente.ambito.split(' ').slice(1).join('-').toLowerCase()}-` : ''}${nombre}`,
        nombre,
        ia: fuente.ia,
        ambito: fuente.ambito,
        tipo: 'ia',
        m: st.mtime.toISOString(),
        c: creado(st),
        ...traducirAnalisis(descripcion, analisis),
        descripcionOriginal: descripcion,
        modelo: !fm.model || String(fm.model) === 'inherit' ? 'hereda el de la sesión' : String(fm.model),
        herramientas: herramientas(fm.tools),
        color: fm.color ? String(fm.color) : null,
        skills: mencionadas(`${descripcion}\n${cuerpo}`, null).slice(0, 30),
        cuerpo: esDocumento(cuerpo),
        ruta,
        notas: notasQueMencionan(notasTodas, nombre),
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
    'Cada 10 minutos revisa si cambió algún proyecto o vault y, si hace falta, regenera la memoria: fichas de proyecto, contexto para IA, grafos de Graphify y estadísticas del vault central.',
};

function leerPlist(archivo) {
  try {
    return JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', archivo], { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  } catch {
    return null;
  }
}

// Rutas que delatan que una automatización trabaja sobre la memoria: los vaults y,
// si existe, el sistema de memoria y su contenedor.
function rutasRelacionadas() {
  const rutas = CONFIG.vaults.map((v) => v.ruta);
  if (CONFIG.sistemaMemoria) rutas.push(CONFIG.sistemaMemoria, path.dirname(CONFIG.sistemaMemoria));
  return rutas;
}

const esRelevante = (texto, nombre) =>
  CONFIG.automatizaciones.prefijos.some((p) => nombre.startsWith(p)) ||
  (CONFIG.automatizaciones.relacionadasConVaults && rutasRelacionadas().some((r) => texto.includes(r)));

function describirScript(script) {
  const doc = docstringPython(script);
  const nombreScript = path.basename(script);
  return {
    descripcion: DESCRIPCIONES_CONOCIDAS[nombreScript] || es(doc.split('\n\n')[0].replace(/\s+/g, ' ')) || `Ejecuta ${nombreScript}.`,
    detalle: esDocumento(doc),
  };
}

function launchd() {
  if (CONFIG.plataforma !== 'darwin' || !fs.existsSync(CONFIG.launchAgents)) return [];
  const salida = [];
  for (const archivo of fs.readdirSync(CONFIG.launchAgents).sort()) {
    if (!archivo.endsWith('.plist')) continue;
    const plist = leerPlist(path.join(CONFIG.launchAgents, archivo));
    if (!plist || !esRelevante(JSON.stringify(plist), plist.Label || archivo)) continue;
    const args = plist.ProgramArguments || [];
    const script = args.find((a) => /\.(py|sh|mjs|js|rb)$/.test(a)) || args.join(' ');
    salida.push({
      id: `launchd-${plist.Label}`,
      nombre: plist.Label,
      tipo: 'automatizacion',
      ia: 'launchd',
      ambito: 'macOS · LaunchAgent',
      ...describirScript(script),
      script,
      intervalo: plist.StartInterval || null,
      programacion: null,
      alIniciar: Boolean(plist.RunAtLoad),
      vigila: (plist.WatchPaths || []).map((p) => path.basename(p)),
      logs: [plist.StandardOutPath, plist.StandardErrorPath].filter(Boolean),
      ruta: path.join(CONFIG.launchAgents, archivo),
      pausar: [`launchctl bootout gui/$(id -u)/${plist.Label}`, `launchctl bootstrap gui/$(id -u) ${path.join(CONFIG.launchAgents, archivo)}`],
    });
  }
  return salida;
}

const SEGUNDOS = { s: 1, sec: 1, min: 60, m: 60, h: 3600, hr: 3600, d: 86400 };

function systemd() {
  const dir = path.join(os.homedir(), '.config', 'systemd', 'user');
  if (CONFIG.plataforma !== 'linux' || !fs.existsSync(dir)) return [];
  const salida = [];
  for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith('.service')).sort()) {
    const texto = fs.readFileSync(path.join(dir, archivo), 'utf8');
    const nombre = archivo.replace(/\.service$/, '');
    if (!esRelevante(texto, nombre)) continue;
    const exec = texto.match(/^ExecStart=(.+)$/m)?.[1] || '';
    const script = exec.split(/\s+/).find((a) => /\.(py|sh|mjs|js|rb)$/.test(a)) || exec;
    let intervalo = null;
    try {
      const timer = fs.readFileSync(path.join(dir, `${nombre}.timer`), 'utf8');
      const m = timer.match(/^OnUnitActiveSec=(\d+)\s*([a-z]*)$/m);
      if (m) intervalo = Number(m[1]) * (SEGUNDOS[m[2] || 's'] || 1);
    } catch {
      /* sin temporizador */
    }
    salida.push({
      id: `systemd-${nombre}`,
      nombre,
      tipo: 'automatizacion',
      ia: 'systemd',
      ambito: 'Linux · systemd (usuario)',
      ...describirScript(script),
      script,
      intervalo,
      programacion: null,
      alIniciar: /WantedBy=default\.target/.test(texto),
      vigila: [],
      logs: [],
      ruta: path.join(dir, archivo),
      pausar: [`systemctl --user stop ${nombre}.timer ${nombre}.service`, `systemctl --user start ${nombre}.timer`],
    });
  }
  return salida;
}

function cron() {
  if (CONFIG.plataforma === 'win32') return [];
  let texto = '';
  try {
    texto = execFileSync('crontab', ['-l'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return [];
  }
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && esRelevante(l, ''))
    .map((linea, i) => {
      const partes = linea.split(/\s+/);
      const programacion = partes.slice(0, 5).join(' ');
      const comando = partes.slice(5).join(' ');
      const script = comando.split(/\s+/).find((a) => /\.(py|sh|mjs|js|rb)$/.test(a)) || comando;
      const cada = programacion.match(/^\*\/(\d+) \* \* \* \*$/);
      return {
        id: `cron-${i}`,
        nombre: `cron · ${path.basename(script)}`,
        tipo: 'automatizacion',
        ia: 'cron',
        ambito: 'cron (usuario)',
        ...describirScript(script),
        script,
        intervalo: cada ? Number(cada[1]) * 60 : null,
        programacion,
        alIniciar: false,
        vigila: [],
        logs: [],
        ruta: 'crontab -l',
        pausar: ['crontab -e   # comenta la línea con #'],
      };
    });
}

export function leerAutomatizaciones() {
  return [...launchd(), ...systemd(), ...cron()];
}

export function leerMotor() {
  if (!CONFIG.sistemaMemoria) return { scripts: [], comandos: [] };
  const bin = path.join(CONFIG.sistemaMemoria, 'bin');
  if (!fs.existsSync(bin)) return { scripts: [], comandos: [] };
  const scripts = fs
    .readdirSync(bin)
    .filter((f) => f.endsWith('.py'))
    .sort()
    .map((f) => {
      const doc = docstringPython(path.join(bin, f));
      return { nombre: f, resumen: es(doc.split('\n').find((l) => l.trim())?.trim() || '') };
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
