#!/usr/bin/env node
// Genera los datos del atlas a partir de los vaults, las skills y los agentes de
// este equipo (ver scripts/lib/config.mjs). Escribe en ./datos (ignorado por git:
// es contenido personal y se regenera en segundos). Uso: npm run datos
import fs from 'node:fs';
import path from 'node:path';
import { leerAgentesIA, leerAutomatizaciones, leerMotor, notaPorRuta } from './lib/agentes.mjs';
import { abreviar, CONFIG } from './lib/config.mjs';
import { leerSkills } from './lib/skills.mjs';
import { carpetasDePlantillas, extraerTareas } from './lib/tareas.mjs';
import { pendientesDeTraduccion } from './lib/traduccion.mjs';
import { leerVaults } from './lib/vaults.mjs';

const inicio = Date.now();
const slug = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

if (!CONFIG.vaults.length) {
  console.warn('  aviso: no hay vaults configurados; el atlas mostrará solo skills y agentes. Agrega uno con: npm run instalar -- --vault "<ruta>"');
}

const secretos = { total: 0 };
// Carpeta temporal propia de esta corrida: el vigía del servidor puede lanzar otra a la vez.
const temporal = `${CONFIG.salida}.nuevo-${process.pid}`;
// Restos de corridas que se interrumpieron (más de 10 minutos).
for (const resto of fs.readdirSync(path.dirname(CONFIG.salida))) {
  const abs = path.join(path.dirname(CONFIG.salida), resto);
  if (/^datos\.(nuevo|viejo)-\d+$/.test(resto) && Date.now() - fs.statSync(abs).mtimeMs > 600_000) fs.rmSync(abs, { recursive: true, force: true });
}
fs.rmSync(temporal, { recursive: true, force: true });
fs.mkdirSync(path.join(temporal, 'vault'), { recursive: true });
fs.mkdirSync(path.join(temporal, 'contenido'), { recursive: true });
fs.mkdirSync(path.join(temporal, 'skills'), { recursive: true });
const escribir = (rel, datos) => fs.writeFileSync(path.join(temporal, rel), JSON.stringify(datos));

// --- Vaults -------------------------------------------------------------------
const { vaults, todas, puentes, totalEnlaces, sinResolver, routing, obsidian, arbolCarpetas } = leerVaults(secretos);

const resumenVaults = [];
const porId = new Map(todas.map((n) => [n.id, n]));
for (const { info, notas, adjuntos, generados } of vaults) {
  const s = slug(info.name);
  // El contenido completo va en bloques de ~450 KB que el navegador pide solo al abrir una nota.
  let bloque = 0;
  let actual = {};
  let tamano = 0;
  const cerrar = () => {
    if (!Object.keys(actual).length) return;
    escribir(`contenido/${s}-${bloque}.json`, actual);
    bloque += 1;
    actual = {};
    tamano = 0;
  };
  for (const n of notas) {
    if (tamano > CONFIG.maxBytesBloque) cerrar();
    actual[n.id] = n._contenido;
    tamano += n._contenido.length;
    n.c = `${s}-${bloque}`;
  }
  cerrar();

  // Notas de otros vaults que esta cita o que la citan: basta con título y vault.
  const externos = {};
  for (const n of notas) {
    for (const id of [...n.x, ...n.xb]) {
      const e = porId.get(id);
      if (e) externos[id] = { v: e.v, t: e.t, f: e.f };
    }
  }
  escribir(`vault/${s}.json`, {
    notas: notas.map(({ _enlaces, _contenido, _texto, _creada, nb, ...resto }) => resto),
    externos,
  });

  const etiquetas = new Map();
  for (const n of notas) for (const t of n.tg) etiquetas.set(t, (etiquetas.get(t) || 0) + 1);
  const ultima = notas.reduce((max, n) => (n.m > max ? n.m : max), '');
  const inicioId = info.home ? notaPorRuta(notas, info.name, info.home) : null;

  resumenVaults.push({
    nombre: info.name,
    slug: s,
    ruta: info.ruta,
    color: info.color || '#64748b',
    icono: info.icono || 'folder',
    proposito: info.proposito || '',
    incluye: info.incluye || [],
    noIncluye: info.no_incluye || [],
    inicio: inicioId,
    entradas: (info.entradas || []).map((rel) => notaPorRuta(notas, info.name, rel)).filter(Boolean),
    notas: notas.length,
    palabras: notas.reduce((t, n) => t + n.w, 0),
    adjuntos: adjuntos.length,
    generados,
    ultima,
    enlaces: notas.reduce((t, n) => t + n.o.length, 0),
    etiquetas: [...etiquetas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24),
    carpetas: arbolCarpetas(notas, adjuntos),
    complementos: [...(obsidian.plugins_base || []), ...((obsidian.plugins_extra || {})[info.name] || [])],
  });
}

// --- Skills y agentes -----------------------------------------------------------
const { skills, detalles, paquetes, ias, mencionadas, totalInstalaciones } = leerSkills(secretos, todas);
for (const [nombre, detalle] of detalles) escribir(`skills/${slug(nombre) || 'skill'}.json`, detalle);
for (const s of skills) s.archivoDetalle = slug(s.nombre) || 'skill';

