// «¿Qué skill uso para…?»: recomienda skills a partir de una tarea descrita con
// palabras propias. Funciona sin internet: busca en las frases que activan cada
// skill, en cuándo usarla, en su descripción (en español y en la original) y en su
// nombre, sin las palabras vacías («quiero», «hacer», «para»…). Cada recomendación
// trae el motivo: la frase de la skill que más se parece al pedido.
import MiniSearch from 'minisearch';
import type { Skill } from './tipos';

const VACIAS = new Set(
  (
    'a al algo algun alguna algunos ante con como cual cuando de del desde donde el ella en entre era es esa ese eso esta este esto estos ha hacer haga hago hay la las le lo los me mi mis mucho muy necesito nos o otra otro para pero poder por puedo que quiero se ser si sin sobre su sus te tengo tu tus un una uno unos usar uso y ya ' +
    'about an and are as at be by can for from help how i in into is it make me my need of on or please the this to use want with you your'
  ).split(' '),
);

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Plural → singular aproximado, igual en el índice y en el pedido («imágenes» = «imagen»).
const raiz = (t: string) => (t.length > 5 && t.endsWith('es') ? t.slice(0, -2) : t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);

// Verbos que no dicen qué hacer en concreto: si el pedido tiene algo más, no cuentan.
const GENERICOS = new Set('armar construir crear escribir generar hacer mejorar poner revisar ver build create improve make review write'.split(' '));

// Algunas palabras en español y su equivalente en inglés: muchas skills solo tienen
// la descripción original en inglés.
const SINONIMOS: Record<string, string[]> = {
  video: ['video', 'clip'],
  imagen: ['image', 'picture'],
  imagenes: ['image', 'images'],
  correos: ['email', 'emails'],
  pago: ['payment', 'billing'],
  pagos: ['payments', 'billing'],
  diseno: ['design', 'ui'],
  pagina: ['page', 'website', 'landing'],
  web: ['web', 'website'],
  base: ['database'],
  datos: ['data', 'database'],
  prueba: ['test', 'testing'],
  pruebas: ['tests', 'testing'],
  seguridad: ['security'],
  despliegue: ['deploy', 'deployment'],
  desplegar: ['deploy'],
  presentacion: ['presentation', 'slides', 'deck'],
  documento: ['document', 'doc'],
  hoja: ['spreadsheet', 'sheet'],
  musica: ['music', 'audio'],
  voz: ['voice', 'speech'],
  animacion: ['animation', 'motion'],
  grafico: ['chart', 'graph'],
  graficos: ['charts', 'graphs'],
  contrato: ['contract'],
  factura: ['invoice'],
  ventas: ['sales'],
  anuncio: ['ad', 'ads'],
  anuncios: ['ads', 'advertising'],
  redes: ['social'],
  marca: ['brand'],
  traducir: ['translate'],
  revisar: ['review'],
  error: ['bug', 'debug'],
  errores: ['bugs', 'debug'],
  rendimiento: ['performance', 'optimize'],
  accesibilidad: ['accessibility', 'a11y'],
  cobrar: ['payment', 'charge', 'checkout', 'stripe'],
  cobros: ['payments', 'checkout', 'stripe'],
  tarjeta: ['card'],
  produccion: ['production', 'deploy'],
  subir: ['deploy', 'upload', 'publish'],
  publicar: ['publish', 'deploy'],
  servidor: ['server'],
  correo: ['email', 'mail'],
};

interface Doc {
  id: string;
  nombre: string;
  activadores: string;
  cuando: string;
  descripcion: string;
  original: string;
  categoria: string;
}

export interface Recomendacion {
  skill: Skill;
  /** la frase de la skill que más se parece al pedido */
  razon: string;
}

const cache = new WeakMap<Skill[], (consulta: string, cuantas?: number) => Recomendacion[]>();

export function recomendador(skills: Skill[]) {
  const guardado = cache.get(skills);
  if (guardado) return guardado;
  const porId = new Map(skills.map((s) => [s.id, s]));
  const indice = new MiniSearch<Doc>({
    fields: ['nombre', 'activadores', 'cuando', 'descripcion', 'original', 'categoria'],
    storeFields: ['id'],
    processTerm: (t) => {
      const n = normalizar(t);
      return n.length < 2 || VACIAS.has(n) ? null : raiz(n);
    },
    searchOptions: {
      boost: { activadores: 4, nombre: 3, cuando: 3, descripcion: 2, original: 1.4, categoria: 1 },
      prefix: (t) => t.length > 3,
      combineWith: 'OR',
    },
  });
  indice.addAll(
    skills.map((s) => ({
      id: s.id,
      nombre: s.nombre.replace(/[-_]/g, ' '),
      activadores: s.activadores.join(' · '),
      cuando: s.cuando.join(' '),
      descripcion: `${s.descripcion} ${s.que.join(' ')}`,
      original: s.descripcionOriginal ?? '',
      categoria: s.categoria,
    })),
  );

  const recomendar = (consulta: string, cuantas = 5): Recomendacion[] => {
    const palabras = normalizar(consulta)
      .split(/[^a-z0-9ñ]+/)
      .filter((p) => p.length >= 2 && !VACIAS.has(p));
    if (!palabras.length) return [];
    // Cada idea del pedido es la palabra con sus sinónimos. Una skill tiene que
    // cubrir al menos la mitad (y la única, si hay una): si no, mejor no recomendar.
    const concretas = palabras.filter((p) => !GENERICOS.has(p));
    const ideas = (concretas.length ? concretas : palabras).map((p) => [p, ...(SINONIMOS[p] ?? [])].map(raiz));
    const minimo = Math.ceil(ideas.length / 2);
    return indice
      .search(ideas.flat().join(' '))
      .filter((r) => ideas.filter((idea) => idea.some((t) => r.queryTerms.includes(t))).length >= minimo)
      .slice(0, cuantas)
      .map((r) => {
        const skill = porId.get(r.id as string)!;
        const terminos = Object.keys(r.match);
        const frases = [...skill.activadores.map((a) => `«${a}»`), ...skill.cuando, ...skill.que, skill.descripcion];
        const razon = frases.find((f) => terminos.some((t) => normalizar(f).includes(t))) ?? skill.que[0] ?? skill.descripcion;
        return { skill, razon: razon.length > 140 ? `${razon.slice(0, 138)}…` : razon };
      });
  };
  cache.set(skills, recomendar);
  return recomendar;
}

/** El pedido listo para pegar en cualquier IA. */
export const pedidoPara = (skill: Skill, tarea: string) => `Usa la skill «${skill.nombre}» para ${tarea.trim() || 'esta tarea'}.`;
