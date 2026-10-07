// Capturar una idea desde el atlas. Dos formas, según el equipo:
// - con un sistema de memoria que tenga `memoria capturar`, se usa ese comando (lo
//   clasifica y lo deja en su bandeja);
// - si no, se escribe una nota nueva en la carpeta de capturas del vault central
//   («Bandeja» por defecto; `captura.vault` y `captura.carpeta` lo cambian).
// Siempre se dice dónde quedó y se ofrece abrirla en Obsidian.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_TEXTO = 20_000;

function enRuta(comando) {
  const extensiones = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of extensiones) {
      try {
        if (fs.statSync(path.join(dir, comando + ext)).isFile()) return path.join(dir, comando + ext);
      } catch {
        /* no está aquí */
      }
    }
  }
  return null;
}

/** Mismo id que usa el generador para las notas (sha1 de «VAULT/ruta», 10 caracteres). */
const idDe = (vault, rel) => crypto.createHash('sha1').update(`${vault}/${rel}`.normalize('NFC')).digest('hex').slice(0, 10);

const enlaceObsidian = (vault, rel) => `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(rel.replace(/\.md$/, ''))}`;

const nombreSeguro = (t) =>
  t
    .replace(/[\\/:*?"<>|#^[\]\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim() || 'captura';

/** Cómo se capturará en este equipo (para decirlo antes de hacerlo). */
export function modoDeCaptura({ config = {}, memoria = false }) {
  const modo = config.modo ?? 'auto';
  if (modo !== 'archivo' && memoria && enRuta('memoria')) return 'memoria';
  return 'archivo';
}

/**
 * @param {{ texto: string, titulo?: string }} pedido
 * @param {{ vaults: { nombre: string, slug: string, ruta: string }[], centro: string | null, config?: { modo?: string, vault?: string, carpeta?: string }, memoria?: boolean }} contexto
 */
export function capturar({ texto, titulo }, contexto) {
  const limpio = String(texto ?? '').trim().slice(0, MAX_TEXTO);
  if (limpio.length < 2) return { ok: false, error: 'Escribe algo para capturar' };
  const nombreTitulo = String(titulo ?? '').trim() || limpio.split('\n')[0].split(/\s+/).slice(0, 10).join(' ');
  const ubicar = (abs) => {
    const v = contexto.vaults.find((x) => abs.startsWith(x.ruta + path.sep));
    if (!v) return null;
    const rel = path.relative(v.ruta, abs).split(path.sep).join('/').normalize('NFC');
    return { vault: v.nombre, slug: v.slug, rel, id: idDe(v.nombre, rel), obsidian: enlaceObsidian(v.nombre, rel) };
  };

  if (modoDeCaptura(contexto) === 'memoria') {
    const r = spawnSync(enRuta('memoria'), ['capturar', '--texto', limpio, ...(titulo ? ['--titulo', nombreTitulo] : [])], { encoding: 'utf8', timeout: 60_000 });
    const salida = `${r.stdout || ''}`.trim().split('\n').pop() || '';
    if (r.status !== 0) return { ok: false, error: (r.stderr || r.stdout || 'memoria capturar falló').trim().split('\n').pop() };
    const duplicada = salida.startsWith('Captura duplicada:');
    const ruta = salida.replace(/^Captura duplicada:\s*/, '');
    const raizVaults = path.dirname(contexto.vaults[0]?.ruta ?? '');
    const lugar = ubicar(path.isAbsolute(ruta) ? ruta : path.join(raizVaults, ruta));
    return { ok: true, via: 'memoria', duplicada, ...(lugar ?? { rel: ruta }) };
  }

  // Nota nueva en la carpeta de capturas del vault elegido (o el central).
  const v = contexto.vaults.find((x) => x.nombre === contexto.config?.vault) ?? contexto.vaults.find((x) => x.slug === contexto.centro) ?? contexto.vaults[0];
  if (!v) return { ok: false, error: 'No hay vaults donde guardar la captura' };
  const carpeta = path.join(v.ruta, nombreSeguro(contexto.config?.carpeta ?? 'Bandeja'));
  const ahora = new Date();
  const fecha = ahora.toISOString().slice(0, 10);
  const hora = `${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}`;
  let abs = path.join(carpeta, `${fecha} ${hora} - ${nombreSeguro(nombreTitulo)}.md`);
  for (let k = 2; fs.existsSync(abs); k++) abs = path.join(carpeta, `${fecha} ${hora} - ${nombreSeguro(nombreTitulo)} ${k}.md`);
  if (!abs.startsWith(v.ruta + path.sep)) return { ok: false, error: 'Ruta de captura no válida' };
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(abs, `---\ntipo: captura\nfecha: ${fecha}\norigen: atlas\ntags:\n  - captura\n---\n\n# ${nombreTitulo.replace(/\n/g, ' ')}\n\n${limpio}\n`);
  return { ok: true, via: 'archivo', duplicada: false, ...ubicar(abs) };
}
