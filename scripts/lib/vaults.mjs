// Lee los vaults de Obsidian: notas, carpetas, enlaces internos y puentes entre vaults.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.mjs';
import {
  contarPalabras,
  encabezados,
  enlaces,
  etiquetasEnLinea,
  extracto,
  frontmatterCompacto,
  idCorto,
  nfc,
  ocultarSecretos,
  separarFrontmatter,
} from './texto.mjs';

const ORDEN_POR_DEFECTO = ['CORE', 'PROGRAMACION', 'MARKETING', 'TALLERES IA', 'GENERAL', 'PERSONAL (YO)'];

export function leerRegistroVaults() {
  const archivo = path.join(CONFIG.obsidian, '.memoria-system/config/vaults.json');
  if (fs.existsSync(archivo)) {
    const registro = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    return { vaults: registro.vaults || [], routing: registro.routing || [], obsidian: registro.obsidian || {} };
  }
  // Sin registro: cada carpeta del contenedor que tenga .obsidian es un vault.
  const vaults = fs
    .readdirSync(CONFIG.obsidian, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(CONFIG.obsidian, d.name, '.obsidian')))
    .map((d) => ({ name: d.name }))
    .sort((a, b) => ORDEN_POR_DEFECTO.indexOf(a.name) - ORDEN_POR_DEFECTO.indexOf(b.name));
  return { vaults, routing: [], obsidian: {} };
}

// Graphify deja dentro de cada vault una carpeta con miles de notas generadas
// (una por archivo de código). Se cuentan, pero no se cargan.
function esGenerado(rel) {
  const partes = rel.split('/');
  if (partes[0] !== 'Graphify') return false;
  if (partes.length > 2) return true;
  return partes[1]?.startsWith('_COMMUNITY_') ?? false;
}

