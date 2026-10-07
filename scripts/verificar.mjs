#!/usr/bin/env node
// Prueba de humo: arma un equipo falso (un HOME temporal con dos vaults, skills de
// dos IAs y un agente), corre la detección y la generación de punta a punta y
// comprueba los resultados. También revisa que las instrucciones para las IAs
// estén completas. No toca tus datos reales.
//
// Uso: npm run verificar        (sale con código 1 si algo falla)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RAIZ } from './lib/config.mjs';
import { registrosDeObsidian } from './lib/detectar.mjs';

const fallas = [];
const ok = (condicion, mensaje) => {
  console.log(`  ${condicion ? '✓' : '✗'} ${mensaje}`);
  if (!condicion) fallas.push(mensaje);
};
const escribir = (archivo, texto) => {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, texto);
};

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-verificar-'));
const home = path.join(base, 'home');

try {
  console.log('Equipo de prueba en', base);

  // --- Equipo falso ------------------------------------------------------------
  const demo = path.join(home, 'Documents', 'Notas Demo');
  const trabajo = path.join(home, 'Documents', 'Trabajo');
  for (const v of [demo, trabajo, path.join(home, 'Documents', 'Viejo')]) fs.mkdirSync(path.join(v, '.obsidian'), { recursive: true });
  escribir(
    path.join(demo, 'Inicio.md'),
    '---\ntags: [inicio]\n---\n# Inicio\n\nMira la [[Idea]] y el [proyecto](obsidian://open?vault=Trabajo&file=Proyecto).\n\nclave: sk_live_ABCDEFGHIJKLMNOPQRSTUV\n',
  );
  escribir(path.join(demo, 'Ideas', 'Idea.md'), '# Idea\n\nUna idea con #etiqueta y enlace a [[Inicio]].\n');
  escribir(path.join(trabajo, 'Proyecto.md'), '# Proyecto\n\nVuelve al [inicio](obsidian://open?vault=Notas%20Demo&file=Inicio).\n');

  const skillDemo =
    '---\nname: demo-skill\ndescription: Builds demo reports for the atlas check. Use when the user asks for a demo report.\n---\n# Demo skill\n\n## Steps\n\nRun the script.\n';
  escribir(path.join(home, '.codex', 'skills', 'demo-skill', 'SKILL.md'), skillDemo);
  escribir(path.join(home, '.codex', 'skills', 'demo-skill', 'references', 'guia.md'), '# Guía\n\nDetalle.\n');
  escribir(path.join(home, '.gemini', 'config', 'skills', 'demo-skill', 'SKILL.md'), skillDemo);
  escribir(
    path.join(home, '.claude', 'skills', 'otra-skill', 'SKILL.md'),
    '---\nname: otra-skill\ndescription: Ordena las notas de un vault por fecha.\n---\n# Otra skill\n\nUsa la demo-skill cuando haga falta.\n',
  );
  escribir(path.join(home, '.claude', 'agents', 'revisor.md'), '---\nname: revisor\ndescription: Revisa cambios con la demo-skill.\ntools: Read, Grep\n---\n\nRevisa con cuidado.\n');

  // Obsidian registra los dos primeros vaults; «Viejo» debe quedar como sugerencia.
  const entorno = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    APPDATA: path.join(home, 'AppData', 'Roaming'),
    XDG_CONFIG_HOME: path.join(home, '.config'),
    ATLAS_CONFIG: path.join(base, 'atlas.config.json'),
    ATLAS_SALIDA: path.join(base, 'datos'),
  };
  for (const v of ['CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'ATLAS_OBSIDIAN', 'ATLAS_SKILLS_EXTRA', 'ATLAS_LAUNCH_PREFIJOS', 'ATLAS_PUERTO', 'PORT']) delete entorno[v];
  escribir(
    registrosDeObsidian(home, process.platform, entorno)[0],
    JSON.stringify({ vaults: { a: { path: demo, ts: 1 }, b: { path: trabajo, ts: 2 } } }),
  );

  const correr = (script, extra = []) =>
    spawnSync(process.execPath, [path.join(RAIZ, 'scripts', script), ...extra], { cwd: RAIZ, env: entorno, encoding: 'utf8' });

  // --- Detección ---------------------------------------------------------------
  console.log('\nDetección');
  const det = correr('instalar.mjs', ['--solo-detectar', '--json']);
  let resumen = null;
  try {
    resumen = JSON.parse(det.stdout);
  } catch {
    console.log(det.stdout, det.stderr);
  }
  ok(det.status === 0 && resumen, 'el instalador detecta sin errores');
  ok(resumen?.vaults.length === 2, `encuentra los 2 vaults registrados en Obsidian (${resumen?.vaults.map((v) => v.nombre).join(', ')})`);
  ok(resumen?.sugerenciasDeVaults.some((s) => s.endsWith('Viejo')), 'sugiere el vault no registrado sin agregarlo');
  ok(new Set(resumen?.skills.map((s) => s.ia)).size === 3, 'encuentra skills de Claude, Codex y Antigravity');
  ok(resumen?.agentes.length === 1, 'encuentra la carpeta de agentes de Claude');
  ok(fs.existsSync(entorno.ATLAS_CONFIG), 'escribe atlas.config.json');

  // --- Generación --------------------------------------------------------------
  console.log('\nGeneración');
  const gen = correr('generar-datos.mjs');
  ok(gen.status === 0, 'genera los datos sin errores');
  if (gen.status !== 0) console.log(gen.stdout, gen.stderr);
  const leer = (rel) => JSON.parse(fs.readFileSync(path.join(entorno.ATLAS_SALIDA, rel), 'utf8'));
  const atlas = leer('atlas.json');
  ok(atlas.totales.vaults === 2 && atlas.totales.notas === 3, `lee 2 vaults y 3 notas (${atlas.totales.vaults} y ${atlas.totales.notas})`);
  ok(atlas.totales.puentes === 2, `cuenta los puentes entre vaults (${atlas.totales.puentes})`);
  ok(atlas.centro === 'notas-demo', `elige un centro (${atlas.centro})`);
  const skills = leer('skills.json');
  const demoSkill = skills.skills.find((s) => s.nombre === 'demo-skill');
  ok(skills.skills.length === 2 && demoSkill?.ias.includes('Codex') && demoSkill?.ias.includes('Antigravity'), 'agrupa la misma skill instalada en dos IAs');
  ok(skills.skills.find((s) => s.nombre === 'otra-skill')?.relacionadas.includes('demo-skill'), 'detecta que una skill menciona a otra');
  ok(leer('agentes.json').agentes[0]?.skills.includes('demo-skill'), 'relaciona el agente con la skill que usa');
  const bloques = fs.readdirSync(path.join(entorno.ATLAS_SALIDA, 'contenido')).map((f) => fs.readFileSync(path.join(entorno.ATLAS_SALIDA, 'contenido', f), 'utf8')).join('');
  ok(bloques.includes('](atlas:'), 'reescribe los enlaces para navegar dentro del atlas');
  ok(bloques.includes('[oculto]') && !bloques.includes('sk_live_'), 'oculta los secretos');
  ok(leer('pendientes-traduccion.json').some((p) => p.texto.startsWith('Builds demo reports')), 'anota los textos en inglés para traducirlos');
  const recientes = leer('recientes.json');
  ok(recientes.notas.length === 3 && recientes.skills.some((s) => s.nombre === 'demo-skill') && recientes.agentes.length === 1, 'lista las novedades (notas, skills y agentes recientes)');

  // --- Instrucciones para las IAs ---------------------------------------------
  console.log('\nInstrucciones para Claude Code, Codex y Antigravity');
  const leerRepo = (rel) => {
    try {
      return fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    } catch {
      return null;
    }
  };
  const agentsMd = leerRepo('AGENTS.md');
  ok(agentsMd && Buffer.byteLength(agentsMd) < 24_000, 'AGENTS.md existe y cabe en el límite de reglas de Antigravity (24 KB)');
  ok(/@AGENTS\.md/.test(leerRepo('CLAUDE.md') || ''), 'CLAUDE.md importa AGENTS.md (Claude Code)');
  ok(/AGENTS\.md/.test(leerRepo('GEMINI.md') || ''), 'GEMINI.md remite a AGENTS.md (Antigravity y Gemini CLI)');
  const skillAgents = leerRepo('.agents/skills/instalar-atlas/SKILL.md');
  ok(skillAgents && skillAgents === leerRepo('.claude/skills/instalar-atlas/SKILL.md'), 'la skill instalar-atlas está en .agents/ y .claude/ y es idéntica');
  ok(Boolean(leerRepo('INSTALAR.md')) && Boolean(leerRepo('instalar.sh')) && Boolean(leerRepo('instalar.ps1')), 'existen INSTALAR.md, instalar.sh e instalar.ps1');
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

console.log(fallas.length ? `\n${fallas.length} comprobaciones fallaron.` : '\nTodo en orden.');
process.exit(fallas.length ? 1 : 0);