const agentesIA = leerAgentesIA(secretos, mencionadas, todas);
const automatizaciones = leerAutomatizaciones();
const motor = leerMotor();

// Qué agentes usan cada skill (relación inversa).
const usadaPor = new Map();
for (const a of agentesIA) for (const s of a.skills) usadaPor.set(s, [...(usadaPor.get(s) || []), a.id]);
for (const s of skills) s.agentes = usadaPor.get(s.nombre) || [];

// --- Novedades ----------------------------------------------------------------------
// Lo que cambió en las últimas semanas, para «Hoy · desde tu última visita». La
// página compara estas fechas con la última visita guardada en el navegador.
const desde = Date.now() - CONFIG.diasNovedades * 86_400_000;
const reciente = (iso) => Boolean(iso) && Date.parse(iso) >= desde;
// Notas que reescribe una herramienta (frontmatter `generado: true`): se muestran
// aparte para que no tapen lo que escribió la persona.
// También cuenta como automático un cambio en lote: 20 o más notas del mismo vault
// modificadas con menos de 90 s de diferencia (nadie edita a mano a ese ritmo).
const enLote = new Set();
for (const v of new Set(todas.map((n) => n.v))) {
  const lista = todas.filter((n) => n.v === v && reciente(n.m)).map((n) => ({ id: n.id, t: Date.parse(n.m) })).sort((a, b) => a.t - b.t);
  let ini = 0;
  for (let fin = 0; fin < lista.length; fin++) {
    while (lista[fin].t - lista[ini].t > 90_000) ini += 1;
    if (fin - ini + 1 >= 20) for (let k = ini; k <= fin; k++) enLote.add(lista[k].id);
  }
}
const esGenerada = (n) => enLote.has(n.id) || [n.fm.generado, n.fm.generated, n.fm.autogenerado].some((v) => v === true || v === 'true');
escribir('recientes.json', {
  dias: CONFIG.diasNovedades,
  // Las notas propias y las que reescribe una herramienta tienen topes separados:
  // un refresco que toca cientos de notas no debe tapar lo que escribió la persona.
  notas: [
    ...todas.filter((n) => reciente(n.m) && !esGenerada(n)).sort((a, b) => b.m.localeCompare(a.m)).slice(0, 800),
    ...todas.filter((n) => reciente(n.m) && esGenerada(n)).sort((a, b) => b.m.localeCompare(a.m)).slice(0, 400),
  ]
    .sort((a, b) => b.m.localeCompare(a.m))
    .map((n) => ({ id: n.id, v: n.v, t: n.t, f: n.f, m: n.m, c: n._creada, ...(esGenerada(n) ? { g: 1 } : {}) })),
  skills: skills.filter((s) => reciente(s.m) || reciente(s.c)).map((s) => ({ nombre: s.nombre, categoria: s.categoria, m: s.m, c: s.c })),
  agentes: agentesIA.filter((a) => reciente(a.m) || reciente(a.c)).map((a) => ({ id: a.id, nombre: a.nombre, ia: a.ia, m: a.m, c: a.c })),
});

// --- Tareas -------------------------------------------------------------------------
// Casillas pendientes de todos los vaults (las hechas solo se cuentan). Las de notas
// que reescribe una herramienta van marcadas con `g` para mostrarlas aparte.
const tareas = [];
let tareasHechas = 0;
for (const { info, notas, dirVault } of vaults) {
  const plantillas = carpetasDePlantillas(dirVault);
  const s = slug(info.name);
  for (const n of notas) {
    if (!n._texto.includes('[') || plantillas.has(n.f.split('/')[0]) || plantillas.has(n.f)) continue;
    for (const t of extraerTareas(n._texto)) {
      if (t.e === 'hecha' || t.e === 'cancelada') {
        tareasHechas += 1;
        continue;
      }
      tareas.push({ id: n.id, s, v: n.v, t: n.t, r: n.r, f: n.f, m: n.m, ...t, ...(esGenerada(n) ? { g: 1 } : {}) });
    }
  }
}
tareas.sort((a, b) => (a.d && b.d ? a.d.localeCompare(b.d) : a.d ? -1 : b.d ? 1 : b.m.localeCompare(a.m) || a.l - b.l));
escribir('tareas.json', { abiertas: tareas.length, hechas: tareasHechas, tareas });

const categorias = [...new Set(skills.map((s) => s.categoria))].sort((a, b) => a.localeCompare(b, 'es'));
escribir('skills.json', { skills, paquetes, categorias, ias, totalInstalaciones });
escribir('agentes.json', { agentes: [...agentesIA, ...automatizaciones] });

// --- Índice general -------------------------------------------------------------
// El centro es el vault del que nacen los demás: el configurado; si no, uno que
// se llame como un centro (CORE, Inicio…); si no, el que más puentes tiene con
// los otros; si no, el más grande.
const puentesPorVault = new Map();
for (const [clave, n] of puentes) for (const v of clave.split('→')) puentesPorVault.set(v, (puentesPorVault.get(v) || 0) + n);
const centro =
  resumenVaults.find((v) => v.nombre === CONFIG.centro) ||
  resumenVaults.find((v) => /^(core|inicio|home|hub|central|centro|cerebro|main|index|principal)$/i.test(v.nombre)) ||
  [...resumenVaults].sort((a, b) => (puentesPorVault.get(b.nombre) || 0) - (puentesPorVault.get(a.nombre) || 0) || b.notas - a.notas)[0] ||
  null;
