import react from '@vitejs/plugin-react';
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Connect, type Plugin, type ViteDevServer } from 'vite';
import { capturar, modoDeCaptura } from './scripts/lib/capturar.mjs';
import { armarPedido, fuentesPara, iasParaPreguntar, responder as responderIA } from './scripts/lib/preguntar.mjs';
import { marcarHecha } from './scripts/lib/tareas.mjs';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const DATOS = process.env.ATLAS_SALIDA ? path.resolve(process.env.ATLAS_SALIDA) : path.join(RAIZ, 'datos');
const ARCHIVO_CONFIG = process.env.ATLAS_CONFIG ? path.resolve(process.env.ATLAS_CONFIG) : path.join(RAIZ, 'atlas.config.json');
const GENERADOR = path.join(RAIZ, 'scripts/generar-datos.mjs');

interface ConfigLocal {
  puerto?: number;
  carpetasGeneradas?: string[];
  preguntar?: { ia?: string };
  captura?: { modo?: string; vault?: string; carpeta?: string };
}

function leerConfig(): ConfigLocal {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO_CONFIG, 'utf8'));
  } catch {
    return {};
  }
}

const PUERTO = Number(process.env.ATLAS_PUERTO || process.env.PORT || leerConfig().puerto || 5190);

const TIPOS: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
};