function recorrer(dirVault) {
  const notas = [];
  const adjuntos = [];
  let generados = 0;
  const pila = [''];
  while (pila.length) {
    const rel = pila.pop();
    let entradas;
    try {
      entradas = fs.readdirSync(path.join(dirVault, rel), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entradas) {
      if (CONFIG.ignorar.has(e.name) || e.name.startsWith('.')) continue;
      const relHijo = nfc(rel ? `${rel}/${e.name}` : e.name);
      if (e.isDirectory()) {
        if (relHijo.split('/')[0] === 'Graphify' && relHijo.includes('/')) {
          generados += contarMd(path.join(dirVault, relHijo));
          continue;
        }
        pila.push(relHijo);
      } else if (e.name.endsWith('.md')) {
        if (esGenerado(relHijo)) generados += 1;
        else notas.push(relHijo);
      } else if (e.isFile()) {
        adjuntos.push(relHijo);
      }
    }
  }
  return { notas: notas.sort((a, b) => a.localeCompare(b, 'es')), adjuntos, generados };
}

function contarMd(dir) {
  let total = 0;
  const pila = [dir];
  while (pila.length) {
    const actual = pila.pop();
    let entradas;
    try {
      entradas = fs.readdirSync(actual, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entradas) {
      if (e.isDirectory()) pila.push(path.join(actual, e.name));
      else if (e.name.endsWith('.md')) total += 1;
    }
  }
  return total;
}

function arbolCarpetas(notas, adjuntos) {
  const raiz = { n: '', p: '', d: 0, t: 0, a: 0, h: [] };
  const indice = new Map([['', raiz]]);
  const asegurar = (ruta) => {
    if (indice.has(ruta)) return indice.get(ruta);
    const padreRuta = ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '';
    const padre = asegurar(padreRuta);
    const nodo = { n: ruta.split('/').pop(), p: ruta, d: 0, t: 0, a: 0, h: [] };
    padre.h.push(nodo);
    indice.set(ruta, nodo);
    return nodo;
  };
  for (const nota of notas) {
    const carpeta = nota.f;
    asegurar(carpeta).d += 1;
    let ruta = carpeta;
    while (true) {
      indice.get(ruta).t += 1;
      if (ruta === '') break;
      ruta = ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '';
    }
  }
  for (const adj of adjuntos) {
    const carpeta = adj.includes('/') ? adj.slice(0, adj.lastIndexOf('/')) : '';
    if (indice.has(carpeta)) indice.get(carpeta).a += 1;
  }
  const ordenar = (nodo) => {
    nodo.h.sort((a, b) => b.t - a.t || a.n.localeCompare(b.n, 'es'));
    nodo.h.forEach(ordenar);
  };
  ordenar(raiz);
  return raiz;
}

const IMAGEN = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
const escaparTexto = (t) => t.replace(/([\[\]])/g, '\\$1');

function vaultSlug(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function reescribirEnlaces(markdown, nota, resolver, adjuntos) {
  // No se toca el código: se separa en trozos de código y de texto.
  const trozos = markdown.split(/((?:```|~~~)[\s\S]*?(?:```|~~~)|`[^`\n]*`)/g);
  return trozos
    .map((trozo, i) => {
      if (i % 2 === 1) return trozo;
      let t = trozo.replace(/(!?)\[\[([^\]|#^]*)([#^][^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_, embebido, destino, ancla, alias) => {
        // En tablas Obsidian escribe [[nota\\|alias]]: la barra invertida no es parte del nombre.
        const objetivo = destino.trim().replace(/\\$/, '');
        const etiqueta = (alias || '').trim();
        const nombre = objetivo.split('/').pop();
        const extension = nombre.includes('.') ? nombre.split('.').pop().toLowerCase() : 'md';
        if (extension !== 'md' && nombre.includes('.')) {
          const rel = adjuntos?.get(nombre.toLowerCase());
          if (rel && IMAGEN.test(nombre)) {
            return `![${escaparTexto(etiqueta || nombre)}](/adjunto/${vaultSlug(nota.v)}/${rel.split('/').map(encodeURIComponent).join('/')})`;
          }
          if (rel) return `[${escaparTexto(etiqueta || nombre)}](/adjunto/${vaultSlug(nota.v)}/${rel.split('/').map(encodeURIComponent).join('/')})`;
          return `\`${nombre}\``;
        }
        if (!objetivo) return etiqueta || (ancla ? ancla.slice(1) : '');
        const n = resolver(nota.v, objetivo, nota.f);
        const texto = escaparTexto(etiqueta || (n ? n.t : nombre) + (ancla && !etiqueta ? ` › ${ancla.slice(1)}` : ''));
        const prefijo = embebido ? 'Incrustado: ' : '';
        return n ? `[${prefijo}${texto}](atlas:${n.id})` : `[${prefijo}${texto}](atlas-roto:${encodeURIComponent(objetivo)})`;
      });
      t = t.replace(/\]\((obsidian:\/\/[^)\s]+)\)/g, (completo, url) => {
        try {
          const u = new URL(url);
          const n = resolver(nfc(u.searchParams.get('vault') || ''), nfc(u.searchParams.get('file') || ''));
          return n ? `](atlas:${n.id})` : completo;
        } catch {
          return completo;
        }
      });
      t = t.replace(/\]\(((?![a-z]+:)[^)\s]+\.md)(#[^)\s]*)?\)/gi, (completo, ruta) => {
        const n = resolver(nota.v, decodeURIComponent(ruta), nota.f);
        return n ? `](atlas:${n.id})` : completo;
      });
      return t;
    })
    .join('');
}