if (centro) resumenVaults.splice(resumenVaults.indexOf(centro), 1), resumenVaults.unshift(centro);

// Notas clave de un sistema de memoria (si existe): viven en el vault central.
const vaultCentro = centro ? vaults.find((v) => v.info.name === centro.nombre) : null;
const notaCentro = (rel) => (CONFIG.sistemaMemoria && vaultCentro ? notaPorRuta(vaultCentro.notas, vaultCentro.info.name, rel) : null);

const contarSkillsDe = (dir) => skills.filter((s) => s.instalaciones.some((i) => i.ruta.startsWith(dir))).length;

const atlas = {
  version: 2,
  generado: new Date().toISOString(),
  centro: centro?.slug ?? null,
  ias,
  totales: {
    vaults: resumenVaults.length,
    notas: todas.length,
    palabras: resumenVaults.reduce((t, v) => t + v.palabras, 0),
    enlaces: totalEnlaces,
    sinResolver,
    puentes: [...puentes.values()].reduce((t, n) => t + n, 0),
    generados: resumenVaults.reduce((t, v) => t + v.generados, 0),
    skills: skills.length,
    instalaciones: totalInstalaciones,
    agentes: agentesIA.length,
    automatizaciones: automatizaciones.length,
    secretosOcultos: secretos.total,
  },
  vaults: resumenVaults,
  puentes: [...puentes.entries()].map(([clave, n]) => {
    const [de, a] = clave.split('→');
    return { de, a, n };
  }),
  sistema: {
    plataforma: CONFIG.plataforma,
    configLocal: CONFIG.tieneConfigLocal,
    memoria: Boolean(CONFIG.sistemaMemoria),
    contexto: notaCentro('Contexto IA/Contexto para IA.md'),
    reglas: notaCentro('Contexto IA/Reglas de Clasificacion.md'),
    mapaRutas: notaCentro('Contexto IA/Mapa de Rutas.md'),
    multivault: notaCentro('Runbooks/Sistema Multi-vault.md'),
    salud: notaCentro('Reportes/Salud del Sistema.md'),
    routing: routing.map((r) => ({ vault: r.vault, seccion: r.seccion, palabras: r.palabras || [] })),
    motor,
    // De dónde salió cada cosa en este equipo (se muestra en «Cómo trabaja»).
    fuentes: {
      vaults: resumenVaults.map((v) => ({ nombre: v.nombre, ruta: abreviar(v.ruta), notas: v.notas })),
      skills: CONFIG.fuentesSkills
        .filter((f) => fs.existsSync(f.dir))
        .map((f) => ({ ia: f.ia, ruta: abreviar(f.dir), paquete: f.paquete, skills: contarSkillsDe(f.dir) })),
      agentes: CONFIG.fuentesAgentes
        .filter((f) => fs.existsSync(f.dir))
        .map((f) => ({ ia: f.ia, ambito: f.ambito, ruta: abreviar(f.dir), agentes: agentesIA.filter((a) => a.ruta.startsWith(f.dir)).length })),
      automatizaciones: [...new Set(automatizaciones.map((a) => a.ambito))],
    },
  },
};
// Textos que todavía no tienen traducción al español (se completan con npm run traducir).
const pendientes = pendientesDeTraduccion();
atlas.totales.sinTraducir = pendientes.length;
escribir('pendientes-traduccion.json', pendientes);
escribir('atlas.json', atlas);

// Reemplazo casi atómico: se aparta la versión anterior y se borra después.
const anterior = `${CONFIG.salida}.viejo-${process.pid}`;
if (fs.existsSync(CONFIG.salida)) fs.renameSync(CONFIG.salida, anterior);
fs.renameSync(temporal, CONFIG.salida);
fs.rmSync(anterior, { recursive: true, force: true });

const seg = ((Date.now() - inicio) / 1000).toFixed(1);
console.log(
  `Atlas listo en ${seg}s → ${path.relative(process.cwd(), CONFIG.salida) || CONFIG.salida}\n` +
    `  ${atlas.totales.notas} notas en ${atlas.totales.vaults} vaults · ${atlas.totales.enlaces} enlaces · ${atlas.totales.puentes} puentes\n` +
    `  ${atlas.totales.skills} skills (${totalInstalaciones} instalaciones) · ${atlas.totales.agentes} agentes · ${atlas.totales.automatizaciones} automatizaciones\n` +
    `  ${atlas.totales.generados} notas generadas omitidas · ${secretos.total} posibles secretos ocultos · centro: ${centro?.nombre ?? 'ninguno'}\n` +
    `  ${pendientes.length ? `${pendientes.length} textos sin traducir al español → npm run traducir` : 'todo el texto descriptivo está en español'}`,
);
