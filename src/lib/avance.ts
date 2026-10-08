// «Mi avance»: un resumen para compartir con un mentor o docente. Solo cifras,
// nombres de vaults, proyectos, skills y agentes, y la ruta Aprende: nunca el
// contenido ni los títulos de las notas. Se descarga como una página HTML (que
// también lleva los datos en JSON, para que otra herramienta o una IA los lea) o
// se copia como texto.
import { pasosAprende } from './aprende';
import { cargarAgentes, cargarProyectos, cargarRecientes, cargarSkills, cargarTareas } from './datos';
import type { Atlas } from './tipos';

export interface Avance {
  formato: 'atlas-avance';
  version: 1;
  generado: string;
  nombre: string | null;
  vaults: { nombre: string; notas: number; palabras: number; enlaces: number; ultima: string }[];
  totales: { notas: number; palabras: number; enlaces: number; puentes: number };
  /** notas escritas o editadas por semana (las más recientes primero), sin las que reescriben herramientas */
  semanas: { desde: string; notas: number }[];
  tareas: { abiertas: number; hechas: number; conFecha: number };
  proyectos: { nombre: string; estado: string | null; actividad: string | null }[];
  skills: { total: number; creadas: { nombre: string; descripcion: string }[] };
  agentes: { nombre: string; ia: string; descripcion: string }[];
  aprende: { hechos: number; total: number; pasos: { titulo: string; hecho: boolean }[] };
}

const DIA = 86_400_000;

export async function armarAvance(atlas: Atlas, nombre: string | null): Promise<Avance> {
  const [recientes, tareas, proyectos, skills, agentes, pasos] = await Promise.all([
    cargarRecientes().catch(() => null),
    cargarTareas().catch(() => null),
    cargarProyectos().catch(() => null),
    cargarSkills().catch(() => null),
    cargarAgentes().catch(() => null),
    pasosAprende(atlas),
  ]);
  const ahora = Date.now();
  const cuantasSemanas = Math.max(1, Math.min(6, Math.floor((recientes?.dias ?? 42) / 7)));
  const semanas = Array.from({ length: cuantasSemanas }, (_, i) => {
    const hasta = ahora - i * 7 * DIA;
    const desde = hasta - 7 * DIA;
    return {
      desde: new Date(desde).toISOString().slice(0, 10),
      notas: (recientes?.notas ?? []).filter((n) => !n.g && Date.parse(n.m) > desde && Date.parse(n.m) <= hasta).length,
    };
  });
  const creadas = (skills?.skills ?? []).filter((s) => s.origen === 'propia' || Object.values(s.extras ?? {}).some((v) => v.includes('atlas-aprende')));
  return {
    formato: 'atlas-avance',
    version: 1,
    generado: new Date().toISOString(),
    nombre: nombre?.trim() || null,
    vaults: atlas.vaults.map((v) => ({ nombre: v.nombre, notas: v.notas, palabras: v.palabras, enlaces: v.enlaces, ultima: v.ultima })),
    totales: { notas: atlas.totales.notas, palabras: atlas.vaults.reduce((t, v) => t + v.palabras, 0), enlaces: atlas.totales.enlaces, puentes: atlas.totales.puentes },
    semanas,
    tareas: { abiertas: tareas?.abiertas ?? 0, hechas: tareas?.hechas ?? 0, conFecha: (tareas?.tareas ?? []).filter((t) => t.d && !t.g).length },
    proyectos: (proyectos?.proyectos ?? []).slice(0, 20).map((p) => ({ nombre: p.nombre, estado: p.estado, actividad: p.actividad })),
    skills: { total: skills?.skills.length ?? 0, creadas: creadas.slice(0, 30).map((s) => ({ nombre: s.nombre, descripcion: s.descripcion })) },
    agentes: (agentes?.agentes ?? []).filter((a) => a.tipo === 'ia').slice(0, 30).map((a) => ({ nombre: a.nombre, ia: a.ia, descripcion: a.descripcion })),
    aprende: { hechos: pasos.filter((p) => p.hecho).length, total: pasos.length, pasos: pasos.map((p) => ({ titulo: p.titulo, hecho: p.hecho })) },
  };
}

