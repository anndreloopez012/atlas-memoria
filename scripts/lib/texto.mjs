// Utilidades de texto compartidas: frontmatter, enlaces, encabezados, extracto y
// ocultado de secretos.
import crypto from 'node:crypto';
import YAML from 'yaml';

export const idCorto = (texto) => crypto.createHash('sha1').update(texto).digest('hex').slice(0, 10);

export const nfc = (texto) => texto.normalize('NFC');

// --- Secretos -----------------------------------------------------------------
// Los vaults no deberían tener secretos, pero si alguno se coló no debe llegar al
// navegador. Cada coincidencia se reemplaza por «[oculto]» y se cuenta.
const PATRONES_SECRETOS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/g,
  /\bwhsec_[A-Za-z0-9]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}\b/g,
  /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\b/g,
  // clave = valor. Se ignoran valores que son código (process.env.X, z.string(), req.body…).
  /((?:api[_-]?key|secret|token|password|passwd|contrase[ñn]a)\s*[:=]\s*["']?)(?!process\.env|import\.meta|os\.environ|z\.|req\.|this\.|await\b|env\()([^\s"'`(),;]{8,})/gi,
];

export function ocultarSecretos(texto, contador) {
  let salida = texto;
  for (const patron of PATRONES_SECRETOS) {
    salida = salida.replace(patron, (coincidencia, prefijo, valor) => {
      contador.total += 1;
      // En el patrón clave=valor se conserva el nombre de la clave.
      if (typeof valor === 'string' && typeof prefijo === 'string') return `${prefijo}[oculto]`;
      return '[oculto]';
    });
  }
  return salida;
}

// --- Frontmatter --------------------------------------------------------------
export function separarFrontmatter(texto) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: {}, cuerpo: texto };
  let fm = {};
  try {
    fm = YAML.parse(m[1], { logLevel: 'error' }) || {};
    if (typeof fm !== 'object' || Array.isArray(fm)) fm = {};
  } catch {
    // YAML estricto rechaza «description: Hace X: Y» sin comillas; las IAs lo aceptan.
    fm = frontmatterTolerante(m[1]);
  }
  return { fm, cuerpo: texto.slice(m[0].length) };
}

function frontmatterTolerante(fuente) {
  const fm = {};
  let clave = null;
  let bloque = [];
  const cerrar = () => {
    if (clave && bloque.length) fm[clave] = bloque.every((l) => l.startsWith('- ')) ? bloque.map((l) => l.slice(2).trim()) : bloque.join(' ');
    clave = null;
    bloque = [];
  };
  for (const linea of fuente.split(/\r?\n/)) {
    const m = linea.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) {
      cerrar();
      const valor = m[2].trim();
      if (valor === '' || /^[>|][+-]?$/.test(valor)) clave = m[1];
      else fm[m[1]] = valor.replace(/^(["'])(.*)\1$/, '$2');
    } else if (clave && /^\s+\S/.test(linea)) {
      bloque.push(linea.trim());
    }
  }
  cerrar();
  return fm;
}

// Solo se conservan valores cortos del frontmatter: lo largo ya está en el cuerpo.
export function frontmatterCompacto(fm) {
  const salida = {};
  for (const [clave, valor] of Object.entries(fm)) {
    if (valor == null) continue;
    if (['string', 'number', 'boolean'].includes(typeof valor)) {
      const texto = String(valor);
      if (texto.length <= 160) salida[clave] = valor;
    } else if (valor instanceof Date) {
      salida[clave] = valor.toISOString().slice(0, 10);
    } else if (Array.isArray(valor) && valor.length <= 12 && valor.every((v) => typeof v !== 'object')) {
      salida[clave] = valor.map(String);
    }
  }
  return salida;
}

// --- Estructura del markdown --------------------------------------------------
export const sinBloquesDeCodigo = (texto) => texto.replace(/(```|~~~)[\s\S]*?\1/g, ' ');

export function encabezados(cuerpo, maxNivel = 3, limite = 40) {
  const salida = [];
  for (const linea of sinBloquesDeCodigo(cuerpo).split('\n')) {
    const m = linea.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m && m[1].length <= maxNivel) {
      salida.push({ n: m[1].length, t: limpiarEnLinea(m[2]) });
      if (salida.length >= limite) break;
    }
  }
  return salida;
}

export function limpiarEnLinea(texto) {
  return texto
    .replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/!?\[\[([^\]]+)\]\]/g, (_, t) => t.split('#')[0].split('/').pop())
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function extracto(cuerpo, largo = 240) {
  const lineas = sinBloquesDeCodigo(cuerpo)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^#{1,6}\s/.test(l) && !/^>\s*\[!/.test(l) && !/^\|?\s*-{3,}/.test(l) && !/^!\[\[/.test(l))
    .map((l) => limpiarEnLinea(l.replace(/^>\s?/, '').replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').replace(/\|/g, ' ')));
  const texto = lineas.join(' ').replace(/\s+/g, ' ').trim();
  return texto.length > largo ? `${texto.slice(0, largo - 1).trimEnd()}…` : texto;
}

export function contarPalabras(cuerpo) {
  const m = sinBloquesDeCodigo(cuerpo).match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

export function etiquetasEnLinea(cuerpo) {
  const salida = new Set();
  const texto = sinBloquesDeCodigo(cuerpo).replace(/`[^`]*`/g, ' ');
  for (const m of texto.matchAll(/(?:^|[\s(])#([\p{L}_][\p{L}\p{N}_/-]{1,40})/gu)) salida.add(m[1]);
  return [...salida];
}

// Devuelve los destinos de [[wikilinks]], enlaces markdown a .md y obsidian://open.
export function enlaces(cuerpo) {
  const texto = sinBloquesDeCodigo(cuerpo).replace(/`[^`\n]*`/g, ' ');
  const wiki = [];
  for (const m of texto.matchAll(/!?\[\[([^\]|#^]*)(?:[#^][^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
    const destino = m[1].trim().replace(/\\$/, '');
    if (destino) wiki.push(destino);
  }
  const obsidian = [];
  const relativos = [];
  for (const m of texto.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const url = m[1];
    if (url.startsWith('obsidian://')) {
      try {
        const u = new URL(url);
        const vault = u.searchParams.get('vault');
        const file = u.searchParams.get('file');
        if (vault && file) obsidian.push({ vault: nfc(vault), file: nfc(file) });
      } catch {
        /* enlace mal formado: se ignora */
      }
    } else if (!/^[a-z]+:/i.test(url) && /\.md(#.*)?$/i.test(decodeSeguro(url))) {
      relativos.push(decodeSeguro(url).replace(/#.*$/, ''));
    }
  }
  return { wiki, obsidian, relativos };
}

export function decodeSeguro(texto) {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

/** Fecha de creación de un archivo si el sistema la conoce (birthtime); si no, null. */
export function creado(stat) {
  return stat.birthtimeMs > 0 ? new Date(stat.birthtimeMs).toISOString() : null;
}
