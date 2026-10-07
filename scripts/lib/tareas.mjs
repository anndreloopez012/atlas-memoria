// Tareas de los vaults: casillas de Markdown (`- [ ] …`) con fecha y prioridad al
// estilo del complemento Tasks de Obsidian (📅 2026-10-12, [due:: …], ⏫ 🔼 🔽).
// Se omiten los bloques de código y las carpetas de plantillas.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CASILLA = /^(\s*)(?:[-*+]|\d+[.)])\s+\[( |x|X|\/|-|>)\]\s+(.*)$/;

/** Huella de una línea: el servidor la compara antes de marcar una tarea como hecha. */
export function huellaLinea(linea) {
  return crypto.createHash('sha1').update(linea.trimEnd()).digest('hex').slice(0, 10);
}

/** Carpetas de plantillas de un vault (núcleo de Obsidian y Templater), más las de nombre habitual. */
export function carpetasDePlantillas(dirVault) {
  const salida = new Set(['Templates', 'Plantillas', 'templates', 'plantillas']);
  const leer = (rel, campo) => {
    try {
      const valor = JSON.parse(fs.readFileSync(path.join(dirVault, '.obsidian', rel), 'utf8'))[campo];
      if (typeof valor === 'string' && valor.trim()) salida.add(valor.trim().replace(/^\/+|\/+$/g, ''));
    } catch {
      /* sin configuración */
    }
  };
  leer('templates.json', 'folder');
  leer('plugins/templater-obsidian/data.json', 'templates_folder');
  return salida;
}

const FECHA = /\d{4}-\d{2}-\d{2}/;
const PRIORIDAD = [
  [/[🔺⏫]/u, 'alta'],
  [/🔼/u, 'media'],
  [/[🔽⏬]/u, 'baja'],
];

function limpiar(texto) {
  return texto
    .replace(/(?:📅|⏳|🛫|➕|✅|❌)\s*\d{4}-\d{2}-\d{2}/gu, '')
    .replace(/\[?(?:due|scheduled|start|created|completion)::\s*[^\]\s]+\]?/gi, '')
    .replace(/[🔺⏫🔼🔽⏬🔁]/gu, '')
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, (_, d) => d.split('/').pop())
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

/**
 * Tareas de una nota. `texto` es el archivo completo (con frontmatter), así los
 * números de línea coinciden con el archivo.
 */
export function extraerTareas(texto) {
  const salida = [];
  let enCodigo = false;
  const lineas = texto.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (/^\s*(```|~~~)/.test(linea)) {
      enCodigo = !enCodigo;
      continue;
    }
    if (enCodigo) continue;
    const m = linea.match(CASILLA);
    if (!m) continue;
    const estado = m[2];
    const cuerpo = m[3];
    const due = cuerpo.match(/📅\s*(\d{4}-\d{2}-\d{2})/u)?.[1] || cuerpo.match(/due::\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
    const programada = cuerpo.match(/⏳\s*(\d{4}-\d{2}-\d{2})/u)?.[1] || cuerpo.match(/scheduled::\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
    const descripcion = limpiar(cuerpo);
    if (!descripcion) continue;
    salida.push({
      l: i + 1,
      x: descripcion,
      e: estado === ' ' ? 'abierta' : estado === '/' ? 'en-curso' : estado === '-' ? 'cancelada' : 'hecha',
      ...(due || programada ? { d: (due || programada).match(FECHA)[0] } : {}),
      ...(PRIORIDAD.find(([re]) => re.test(cuerpo)) ? { p: PRIORIDAD.find(([re]) => re.test(cuerpo))[1] } : {}),
      h: huellaLinea(linea),
    });
  }
  return salida;
}

const CASILLA_ABIERTA = /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |\/)(\]\s+)/;

/**
 * Marca como hecha la tarea de la línea `linea` (desde 1) del archivo `abs`:
 * cambia `[ ]` (o `[/]`) por `[x]` en esa línea y en nada más. Antes confirma
 * que la línea sigue igual por su `huella`; si la nota cambió, la busca en las
 * líneas cercanas y, si no la encuentra, no toca nada.
 * @param {string} abs
 * @param {number} linea
 * @param {string} huella
 * @returns {{ ok: boolean, error?: string }}
 */
export function marcarHecha(abs, linea, huella) {
  const lineas = fs.readFileSync(abs, 'utf8').split('\n');
  const cercanas = [linea - 1];
  for (let k = 1; k <= 30; k++) cercanas.push(linea - 1 + k, linea - 1 - k);
  const i = cercanas.find((j) => j >= 0 && j < lineas.length && huellaLinea(lineas[j]) === huella && CASILLA_ABIERTA.test(lineas[j]));
  if (i === undefined) return { ok: false, error: 'La nota cambió desde la última lectura: actualiza y vuelve a intentar' };
  lineas[i] = lineas[i].replace(CASILLA_ABIERTA, '$1x$3');
  fs.writeFileSync(abs, lineas.join('\n'));
  return { ok: true };
}
