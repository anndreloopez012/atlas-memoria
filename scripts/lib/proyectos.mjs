// Proyectos: salen de las notas. Un proyecto es una nota con `tipo` (o `type`)
// `proyecto`, `proyecto-moc` o `project`; las notas con `proyecto: <nombre>` en el
// frontmatter son su historia (bitácora, decisiones, cambios). Si hay un sistema de
// memoria con semáforo (`data/operational_status.json`), se suma su estado.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.mjs';

const ES_PROYECTO = /^(proyecto-moc|proyecto|project)$/i;
const valor = (fm, ...claves) => {
  for (const c of claves) if (typeof fm[c] === 'string' && fm[c].trim()) return fm[c].trim();
  return null;
};

function leerSemaforo() {
  if (!CONFIG.sistemaMemoria) return null;
  try {
    const datos = JSON.parse(fs.readFileSync(path.join(CONFIG.sistemaMemoria, 'data', 'operational_status.json'), 'utf8'));
    return datos.projects && typeof datos.projects === 'object' ? datos.projects : null;
  } catch {
    return null;
  }
}

/**
 * @param {Array} todas notas de todos los vaults (con `fm`, `m`, `id`, `v`, `t`)
 * @param {(nombre: string) => string} slug slug de un vault
 * @param {(nota: object) => boolean} esGenerada notas que reescribe una herramienta
 */
export function leerProyectos(todas, slug, esGenerada) {
  const semaforo = leerSemaforo();
  const porNombre = new Map();
  const clave = (nombre) => nombre.toLowerCase();

  // 1. Notas principales: una por proyecto (gana `proyecto-moc`, la ficha resumen).
  for (const n of todas) {
    const tipo = valor(n.fm, 'tipo', 'type');
    if (!tipo || !ES_PROYECTO.test(tipo)) continue;
    const nombre = valor(n.fm, 'proyecto', 'project') || n.t;
    const actual = porNombre.get(clave(nombre));
    if (actual && !(tipo.toLowerCase() === 'proyecto-moc' && actual._tipo !== 'proyecto-moc')) continue;
    porNombre.set(clave(nombre), {
      nombre,
      s: slug(n.v),
      id: n.id,
      familia: valor(n.fm, 'familia', 'family'),
      rol: valor(n.fm, 'rol', 'role'),
      estado: valor(n.fm, 'estado', 'status'),
      _tipo: tipo.toLowerCase(),
      _entradas: [],
      _notas: 0,
    });
  }

  // 2. Historia: las notas que nombran al proyecto (sin las que reescriben herramientas).
  for (const n of todas) {
    const nombre = valor(n.fm, 'proyecto', 'project');
    const p = nombre && porNombre.get(clave(nombre));
    if (!p || n.id === p.id) continue;
    p._notas += 1;
    if (esGenerada(n)) continue;
    const fecha = valor(n.fm, 'fecha', 'date');
    // El primer encabezado suele leerse mejor que el nombre del archivo (fecha-proyecto-slug).
    const titulo = n.h?.find((h) => h.n === 1)?.t || n.t;
    p._entradas.push({ id: n.id, s: slug(n.v), t: titulo, tipo: valor(n.fm, 'tipo', 'type'), fecha: fecha && /^\d{4}-\d{2}-\d{2}/.test(fecha) ? fecha.slice(0, 10) : n.m.slice(0, 10), m: n.m });
  }

  const proyectos = [...porNombre.values()].map((p) => {
    p._entradas.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.m.localeCompare(a.m));
    const sem = semaforo?.[p.nombre];
    const fechas = [p._entradas[0]?.m, sem?.source_updated_at].filter(Boolean).sort();
    return {
      nombre: p.nombre,
      s: p.s,
      id: p.id,
      familia: p.familia,
      rol: p.rol,
      estado: p.estado,
      ...(sem ? { semaforo: sem.semaforo || null, motivos: [...(sem.motivos || []), ...(sem.informativo || [])].slice(0, 4) } : {}),
      actividad: fechas.at(-1) ?? null,
      entradas: p._entradas.slice(0, 5).map(({ m, ...e }) => e),
      totalEntradas: p._entradas.length,
      notas: p._notas,
    };
  });
  proyectos.sort((a, b) => (b.actividad || '').localeCompare(a.actividad || '') || a.nombre.localeCompare(b.nombre, 'es'));
  return { semaforo: Boolean(semaforo), proyectos };
}
