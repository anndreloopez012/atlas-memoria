// Ruta «Aprende»: pasos para quien empieza, de su primer vault a su primer agente.
// Cada paso se marca solo cuando el atlas ve que ya se hizo (en los datos o por lo
// que se hizo en esta página); los que no se pueden ver se marcan a mano.
import { useSyncExternalStore } from 'react';
import { cargarAgentes, cargarProyectos, cargarSkills, cargarTareas, cargarVault } from './datos';
import { rutaSistema, rutaVault } from './rutas';
import type { Atlas } from './tipos';

export interface Plantilla {
  /** dónde guardarla */
  donde: string;
  texto: string;
}

export interface Paso {
  id: string;
  titulo: string;
  /** para qué sirve, en una línea */
  porque: string;
  /** cómo hacerlo (Markdown corto) */
  como: string;
  plantilla?: Plantilla;
  /** pedido listo para copiar a la IA */
  pedido?: string;
  /** a dónde ir o qué abrir para hacerlo */
  ir?: { texto: string; hash?: string; centro?: string };
  /** lo detectó el atlas solo */
  visto: boolean;
  hecho: boolean;
}

// Notas que trae el vault inicial: no cuentan como «tu primera nota».
const DE_LA_GUIA = new Set(['Empieza aquí', 'Cómo escribir notas', 'Enlazar ideas', 'Mis tareas', 'Skills y agentes', 'Mi primer proyecto', 'Qué es la bandeja', 'Nota', 'Bitácora']);
const propia = (n: { t: string; fm: Record<string, unknown> }) => !DE_LA_GUIA.has(n.t) && n.fm?.origen !== 'atlas-inicial';

// ---- Lo hecho en esta página (preguntar, marcar a mano) ----------------------
const CLAVE = 'atlas:aprende';
const oyentes = new Set<() => void>();
let instantanea = leer();

function leer(): { hechos: string[]; oculto?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || '') ?? { hechos: [] };
  } catch {
    return { hechos: [] };
  }
}
function guardar(cambio: Partial<{ hechos: string[]; oculto: boolean }>) {
  instantanea = { ...instantanea, ...cambio };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(instantanea));
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
  oyentes.forEach((f) => f());
}

/** Marca (o desmarca) un paso como hecho desde la página. */
export function marcarPaso(id: string, hecho = true) {
  const hechos = new Set(instantanea.hechos);
  if (hecho) hechos.add(id);
  else hechos.delete(id);
  guardar({ hechos: [...hechos] });
}
/** Oculta la tarjeta de la ruta en Hoy (sigue en el centro de mando). */
export const ocultarRuta = (oculto = true) => guardar({ oculto });

export function useMarcasAprende() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => instantanea,
  );
}

// ---- Plantillas -----------------------------------------------------------------
const PLANTILLA_SKILL = `---
name: resumir-clase
description: Resume los apuntes de una clase en ideas clave, dudas y tareas. Úsala cuando pida «resume mi clase», «resumen de estos apuntes» o pegue apuntes desordenados.
metadata:
  autor: atlas-aprende
---

# Resumir clase

## Cuándo usarla
Cuando la persona pega apuntes de una clase o una charla y quiere ordenarlos.

## Pasos
1. Lee los apuntes completos.
2. Escribe **5 ideas clave**, una línea cada una.
3. Lista las **dudas** que quedaron abiertas.
4. Convierte lo pendiente en tareas: \`- [ ] tarea 📅 AAAA-MM-DD\`.

## Formato de salida
Markdown listo para pegar como nota en Obsidian, con un título \`# Resumen: <tema>\`.
`;

const PLANTILLA_AGENTE = `---
name: tutor-de-codigo
description: Tutor paciente que revisa código de estudiantes y explica los errores sin dar la solución completa. Úsalo cuando pidan «revisa mi código» o «por qué falla esto».
tools: Read, Grep, Glob
---

Eres un tutor de programación para estudiantes que están aprendiendo.

## Cómo trabajas
- Lee el código y encuentra el error más importante primero.
- Explica **por qué** falla con un ejemplo pequeño; no reescribas todo.
- Termina con una pregunta que lleve a la persona a la solución.

## Reglas
- Responde en español, con palabras simples.
- Nunca entregues la tarea resuelta completa.
`;