function enviarArchivo(res: ServerResponse, abs: string) {
  res.setHeader('Content-Type', TIPOS[path.extname(abs).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  fs.createReadStream(abs).pipe(res);
}

// Solo sirve archivos que estén dentro de `base` (sin escapar con ../).
function dentroDe(base: string, rel: string) {
  const abs = path.resolve(base, rel);
  return abs.startsWith(base + path.sep) && fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null;
}

// Rutas de los vaults de ESTE equipo, tal como quedaron en los datos generados.
let cacheVaults: { mtime: number; porSlug: Map<string, string> } = { mtime: -1, porSlug: new Map() };
function vaultsActuales(): Map<string, string> {
  const archivo = path.join(DATOS, 'atlas.json');
  try {
    const mtime = fs.statSync(archivo).mtimeMs;
    if (mtime !== cacheVaults.mtime) {
      const atlas = JSON.parse(fs.readFileSync(archivo, 'utf8')) as { vaults: { slug: string; ruta: string }[] };
      cacheVaults = { mtime, porSlug: new Map(atlas.vaults.filter((v) => v.ruta).map((v) => [v.slug, v.ruta])) };
    }
  } catch {
    /* todavía sin datos */
  }
  return cacheVaults.porSlug;
}

/** Vaults, centro y sistema de memoria de este equipo (de los datos generados). */
function contextoDeCaptura() {
  const atlas = JSON.parse(fs.readFileSync(path.join(DATOS, 'atlas.json'), 'utf8')) as {
    centro: string | null;
    vaults: { nombre: string; slug: string; ruta: string }[];
    sistema: { memoria: boolean };
  };
  return { vaults: atlas.vaults.filter((v) => v.ruta), centro: atlas.centro, memoria: atlas.sistema.memoria, config: leerConfig().captura ?? {} };
}

/** Lee el cuerpo JSON de una petición (hasta 64 KB). */
function leerJson(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let cuerpo = '';
    req.on('data', (trozo) => {
      cuerpo += trozo;
      if (cuerpo.length > 65_536) reject(new Error('demasiado grande'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(cuerpo || '{}'));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function responder(res: ServerResponse, estado: number, datos: unknown) {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(datos));
}

/** Marca una tarea como hecha en su nota (ver marcarHecha en scripts/lib/tareas.mjs). */
function marcarTarea(datos: Record<string, unknown>): { ok: boolean; error?: string } {
  const { s, r, l, h } = datos as { s?: string; r?: string; l?: number; h?: string };
  if (!s || !r || !l || !h || !r.endsWith('.md')) return { ok: false, error: 'Faltan datos de la tarea' };
  const raiz = vaultsActuales().get(s);
  const abs = raiz ? dentroDe(raiz, r) : null;
  if (!abs) return { ok: false, error: 'No encuentro la nota' };
  return marcarHecha(abs, Number(l), String(h));
}

/** Carpetas de skills y de agentes de este equipo (las detectadas, de los datos generados). */
function fuentesDeIAs(): { skills: string[]; agentes: string[] } {
  try {
    const atlas = JSON.parse(fs.readFileSync(path.join(DATOS, 'atlas.json'), 'utf8')) as { sistema: { fuentes: { skills: { ruta: string }[]; agentes: { ruta: string }[] } } };
    const expandir = (r: string) => (r.startsWith('~') ? path.join(os.homedir(), r.slice(1)) : r);
    const existentes = (lista: { ruta: string }[]) => [...new Set(lista.map((x) => expandir(x.ruta)))].filter((r) => fs.existsSync(r));
    return { skills: existentes(atlas.sistema.fuentes.skills), agentes: existentes(atlas.sistema.fuentes.agentes) };
  } catch {
    return { skills: [], agentes: [] };
  }
}

function generar(): Promise<{ ok: boolean; salida: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [GENERADOR], { cwd: RAIZ, env: process.env, maxBuffer: 10_000_000 }, (error, stdout, stderr) => {
      resolve({ ok: !error, salida: (stdout || stderr || String(error || '')).trim() });
    });
  });
}

/**
 * Sirve los datos del atlas y los adjuntos de los vaults, regenera bajo pedido y,
 * en desarrollo, vigila los vaults de este equipo para mantener el atlas al día.
 */
function atlas(): Plugin {
  let generando: Promise<{ ok: boolean; salida: string }> | null = null;
  // En desarrollo, avisa al navegador que hay datos nuevos (se define en configureServer).
  let avisarDatos: (() => void) | null = null;
  // Última vez que la página (o el lanzador) preguntó por el estado.
  let ultimaConsulta = Date.now();
  const regenerar = () => (generando ??= generar().finally(() => (generando = null)));

  const middlewares = (app: Connect.Server) => {
    app.use('/datos', (req, res) => {
      const rel = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
      const abs = dentroDe(DATOS, rel);
      if (!abs) {
        res.statusCode = 404;
        res.end('{"error":"sin datos: ejecuta npm run instalar"}');
        return;
      }
      enviarArchivo(res, abs);
    });

    app.use('/adjunto', (req, res) => {
      const [vaultSlug, ...resto] = (req.url || '').split('?')[0].replace(/^\/+/, '').split('/');
      const raiz = vaultsActuales().get(vaultSlug);
      const abs = raiz ? dentroDe(raiz, resto.map(decodeURIComponent).join('/')) : null;
      if (!abs) {
        res.statusCode = 404;
        res.end();
        return;
      }
      enviarArchivo(res, abs);
    });

    app.use('/__atlas/tarea', async (req, res) => {
      if (req.method !== 'POST') return responder(res, 405, { ok: false });
      try {
        const resultado = marcarTarea(await leerJson(req));
        responder(res, resultado.ok ? 200 : 409, resultado);
      } catch (error) {
        responder(res, 400, { ok: false, error: String(error) });
      }
    });

    // Preguntar a la memoria: GET dice qué IA respondería; POST responde.
    app.use('/__atlas/preguntar', async (req, res) => {
      const ias = iasParaPreguntar(leerConfig().preguntar?.ia ?? 'auto');
      if (req.method === 'GET') return responder(res, 200, { ia: ias[0]?.nombre ?? null });
      if (req.method !== 'POST') return responder(res, 405, { ok: false });
      try {
        const { pregunta } = (await leerJson(req)) as { pregunta?: string };
        const texto = String(pregunta ?? '').trim().slice(0, 500);
        if (texto.length < 3) return responder(res, 400, { ok: false, error: 'Escribe una pregunta' });
        const fuentes = fuentesPara(texto, DATOS);
        // A la página va la lista de fuentes, sin su texto.
        const lista = fuentes.map((f: Record<string, unknown>) => ({ ...f, texto: undefined }));
        if (!ias.length || !fuentes.length) return responder(res, 200, { ok: true, ia: ias[0]?.nombre ?? null, respuesta: null, fuentes: lista });
        const resultado = await responderIA(ias, armarPedido(texto, fuentes));
        responder(res, 200, { ok: true, ...resultado, fuentes: lista });
      } catch (error) {
        responder(res, 400, { ok: false, error: String(error) });
      }
    });

    // Capturar una idea: GET dice dónde quedaría; POST la guarda y vuelve a leer los datos.
    app.use('/__atlas/capturar', async (req, res) => {
      try {
        const contexto = contextoDeCaptura();
        if (req.method === 'GET') {
          const modo = modoDeCaptura(contexto);
          const central = contexto.vaults.find((v) => v.nombre === contexto.config.vault) ?? contexto.vaults.find((v) => v.slug === contexto.centro) ?? contexto.vaults[0];
          return responder(res, 200, { modo, destino: modo === 'memoria' ? 'la bandeja de capturas de tu sistema de memoria' : central ? `${central.nombre} / ${contexto.config.carpeta ?? 'Bandeja'}` : null });
        }
        if (req.method !== 'POST') return responder(res, 405, { ok: false });
        const cuerpo = (await leerJson(req)) as { texto?: string; titulo?: string };
        const resultado = capturar({ texto: String(cuerpo.texto ?? ''), titulo: cuerpo.titulo }, contexto);
        if (resultado.ok) void regenerar().then(() => avisarDatos?.());
        responder(res, resultado.ok ? 200 : 400, resultado);
      } catch (error) {
        responder(res, 400, { ok: false, error: String(error) });
      }
    });

    // Estado: cuándo se generaron los datos y si se están buscando cambios. La página
    // lo consulta cada pocos segundos (así se actualiza sola y mantiene viva la app).
    app.use('/__atlas/estado', (_req, res) => {
      ultimaConsulta = Date.now();
      let generado: string | null = null;
      try {
        generado = (JSON.parse(fs.readFileSync(path.join(DATOS, 'atlas.json'), 'utf8')) as { generado: string }).generado;
      } catch {
        /* todavía sin datos */
      }
      responder(res, 200, { atlas: true, generado, buscando: Boolean(generando) });
    });

    app.use('/__atlas/regenerar', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end();
        return;
      }
      const resultado = await regenerar();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(resultado));
    });
  };

  return {
    name: 'atlas-datos',
    configureServer(server: ViteDevServer) {
      if (!fs.existsSync(path.join(DATOS, 'atlas.json'))) {
        server.config.logger.info('  atlas: generando datos por primera vez…');
        execFileSync(process.execPath, [GENERADOR], { cwd: RAIZ, stdio: 'inherit' });
      }
      middlewares(server.middlewares);
      // En desarrollo el navegador se entera al instante por HMR; en producción lo
      // descubre consultando /__atlas/estado.
      avisarDatos = () => server.ws.send({ type: 'custom', event: 'atlas:datos', data: { ok: true } });
      if (process.env.ATLAS_VIGILAR !== '0') vigilar(server.config.logger, server.httpServer);
    },
    configurePreviewServer(server) {
      middlewares(server.middlewares);
      if (process.env.ATLAS_VIGILAR !== '0') vigilar(server.config.logger, server.httpServer);
      // Cada vez que se abre la app se buscan cambios (notas, skills, agentes) sin
      // hacer esperar: la página abre con los datos anteriores y se actualiza sola.
      if (process.env.ATLAS_BUSCAR_AL_ABRIR !== '0') void regenerar();
      // Abierta con doble clic, la app se apaga sola cuando nadie la usa.
      if (process.env.ATLAS_APAGAR_SIN_USO === '1') {
        const minutos = Number(process.env.ATLAS_MINUTOS_SIN_USO || 3);
        setInterval(() => {
          if (Date.now() - ultimaConsulta > minutos * 60_000) {
            server.config.logger.info('  atlas: nadie lo está usando; se apaga.');
            process.exit(0);
          }
        }, 30_000).unref();
      }
    },
  };

  /**
   * Sincronización en vivo: un cambio en cualquier vault, en las carpetas de skills
   * y agentes (o en la configuración) regenera el atlas tras 8 s sin cambios y avisa
   * al navegador. Funciona igual en desarrollo y en la app (vite preview).
   */
  function vigilar(logger: { info: (m: string, o?: { timestamp?: boolean }) => void; warn: (m: string) => void; error: (m: string) => void }, httpServer: { on: (e: 'close', f: () => void) => void } | null) {
    let temporizador: NodeJS.Timeout | undefined;
    let vigias: fs.FSWatcher[] = [];
    let vigilados = '';
    const avisar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(async () => {
        const { ok, salida } = await regenerar();
        logger.info(`  atlas: ${ok ? 'datos actualizados' : 'error al regenerar'}`, { timestamp: true });
        if (!ok) logger.error(salida);
        avisarDatos?.();
        armar();
      }, 8000);
    };
    const mirar = (ruta: string, sirve: (rel: string) => boolean) => {
      try {
        vigias.push(
          fs.watch(ruta, { recursive: true }, (_evento, archivo) => {
            const rel = String(archivo || '').split(path.sep).join('/');
            if (/(^|\/)(node_modules|\.git)(\/|$)/.test(rel) || !sirve(rel)) return;
            avisar();
          }),
        );
      } catch (error) {
        logger.warn(`  atlas: no se pudo vigilar ${ruta}: ${String(error)}`);
      }
    };
    const armar = () => {
      const rutas = [...vaultsActuales().values()];
      const ias = fuentesDeIAs();
      const clave = [...rutas, ...ias.skills, ...ias.agentes].join('|');
      if (clave === vigilados) return;
      vigias.forEach((v) => v.close());
      vigias = [];
      vigilados = clave;
      const generadas = new Set(leerConfig().carpetasGeneradas || ['Graphify']);
      // Notas: cualquier .md fuera de carpetas ocultas y de las que generan herramientas.
      for (const ruta of rutas) {
        mirar(ruta, (rel) => {
          const primera = rel.split('/')[0];
          return rel.endsWith('.md') && !primera.startsWith('.') && !(generadas.has(primera) && rel.includes('/'));
        });
      }
      // Skills: un SKILL.md nuevo, editado o borrado (o una carpeta nueva). Agentes: un .md.
      for (const ruta of ias.skills) mirar(ruta, (rel) => /(^|\/)SKILL\.md$/.test(rel) || !rel.includes('/'));
      for (const ruta of ias.agentes) mirar(ruta, (rel) => rel.endsWith('.md'));
    };
    armar();
    fs.watchFile(ARCHIVO_CONFIG, { interval: 2000 }, avisar);
    httpServer?.on('close', () => {
      vigias.forEach((v) => v.close());
      fs.unwatchFile(ARCHIVO_CONFIG);
    });
  }
}

export default defineConfig({
  plugins: [react(), atlas()],
  server: { port: PUERTO, strictPort: false },
  preview: { port: PUERTO },
  build: { chunkSizeWarningLimit: 900 },
});
