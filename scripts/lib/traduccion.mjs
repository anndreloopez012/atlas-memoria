// Traducción al español de todo texto descriptivo (descripciones de skills y
// agentes, resúmenes, docstrings). Los nombres propios se quedan como están.
//
// Las traducciones viven en traducciones/es.json (versionado), con la huella del
// texto original como clave: si el original cambia, se vuelve a pedir.
// Lo que falta se anota en datos/pendientes-traduccion.json y se completa con
// `npm run traducir`.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './config.mjs';

export const ARCHIVO_TRADUCCIONES = path.join(RAIZ, 'traducciones', 'es.json');

let diccionario = null;
const pendientes = new Map();

function cargar() {
  if (!diccionario) {
    try {
      diccionario = JSON.parse(fs.readFileSync(ARCHIVO_TRADUCCIONES, 'utf8'));
    } catch {
      diccionario = {};
    }
  }
  return diccionario;
}

export const claveTraduccion = (texto) => crypto.createHash('sha1').update(texto.trim()).digest('hex').slice(0, 16);

// Palabras que delatan el idioma. No hace falta precisión: ante la duda se traduce
// (si ya estaba en español, el traductor lo devuelve igual).
const INGLES = new Set(
  'the and to of for with is are you your this that when use using used user users wants asks build create make not or any from it its on in into an be by as how what which should will can all each every before after only also skill skills trigger triggers including such about like new existing them their these those set get run add adds via without within across over under more most other than then there here was were has have do does done must may need needs one two first next see each own'.split(' '),
);
const ESPANOL = new Set(
  'el la los las de del que para con en una un por es se y o su sus al lo como cuando qué cómo más sin sobre este esta estos estas todo toda cada usa usar hay son está desde hasta entre también donde ya pero si no'.split(' '),
);

export function pareceEspanol(texto) {
  const palabras = texto.toLowerCase().match(/[a-záéíóúñü]+/g) || [];
  let en = 0;
  let es = 0;
  for (const p of palabras) {
    if (INGLES.has(p)) en += 1;
    if (ESPANOL.has(p)) es += 1;
  }
  if (/[áéíóúñ¿¡]/i.test(texto)) es += 2;
  // En textos largos (documentos) alcanza con que domine el español.
  if (palabras.length > 60) return es > en * 1.5;
  return en === 0 && es > 0;
}

/**
 * Devuelve la traducción si existe; si no, anota el texto como pendiente (salvo
 * con `registrar: false`) y devuelve el original.
 */
export function es(texto, tipo = 'frase', { registrar = true } = {}) {
  if (typeof texto !== 'string') return texto;
  const limpio = texto.trim();
  if (limpio.length < 3 || !/[a-z]{3}/i.test(limpio)) return texto;
  // Código o rutas sueltas (`x`, references/a.md, SKILL.md) no se traducen.
  const esCodigo = /^`[^`]+`$/.test(limpio) || (!/\s/.test(limpio) && /[./@_]/.test(limpio));
  if (esCodigo) return texto;
  if (pareceEspanol(limpio)) return texto;
  const clave = claveTraduccion(limpio);
  const traduccion = cargar()[clave];
  if (typeof traduccion === 'string' && traduccion.trim()) return traduccion;
  if (registrar && !pendientes.has(clave)) pendientes.set(clave, { clave, tipo, texto: limpio });
  return texto;
}

/** ¿Hay traducción para este texto (o no la necesita)? */
export function estaTraducido(texto) {
  const limpio = (texto || '').trim();
  return !limpio || pareceEspanol(limpio) || typeof cargar()[claveTraduccion(limpio)] === 'string';
}

/** Parte un markdown largo en piezas (por encabezados, sin cortar bloques de código). */
export function partirDocumento(markdown, maximo = 6000) {
  const secciones = [];
  let actual = [];
  let enCodigo = false;
  for (const linea of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(linea)) enCodigo = !enCodigo;
    if (!enCodigo && /^#{1,3}\s/.test(linea) && actual.some((l) => l.trim())) {
      secciones.push(actual.join('\n'));
      actual = [];
    }
    actual.push(linea);
  }
  if (actual.length) secciones.push(actual.join('\n'));
  const piezas = [];
  let bufer = '';
  for (const s of secciones) {
    if (bufer && bufer.length + s.length + 1 > maximo) {
      piezas.push(bufer);
      bufer = s;
    } else {
      bufer = bufer ? `${bufer}\n${s}` : s;
    }
  }
  if (bufer.trim()) piezas.push(bufer);
  return piezas;
}

export function esDocumento(markdown, tipo = 'documento', opciones = {}) {
  if (!markdown || !markdown.trim()) return markdown;
  return partirDocumento(markdown)
    .map((pieza) => es(pieza, tipo, opciones))
    .join('\n\n');
}

export function documentoTraducido(markdown) {
  return partirDocumento(markdown || '').every(estaTraducido);
}

export function pendientesDeTraduccion() {
  return [...pendientes.values()];
}