const n = (x: number) => x.toLocaleString('es-GT');
/** «1 nota», «3 notas». */
const pl = (x: number, uno: string, varios: string) => `${n(x)} ${x === 1 ? uno : varios}`;
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** El resumen como texto (Markdown) para pegar en un chat, un correo o una tarea. */
export function avanceComoTexto(a: Avance): string {
  const l: string[] = [];
  l.push(`# Mi avance en el Atlas de memoria${a.nombre ? ` · ${a.nombre}` : ''}`, '', `Generado el ${fecha(a.generado)}.`, '');
  l.push('## Memoria', `- ${pl(a.totales.notas, 'nota', 'notas')}, ${pl(a.totales.palabras, 'palabra', 'palabras')} y ${pl(a.totales.enlaces, 'enlace', 'enlaces')} en ${pl(a.vaults.length, 'vault', 'vaults')}.`);
  for (const v of a.vaults) l.push(`  - ${v.nombre}: ${pl(v.notas, 'nota', 'notas')}, ${pl(v.enlaces, 'enlace', 'enlaces')}, última edición ${fecha(v.ultima)}.`);
  l.push('', '## Constancia (notas escritas o editadas por semana)');
  for (const s of a.semanas) l.push(`- Semana del ${fecha(s.desde)}: ${s.notas}`);
  l.push('', '## Tareas', `- ${pl(a.tareas.abiertas, 'pendiente', 'pendientes')} (${a.tareas.conFecha} con fecha) y ${pl(a.tareas.hechas, 'hecha', 'hechas')}.`);
  if (a.proyectos.length) {
    l.push('', '## Proyectos');
    for (const p of a.proyectos) l.push(`- ${p.nombre}${p.estado ? ` (${p.estado})` : ''}${p.actividad ? `, última actividad ${fecha(p.actividad)}` : ''}`);
  }
  l.push('', '## Skills y agentes', `- ${pl(a.skills.total, 'skill disponible', 'skills disponibles')}; ${pl(a.skills.creadas.length, 'creada', 'creadas')} por mí.`);
  for (const s of a.skills.creadas) l.push(`  - ${s.nombre}: ${s.descripcion}`);
  l.push(`- ${pl(a.agentes.length, 'agente', 'agentes')}.`);
  for (const ag of a.agentes) l.push(`  - ${ag.nombre} (${ag.ia}): ${ag.descripcion}`);
  l.push('', `## Ruta Aprende: ${a.aprende.hechos} de ${a.aprende.total}`);
  for (const p of a.aprende.pasos) l.push(`- [${p.hecho ? 'x' : ' '}] ${p.titulo}`);
  l.push('', '_No incluye el contenido de mis notas ni sus títulos (solo los nombres de mis proyectos)._');
  return l.join('\n');
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** El resumen como una página HTML autónoma (con los datos en JSON adentro). */
export function avanceComoHTML(a: Avance): string {
  const max = Math.max(1, ...a.semanas.map((s) => s.notas));
  const barras = [...a.semanas]
    .reverse()
    .map((s) => `<div class="barra" title="${s.notas} notas"><span style="height:${Math.round((s.notas / max) * 100)}%"></span><small>${esc(fecha(s.desde).replace(/\s\d{4}$/, ''))}</small><b>${s.notas}</b></div>`)
    .join('');
  const lista = (items: string[]) => (items.length ? `<ul>${items.join('')}</ul>` : '<p class="tenue">Todavía nada.</p>');
  const json = JSON.stringify(a).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mi avance${a.nombre ? ` · ${esc(a.nombre)}` : ''} · Atlas de memoria</title>
<style>
:root{--fondo:#f6f3ec;--papel:#fffdf8;--tinta:#1c1b18;--tenue:#6d6b65;--linea:#e4ded0;--acento:#94641a;--ok:#23804a}
@media (prefers-color-scheme:dark){:root{--fondo:#0b0c11;--papel:#12151e;--tinta:#ece8dd;--tenue:#a8a59b;--linea:#262a36;--acento:#dcb56c;--ok:#86efac}}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--tinta);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:40px 16px 60px}h1{font:600 30px/1.15 Georgia,serif;margin:0 0 4px}h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--acento);margin:0 0 12px}
.tenue{color:var(--tenue)}.rejilla{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:22px}
section{background:var(--papel);border:1px solid var(--linea);border-radius:14px;padding:18px}
.cifras{display:flex;flex-wrap:wrap;gap:22px;margin:22px 0 0}.cifras div{display:flex;flex-direction:column}.cifras b{font:600 28px Georgia,serif}.cifras span{font-size:12px;color:var(--tenue);text-transform:uppercase;letter-spacing:.08em}
.barras{display:flex;align-items:flex-end;gap:10px;height:140px}.barra{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px}.barra span{display:block;width:100%;min-height:3px;background:var(--acento);border-radius:6px 6px 2px 2px}.barra small{font-size:11px;color:var(--tenue)}.barra b{font-size:12px}
ul{margin:0;padding-left:18px}li{margin:3px 0}.paso{list-style:none;margin-left:-18px}.paso::before{content:"○ ";color:var(--tenue)}.paso.hecho::before{content:"● ";color:var(--ok)}
footer{margin-top:28px;font-size:13px;color:var(--tenue)}
</style></head><body><main>
<p class="tenue">Atlas de memoria · ${esc(fecha(a.generado))}</p>
<h1>Mi avance${a.nombre ? ` · ${esc(a.nombre)}` : ''}</h1>
<div class="cifras"><div><b>${n(a.totales.notas)}</b><span>notas</span></div><div><b>${n(a.totales.enlaces)}</b><span>enlaces</span></div><div><b>${n(a.totales.palabras)}</b><span>palabras</span></div><div><b>${a.aprende.hechos}/${a.aprende.total}</b><span>ruta Aprende</span></div></div>
<div class="rejilla">
<section style="grid-column:1/-1"><h2>Constancia</h2><p class="tenue">Notas escritas o editadas por semana.</p><div class="barras">${barras}</div></section>
<section><h2>Vaults</h2>${lista(a.vaults.map((v) => `<li><b>${esc(v.nombre)}</b>: ${pl(v.notas, 'nota', 'notas')}, ${pl(v.enlaces, 'enlace', 'enlaces')} <span class="tenue">· ${esc(fecha(v.ultima))}</span></li>`))}</section>
<section><h2>Tareas</h2><p>${pl(a.tareas.abiertas, 'pendiente', 'pendientes')} (${a.tareas.conFecha} con fecha)<br>${pl(a.tareas.hechas, 'hecha', 'hechas')}</p></section>
<section><h2>Proyectos</h2>${lista(a.proyectos.map((p) => `<li>${esc(p.nombre)}${p.estado ? ` <span class="tenue">(${esc(p.estado)})</span>` : ''}</li>`))}</section>
<section><h2>Ruta Aprende</h2><ul>${a.aprende.pasos.map((p) => `<li class="paso${p.hecho ? ' hecho' : ''}">${esc(p.titulo)}</li>`).join('')}</ul></section>
<section><h2>Skills creadas</h2><p class="tenue">${pl(a.skills.total, 'disponible', 'disponibles')} en total.</p>${lista(a.skills.creadas.map((s) => `<li><b>${esc(s.nombre)}</b>: ${esc(s.descripcion)}</li>`))}</section>
<section><h2>Agentes</h2>${lista(a.agentes.map((g) => `<li><b>${esc(g.nombre)}</b> <span class="tenue">(${esc(g.ia)})</span>: ${esc(g.descripcion)}</li>`))}</section>
</div>
<footer>No incluye el contenido de las notas ni sus títulos (solo los nombres de los proyectos). Los datos van también en formato JSON dentro de esta página (<code>#atlas-avance</code>).</footer>
</main><script type="application/json" id="atlas-avance">${json}</script></body></html>`;
}

/** Descarga el resumen como archivo HTML. */
export function descargarAvance(a: Avance) {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([avanceComoHTML(a)], { type: 'text/html;charset=utf-8' }));
  enlace.download = `Mi avance${a.nombre ? ` - ${a.nombre.replace(/[\\/:*?"<>|]/g, '')}` : ''} - ${a.generado.slice(0, 10)}.html`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000);
}
