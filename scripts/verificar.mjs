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
import { descomprimir, esMasNueva } from './lib/actualizacion.mjs';
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
  escribir(
    path.join(demo, 'Ideas', 'Idea.md'),
    '# Idea\n\nUna idea con #etiqueta y enlace a [[Inicio]], a [[Nota que no existe]] y a ![[foto-perdida.png]].\n\n- [ ] Revisar la idea 📅 2026-01-15 ⏫\n- [x] Escribirla\n\n```\n- [ ] esto es código\n```\n',
  );
  escribir(path.join(demo, 'Templates', 'Diaria.md'), '# Plantilla\n\n- [ ] tarea de plantilla\n');
  escribir(path.join(trabajo, 'Proyecto.md'), '---\ntipo: proyecto\nestado: activo\n---\n# Proyecto\n\nVuelve al [inicio](obsidian://open?vault=Notas%20Demo&file=Inicio).\n');
  escribir(path.join(trabajo, 'Bitacora', 'Decision.md'), '---\ntipo: decision\nproyecto: Proyecto\nfecha: 2026-01-10\n---\n# Usar el atlas\n\nDecidimos usarlo.\n');

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

  // Historiales de IAs: un uso en Claude Code y uno en Codex; la lista de skills
  // disponibles de Codex (sin herramienta) no cuenta.
  escribir(
    path.join(home, '.claude', 'projects', 'demo', 'sesion.jsonl'),
    '{"type":"assistant","timestamp":"2026-02-01T10:00:00.000Z","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"demo-skill"}}]}}\n',
  );
  escribir(
    path.join(home, '.codex', 'sessions', '2026', '02', '02', 'sesion.jsonl'),
    '{"timestamp":"2026-02-02T09:00:00.000Z","type":"response_item","payload":{"type":"message","content":"skills/otra-skill/SKILL.md"}}\n' +
      '{"timestamp":"2026-02-02T10:00:00.000Z","type":"response_item","payload":{"type":"function_call","name":"exec_command","arguments":"{\\"cmd\\":\\"cat skills/demo-skill/SKILL.md\\"}"}}\n',
  );

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
  ok(atlas.totales.vaults === 2 && atlas.totales.notas === 5, `lee 2 vaults y 5 notas (${atlas.totales.vaults} y ${atlas.totales.notas})`);
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
  const tareas = leer('tareas.json');
  const tareaDemo = tareas.tareas.find((t) => t.x === 'Revisar la idea');
  ok(tareas.abiertas === 1 && tareas.hechas === 1 && tareaDemo?.d === '2026-01-15' && tareaDemo?.p === 'alta', 'lee las tareas con su fecha y prioridad (y omite plantillas y código)');
  const { marcarHecha } = await import('./lib/tareas.mjs');
  const archivoIdea = path.join(demo, 'Ideas', 'Idea.md');
  const marcada = marcarHecha(archivoIdea, tareaDemo.l, tareaDemo.h);
  ok(marcada.ok && fs.readFileSync(archivoIdea, 'utf8').includes('- [x] Revisar la idea') && !marcarHecha(archivoIdea, tareaDemo.l, tareaDemo.h).ok, 'marca una tarea como hecha cambiando solo su casilla (y no la toca dos veces)');
  const proyecto = leer('proyectos.json').proyectos[0];
  ok(proyecto?.nombre === 'Proyecto' && proyecto.entradas[0]?.t === 'Usar el atlas' && proyecto.entradas[0]?.fecha === '2026-01-10', 'arma los proyectos con su historia');
  const usoDemo = skills.skills.find((x) => x.nombre === 'demo-skill')?.uso;
  ok(usoDemo?.total === 2 && usoDemo.ias.Claude === 1 && usoDemo.ias.Codex === 1 && !skills.skills.find((x) => x.nombre === 'otra-skill')?.uso, 'cuenta el uso real de las skills en Claude Code y Codex (solo conteos)');
  const salud = leer('salud.json');
  ok(salud.rotos.total === 1 && salud.rotos.items[0].destinos[0] === 'Nota que no existe' && salud.adjuntos.items[0]?.destinos[0] === 'foto-perdida.png', 'revisa la salud: enlaces rotos y adjuntos que faltan');
  // Un Ollama de mentira (modelos locales): debe elegir el modelo de chat, no el de embeddings.
  const http = await import('node:http');
  const ollamaFalso = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'nomic-embed-text:latest' }, { name: 'llama3.2:3b' }] }));
    let cuerpo = '';
    req.on('data', (d) => (cuerpo += d));
    req.on('end', () => res.end(JSON.stringify({ response: `Respuesta local de ${JSON.parse(cuerpo).model} [1]` })));
  });
  await new Promise((r) => ollamaFalso.listen(0, '127.0.0.1', r));
  process.env.OLLAMA_HOST = `http://127.0.0.1:${ollamaFalso.address().port}`;
  const { fuentesPara, armarPedido, iasParaPreguntar, responder } = await import('./lib/preguntar.mjs');
  const fuentes = fuentesPara('¿Qué dice la idea?', entorno.ATLAS_SALIDA);
  ok(fuentes[0]?.t === 'Idea' && fuentes[0].texto.includes('Revisar la idea') && armarPedido('x', fuentes).includes('[1] «Idea»') && (await iasParaPreguntar('ninguna')).length === 0, 'encuentra las notas que responden una pregunta (sin llamar a ninguna IA)');
  const locales = await iasParaPreguntar('ollama');
  const local = locales.length ? await responder(locales, armarPedido('x', fuentes)) : null;
  ok(locales[0]?.modelo === 'llama3.2:3b' && local?.respuesta === 'Respuesta local de llama3.2:3b [1]', 'responde con Ollama (gratis y local) eligiendo un modelo de chat');
  ollamaFalso.close();
  const recientes = leer('recientes.json');
  ok(recientes.notas.length === 5 && recientes.skills.some((s) => s.nombre === 'demo-skill') && recientes.agentes.length === 1, 'lista las novedades (notas, skills y agentes recientes)');
  const { capturar } = await import('./lib/capturar.mjs');
  const vaultsDemo = atlas.vaults.map((v) => ({ nombre: v.nombre, slug: v.slug, ruta: v.ruta }));
  const captura = capturar({ texto: 'Probar el atlas en otro equipo' }, { vaults: vaultsDemo, centro: atlas.centro, memoria: false, config: {} });
  correr('generar-datos.mjs');
  const capturada = Object.values(JSON.parse(fs.readFileSync(path.join(entorno.ATLAS_SALIDA, 'vault', `${captura.slug}.json`), 'utf8')).notas).find((x) => x.id === captura.id);
  ok(captura.ok && captura.via === 'archivo' && captura.rel?.startsWith('Bandeja/') && capturada?.h?.[0]?.t === 'Probar el atlas en otro equipo', 'captura una idea como nota nueva en la bandeja del vault central');

  // --- Empezar de cero -----------------------------------------------------------
  console.log('\nEmpezar de cero (sin vaults)');
  const vacio = path.join(base, 'vacio');
  fs.mkdirSync(path.join(vacio, 'Documents'), { recursive: true });
  const entornoVacio = { ...entorno, HOME: vacio, USERPROFILE: vacio, APPDATA: path.join(vacio, 'AppData', 'Roaming'), XDG_CONFIG_HOME: path.join(vacio, '.config'), ATLAS_CONFIG: path.join(base, 'vacio.config.json'), ATLAS_SALIDA: path.join(base, 'vacio-datos') };
  const enVacio = (extra) => spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'instalar.mjs'), '--solo-detectar', '--json', ...extra], { cwd: RAIZ, env: entornoVacio, encoding: 'utf8' });
  const sinNada = JSON.parse(enVacio([]).stdout || '{}');
  ok(sinNada.vaults?.length === 0, 'en un equipo sin vaults no crea ninguno por su cuenta');
  const inicial = JSON.parse(enVacio(['--vault-inicial']).stdout || '{}');
  const rutaInicial = path.join(vacio, 'Documents', 'Mi memoria');
  ok(
    inicial.vaultInicial?.creado && inicial.centro === 'Mi memoria' && fs.existsSync(path.join(rutaInicial, 'Empieza aquí.md')) && fs.existsSync(path.join(rutaInicial, '.obsidian')) && !fs.existsSync(path.join(rutaInicial, 'Ideas', '.gitkeep')),
    'con --vault-inicial crea «Mi memoria» con notas guía y lo deja como vault central',
  );
  fs.writeFileSync(path.join(rutaInicial, 'Empieza aquí.md'), 'mía');
  const otraVez = JSON.parse(enVacio(['--vault-inicial']).stdout || '{}');
  ok(otraVez.vaultInicial?.creado === false && otraVez.vaults.length === 1 && fs.readFileSync(path.join(rutaInicial, 'Empieza aquí.md'), 'utf8') === 'mía', 'pedirlo otra vez reutiliza el mismo vault sin sobrescribir nada');

  // La ruta «Aprende» no cuenta las notas guía como «tu primera nota»: su lista debe
  // coincidir con las notas que trae el vault inicial.
  const guia = fs.readFileSync(path.join(RAIZ, 'src', 'lib', 'aprende.ts'), 'utf8').match(/DE_LA_GUIA = new Set\(\[([^\]]*)\]/)?.[1].match(/'([^']+)'/g)?.map((x) => x.slice(1, -1)) ?? [];
  const notasGuia = [];
  const recorrerGuia = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) recorrerGuia(path.join(dir, e.name));
      else if (e.name.endsWith('.md')) notasGuia.push(e.name.slice(0, -3));
    }
  };
  recorrerGuia(path.join(RAIZ, 'instalador', 'vault-inicial'));
  ok(notasGuia.length > 0 && notasGuia.every((t) => guia.includes(t)), 'la ruta Aprende reconoce todas las notas guía del vault inicial');

  // --- Actualizaciones ----------------------------------------------------------
  console.log('\nActualizaciones');
  ok(esMasNueva('2.10.0', '2.9.3') && esMasNueva('v3.0.0', '2.9.9') && !esMasNueva('2.2.0', '2.2.0') && !esMasNueva('2.1.9', '2.2.0'), 'compara versiones (2.10.0 es más nueva que 2.9.3)');
  const zipPrueba = path.join(base, 'version.zip');
  const archivo = spawnSync('git', ['archive', '--format=zip', '--prefix=Atlas de memoria/', '-o', zipPrueba, 'HEAD'], { cwd: RAIZ });
  if (archivo.status === 0) {
    const extraidos = descomprimir(fs.readFileSync(zipPrueba), path.join(base, 'version'));
    const lanzadorMac = path.join(base, 'version', 'Atlas de memoria', 'Instalar en Mac.command');
    ok(extraidos.includes('Atlas de memoria/package.json') && fs.existsSync(lanzadorMac) && (process.platform === 'win32' || (fs.statSync(lanzadorMac).mode & 0o111) !== 0), 'descomprime una versión descargada (con permisos de ejecución)');
  }

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
  const ejecutable = (rel) => (fs.statSync(path.join(RAIZ, rel)).mode & 0o111) !== 0;
  ok(
    ['Instalar en Mac.command', 'Instalar en Linux.sh', 'iniciar.sh', 'instalar.sh'].every(ejecutable) &&
      fs.readFileSync(path.join(RAIZ, 'Instalar en Windows.cmd'), 'utf8').includes('\r\n') &&
      ['atlas.icns', 'atlas.ico', 'atlas.png'].every((f) => fs.existsSync(path.join(RAIZ, 'instalador', f))),
    'trae los instaladores de doble clic (ejecutables) y los íconos de cada sistema',
  );
  if (process.platform !== 'win32') {
    const l = correr('lanzador.mjs', ['--json']);
    const creados = JSON.parse((l.stdout || '{}').trim().split('\n').pop() || '{}').lanzadores || [];
    const app = creados.find((c) => c.endsWith('.app') || c.endsWith('.desktop'));
    const listo = process.platform === 'darwin' ? app && fs.existsSync(path.join(app, 'Contents', 'MacOS', 'atlas')) : app && fs.readFileSync(app, 'utf8').includes('iniciar.sh');
    ok(Boolean(listo) && creados.every((c) => c.startsWith(home)), 'crea el acceso de doble clic «Atlas de memoria» en la carpeta personal');
  }
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

console.log(fallas.length ? `\n${fallas.length} comprobaciones fallaron.` : '\nTodo en orden.');
process.exit(fallas.length ? 1 : 0);