/** Carpeta de skills o de agentes del usuario en este equipo (la de Claude primero), para decir dónde guardar. */
function carpetaDe(atlas: Atlas, tipo: 'skills' | 'agentes') {
  const f = atlas.sistema.fuentes;
  const lista = tipo === 'skills' ? f.skills.filter((x) => !x.paquete) : f.agentes.filter((x) => x.ambito === 'Usuario');
  const elegida = lista.find((x) => x.ia === 'Claude') ?? lista[0];
  return elegida?.ruta ?? (tipo === 'skills' ? '~/.claude/skills' : '~/.claude/agents');
}

// ---- Los pasos ---------------------------------------------------------------------
export async function pasosAprende(atlas: Atlas): Promise<Paso[]> {
  const marcas = instantanea.hechos;
  const [vaults, tareas, proyectos, skills, agentes] = await Promise.all([
    Promise.all(atlas.vaults.map((v) => cargarVault(v.slug).catch(() => null))),
    cargarTareas().catch(() => null),
    cargarProyectos().catch(() => null),
    cargarSkills().catch(() => null),
    cargarAgentes().catch(() => null),
  ]);
  const notas = vaults.flatMap((v) => v?.notas ?? []);
  const mias = notas.filter(propia);
  const central = atlas.vaults.find((v) => v.slug === atlas.centro) ?? atlas.vaults[0];
  const carpetaSkills = carpetaDe(atlas, 'skills');
  const carpetaAgentes = carpetaDe(atlas, 'agentes');

  const pasos: Omit<Paso, 'hecho'>[] = [
    {
      id: 'vault',
      titulo: 'Crea tu vault',
      porque: 'Es la carpeta donde vive tu memoria: todo lo demás sale de ahí.',
      como: 'En la portada del atlas toca **Crear mi primer vault**: quedan notas guía en Documentos/«Mi memoria». Si ya usas Obsidian, elige **Ya tengo un vault**.',
      ir: { texto: 'Ir a la portada', hash: '#/' },
      visto: atlas.vaults.length > 0,
    },
    {
      id: 'nota',
      titulo: 'Escribe tu primera nota',
      porque: 'Una idea por nota, con tus palabras: así se recuerda y se puede enlazar.',
      como: 'Abre tu vault en [Obsidian](https://obsidian.md) y crea una nota en la carpeta `Ideas` sobre algo que aprendiste hoy. La plantilla `Plantillas/Nota` te da la estructura.',
      ...(central ? { ir: { texto: `Abrir ${central.nombre}`, hash: rutaVault(central.slug) } } : {}),
      visto: mias.length > 0,
    },
    {
      id: 'enlace',
      titulo: 'Enlaza dos ideas',
      porque: 'Los enlaces convierten notas sueltas en una memoria: en el atlas son las conexiones entre neuronas.',
      como: 'Dentro de una nota escribe `[[Nombre de otra nota]]`. Si no existe, Obsidian la crea al hacer clic. Después mira la constelación de tu vault.',
      visto: mias.some((n) => n.o.length > 0 || n.x.length > 0),
    },
    {
      id: 'tarea',
      titulo: 'Anota una tarea con fecha',
      porque: 'Lo pendiente con fecha aparece ordenado en Hoy, sin que tengas que buscarlo.',
      como: 'En cualquier nota escribe una casilla con fecha y prioridad:\n\n`- [ ] Entregar el proyecto 📅 2026-12-01 ⏫`\n\nLuego márcala como hecha desde **Hoy › Tareas** o desde Obsidian.',
      ir: { texto: 'Ver mis tareas', hash: '#/hoy/tareas' },
      visto: Boolean(tareas?.tareas.some((t) => t.d && !t.g)),
    },
    {
      id: 'proyecto',
      titulo: 'Arma tu primer proyecto',
      porque: 'Un proyecto junta su objetivo, sus pendientes y su historia en un solo lugar.',
      como: 'Renombra `Proyectos/Mi primer proyecto` (y su campo `proyecto:`) con algo real. Cada nota con `proyecto: <nombre>` en su encabezado se suma a su historia; usa la plantilla `Plantillas/Bitácora`.',
      ir: { texto: 'Ver proyectos', hash: '#/hoy/proyectos' },
      visto: Boolean(proyectos?.proyectos.some((p) => p.nombre !== 'Mi primer proyecto')),
    },
    {
      id: 'capturar',
      titulo: 'Captura una idea al vuelo',
      porque: 'Lo que no anotas en el momento se pierde; la bandeja lo guarda para ordenarlo después.',
      como: 'En el centro de mando escribe `+` y tu idea (por ejemplo `+ repasar recursión`) y pulsa Enter: queda como nota en la bandeja de tu vault.',
      ir: { texto: 'Probar ahora', centro: '+ ' },
      visto: notas.some((n) => propia(n) && /^(Bandeja|Inbox)(\/|$)/i.test(n.f)) || notas.some((n) => n.fm?.tipo === 'captura'),
    },
    {
      id: 'preguntar',
      titulo: 'Pregúntale a tu memoria',
      porque: 'Buscar por pregunta, no por palabra: el atlas encuentra las notas que la responden.',
      como: 'En el centro de mando escribe una pregunta, por ejemplo `¿cómo enlazo notas?`, y elige **Preguntar a tu memoria**. Con una IA te responde citando tus notas. Gratis: [Ollama](https://ollama.com) con un modelo (`ollama pull llama3.2`), en tu equipo y sin cuenta, o Gemini CLI con tu cuenta de Google.',
      ir: { texto: 'Hacer una pregunta', centro: '¿cómo enlazo notas?' },
      visto: false,
    },
    {
      id: 'ia',
      titulo: 'Instala una IA de programación',
      porque: 'Las skills y los agentes viven en ella; el atlas los encuentra solos.',
      como: 'Instala [Claude Code](https://claude.com/claude-code), [Codex](https://developers.openai.com/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli) (gratis con tu cuenta de Google) o [Antigravity](https://antigravity.google). Al volver a abrir el atlas aparecen sus skills y agentes.',
      visto: atlas.totales.skills > 0 || atlas.totales.agentes > 0 || atlas.sistema.fuentes.skills.length > 0,
    },
    {
      id: 'skill',
      titulo: 'Crea tu primera skill',
      porque: 'Una skill es un manual que tu IA sigue sola cuando el pedido encaja: enseñas una vez y sirve siempre.',
      como: `Crea la carpeta \`${carpetaSkills}/resumir-clase\` y dentro un archivo \`SKILL.md\` con la plantilla. Lo más importante es la \`description\`: dice **cuándo** usarla. El atlas la verá en segundos.`,
      plantilla: { donde: `${carpetaSkills}/resumir-clase/SKILL.md`, texto: PLANTILLA_SKILL },
      pedido: 'Crea una skill llamada resumir-clase que ordene mis apuntes de clase en ideas clave, dudas y tareas con fecha. Guárdala en mi carpeta de skills de usuario.',
      ir: { texto: 'Ver Skills', hash: '#/skills' },
      visto: Boolean(skills?.skills.some((s) => s.origen === 'propia' || Object.values(s.extras ?? {}).some((v) => v.includes('atlas-aprende')))),
    },
    {
      id: 'agente',
      titulo: 'Crea tu primer agente',
      porque: 'Un agente es un especialista con su rol y sus reglas: tu IA le delega tareas completas.',
      como: `Guarda la plantilla como \`${carpetaAgentes}/tutor-de-codigo.md\`. El encabezado dice su nombre, cuándo usarlo y qué herramientas puede tocar; el resto son sus instrucciones.`,
      plantilla: { donde: `${carpetaAgentes}/tutor-de-codigo.md`, texto: PLANTILLA_AGENTE },
      pedido: 'Crea un agente llamado tutor-de-codigo que revise mi código, explique el error más importante sin darme la solución completa y responda en español. Guárdalo en mi carpeta de agentes de usuario.',
      ir: { texto: 'Ver agentes', hash: rutaSistema('agentes') },
      visto: Boolean(agentes?.agentes.some((a) => a.tipo === 'ia')),
    },
  ];
  return pasos.map((p) => ({ ...p, hecho: p.visto || marcas.includes(p.id) }));
}
