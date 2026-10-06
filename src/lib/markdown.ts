// Markdown de Obsidian → HTML seguro. Entiende callouts (> [!info]), enlaces
// reescritos por el generador (atlas:<id>) y tablas/tareas de GFM.
import DOMPurify from 'dompurify';
import { Marked, type Tokens } from 'marked';

export const slugTitulo = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:[a-z]+|#\d+);/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const motor = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    heading({ tokens, depth }: Tokens.Heading) {
      const html = this.parser.parseInline(tokens);
      return `<h${depth} id="${slugTitulo(html)}">${html}</h${depth}>\n`;
    },
    link({ href, title, tokens }: Tokens.Link) {
      const texto = this.parser.parseInline(tokens);
      if (href.startsWith('atlas:')) return `<a href="#" class="enlace-nota" data-nota="${escapar(href.slice(6))}">${texto}</a>`;
      if (href.startsWith('atlas-roto:')) return `<span class="enlace-roto" title="Esta nota todavía no existe en el vault">${texto}</span>`;
      const externo = /^https?:\/\//.test(href) || href.startsWith('/adjunto/') || href.startsWith('obsidian://');
      const t = title ? ` title="${escapar(title)}"` : '';
      if (externo) return `<a href="${escapar(href)}"${t} target="_blank" rel="noopener noreferrer">${texto}</a>`;
      return `<a href="#" class="enlace-relativo" data-ruta="${escapar(href)}"${t}>${texto}</a>`;
    },
    image({ href, text }: Tokens.Image) {
      if (!/^(https?:\/\/|\/adjunto\/)/.test(href)) return `<span class="imagen-ausente">${escapar(text || href)}</span>`;
      return `<img src="${escapar(href)}" alt="${escapar(text)}" loading="lazy" />`;
    },
    code({ text, lang }: Tokens.Code) {
      const lenguaje = (lang || '').split(/\s/)[0];
      const etiqueta =
        lenguaje === 'dataview' || lenguaje === 'dataviewjs' ? 'consulta Dataview · se ejecuta en Obsidian' : lenguaje === 'base' ? 'vista Bases · se ejecuta en Obsidian' : lenguaje;
      return `<pre data-lang="${escapar(etiqueta)}"><code>${escapar(text)}</code></pre>\n`;
    },
  },
});

const TITULOS_CALLOUT: Record<string, string> = {
  info: 'Info',
  note: 'Nota',
  tip: 'Consejo',
  warning: 'Atención',
  danger: 'Peligro',
  abstract: 'Resumen',
  summary: 'Resumen',
  example: 'Ejemplo',
  quote: 'Cita',
  question: 'Pregunta',
  success: 'Hecho',
  bug: 'Bug',
  todo: 'Pendiente',
};

/** Convierte los callouts en marcadores y los renderiza aparte (pueden anidar markdown). */
function extraerCallouts(md: string, bloques: string[]): string {
  const lineas = md.split('\n');
  const salida: string[] = [];
  let enCodigo = false;
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (/^\s*(```|~~~)/.test(linea)) enCodigo = !enCodigo;
    const m = !enCodigo && linea.match(/^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)$/);
    if (!m) {
      salida.push(linea);
      continue;
    }
    const cuerpo: string[] = [];
    while (i + 1 < lineas.length && /^>/.test(lineas[i + 1])) {
      i += 1;
      cuerpo.push(lineas[i].replace(/^>\s?/, ''));
    }
    const tipo = m[1].toLowerCase();
    const titulo = m[3] ? motor.parseInline(m[3]) : TITULOS_CALLOUT[tipo] || m[1];
    const interior = motor.parse(extraerCallouts(cuerpo.join('\n'), bloques)) as string;
    bloques.push(
      `<div class="callout" data-tipo="${escapar(tipo)}"><div class="callout-titulo">${titulo}</div>${interior.trim() ? `<div class="callout-cuerpo">${interior}</div>` : ''}</div>`,
    );
    salida.push('', `<div data-callout="${bloques.length - 1}"></div>`, '');
  }
  return salida.join('\n');
}

export function renderizarMarkdown(md: string): string {
  const bloques: string[] = [];
  const limpio = md.replace(/<!--[\s\S]*?-->/g, '');
  let html = motor.parse(extraerCallouts(limpio, bloques)) as string;
  // Los callouts anidados se resuelven de adentro hacia afuera.
  for (let pasada = 0; pasada < 4 && html.includes('data-callout='); pasada++) {
    html = html.replace(/<div data-callout="(\d+)"><\/div>/g, (_, i) => bloques[Number(i)]);
  }
  html = html.replace(/<table>/g, '<div class="tabla"><table>').replace(/<\/table>/g, '</table></div>');
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'data-nota', 'data-ruta', 'data-lang', 'data-tipo'] });
}