export function leerVaults(contadorSecretos) {
  const { vaults: registro, routing, obsidian } = leerRegistroVaults();
  const vaults = [];
  const todas = []; // notas de todos los vaults, para resolver puentes
  const porVault = new Map();

  for (const info of registro) {
    const dirVault = path.join(CONFIG.obsidian, info.name);
    if (!fs.existsSync(dirVault)) continue;
    const { notas: rutas, adjuntos, generados } = recorrer(dirVault);
    const notas = [];
    for (const rel of rutas) {
      const abs = path.join(dirVault, rel);
      let crudo;
      let stat;
      try {
        crudo = fs.readFileSync(abs, 'utf8');
        stat = fs.statSync(abs);
      } catch {
        continue;
      }
      const limpio = ocultarSecretos(crudo, contadorSecretos);
      const { fm, cuerpo } = separarFrontmatter(limpio);
      const nombre = rel.split('/').pop().replace(/\.md$/, '');
      const f = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
      const etiquetas = new Set([
        ...(Array.isArray(fm.tags) ? fm.tags : typeof fm.tags === 'string' ? fm.tags.split(/[,\s]+/) : []).map(String),
        ...etiquetasEnLinea(cuerpo),
      ]);
      etiquetas.delete('');
      const contenido =
        cuerpo.length > CONFIG.maxBytesNota
          ? `${cuerpo.slice(0, CONFIG.maxBytesNota)}\n\n> [!warning] Nota recortada\n> Esta nota pesa ${(cuerpo.length / 1024).toFixed(0)} KB; el atlas muestra los primeros ${CONFIG.maxBytesNota / 1000} KB. Ábrela en Obsidian para verla completa.`
          : cuerpo;
      notas.push({
        id: idCorto(`${info.name}/${rel}`),
        v: info.name,
        r: rel,
        t: typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : nombre,
        nb: nombre,
        f,
        tg: [...etiquetas].slice(0, 16),
        fm: frontmatterCompacto(fm),
        h: encabezados(cuerpo),
        ex: extracto(cuerpo),
        w: contarPalabras(cuerpo),
        m: stat.mtime.toISOString(),
        xb: [],
        _enlaces: enlaces(cuerpo),
        _contenido: contenido,
        _texto: limpio,
      });
    }
    porVault.set(info.name, notas);
    todas.push(...notas);
    vaults.push({ info, notas, adjuntos, generados, dirVault });
  }

  // Resolución de enlaces al estilo Obsidian: ruta exacta, luego final de ruta,
  // luego nombre de archivo (gana la ruta más corta).
  const indices = new Map();
  for (const [vault, notas] of porVault) {
    const porRuta = new Map();
    const porNombre = new Map();
    for (const n of notas) {
      porRuta.set(n.r.replace(/\.md$/, '').toLowerCase(), n);
      const clave = n.nb.toLowerCase();
      if (!porNombre.has(clave)) porNombre.set(clave, []);
      porNombre.get(clave).push(n);
    }
    for (const lista of porNombre.values()) lista.sort((a, b) => a.r.length - b.r.length);
    indices.set(vault, { porRuta, porNombre, notas });
  }

  const resolver = (vault, destino, desdeCarpeta = '') => {
    const idx = indices.get(vault);
    if (!idx) return null;
    let d = nfc(destino).replace(/\\/g, '/').replace(/\.md$/i, '').replace(/^\.?\//, '').trim().toLowerCase();
    if (!d) return null;
    if (d.startsWith('../') && desdeCarpeta) {
      d = path.posix.normalize(`${desdeCarpeta.toLowerCase()}/${d}`);
    }
    if (idx.porRuta.has(d)) return idx.porRuta.get(d);
    if (desdeCarpeta && idx.porRuta.has(`${desdeCarpeta.toLowerCase()}/${d}`)) {
      return idx.porRuta.get(`${desdeCarpeta.toLowerCase()}/${d}`);
    }
    if (d.includes('/')) {
      for (const [ruta, nota] of idx.porRuta) if (ruta.endsWith(`/${d}`)) return nota;
    }
    const nombre = d.split('/').pop();
    return idx.porNombre.get(nombre)?.[0] || null;
  };

  const puentes = new Map();
  let totalEnlaces = 0;
  let sinResolver = 0;
  for (const nota of todas) {
    const salida = new Set();
    const cruces = new Set();
    const { wiki, obsidian: obs, relativos } = nota._enlaces;
    for (const destino of wiki) {
      const n = resolver(nota.v, destino, nota.f);
      if (n && n.id !== nota.id) salida.add(n.id);
      else if (!n) sinResolver += 1;
    }
    for (const destino of relativos) {
      const n = resolver(nota.v, destino, nota.f);
      if (n && n.id !== nota.id) salida.add(n.id);
    }
    for (const { vault, file } of obs) {
      const n = resolver(vault, file);
      if (!n || n.id === nota.id) continue;
      if (n.v === nota.v) salida.add(n.id);
      else {
        cruces.add(n.id);
        const clave = [nota.v, n.v].join('→');
        puentes.set(clave, (puentes.get(clave) || 0) + 1);
      }
    }
    nota.o = [...salida];
    nota.x = [...cruces];
    totalEnlaces += salida.size + cruces.size;
  }

  // Entrantes desde otros vaults (para mostrar «quién me cita» en el lector).
  const porId = new Map(todas.map((n) => [n.id, n]));
  for (const nota of todas) for (const destino of nota.x) porId.get(destino)?.xb.push(nota.id);

  // Los enlaces del contenido se reescriben a atlas:<id> para navegar dentro del
  // atlas; los adjuntos de imagen se sirven desde el vault con /adjunto/.
  const adjuntosPorVault = new Map();
  for (const { info, adjuntos } of vaults) {
    const mapa = new Map();
    for (const rel of adjuntos) {
      const clave = rel.split('/').pop().toLowerCase();
      if (!mapa.has(clave)) mapa.set(clave, rel);
    }
    adjuntosPorVault.set(info.name, mapa);
  }
  for (const nota of todas) {
    nota._contenido = reescribirEnlaces(nota._contenido, nota, resolver, adjuntosPorVault.get(nota.v));
  }

  return { vaults, todas, puentes, totalEnlaces, sinResolver, routing, obsidian, arbolCarpetas };
}
