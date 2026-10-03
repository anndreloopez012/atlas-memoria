import react from '@vitejs/plugin-react';
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import type { ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Connect, type Plugin, type ViteDevServer } from 'vite';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const DATOS = process.env.ATLAS_SALIDA || path.join(RAIZ, 'datos');
const OBSIDIAN = process.env.ATLAS_OBSIDIAN || path.join(os.homedir(), 'Documents/OBSIDIAN');
const GENERADOR = path.join(RAIZ, 'scripts/generar-datos.mjs');

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

const slug = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function generar(): Promise<{ ok: boolean; salida: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [GENERADOR], { cwd: RAIZ, env: process.env }, (error, stdout, stderr) => {
      resolve({ ok: !error, salida: (stdout || stderr || String(error || '')).trim() });
    });
  });
}

/**
 * Sirve los datos del atlas y los adjuntos de los vaults, regenera bajo pedido y,
 * en desarrollo, vigila los vaults para mantener el atlas sincronizado solo.
 */
function atlas(): Plugin {
  let generando: Promise<{ ok: boolean; salida: string }> | null = null;
  const regenerar = () => (generando ??= generar().finally(() => (generando = null)));

  const middlewares = (app: Connect.Server) => {
    app.use('/datos', (req, res) => {
      const rel = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
      const abs = dentroDe(DATOS, rel);
      if (!abs) {
        res.statusCode = 404;
        res.end('{"error":"sin datos: ejecuta npm run datos"}');
        return;
      }
      enviarArchivo(res, abs);
    });

    app.use('/adjunto', (req, res) => {
      const [vaultSlug, ...resto] = (req.url || '').split('?')[0].replace(/^\/+/, '').split('/');
      const vault = fs.existsSync(OBSIDIAN) ? fs.readdirSync(OBSIDIAN).find((v) => slug(v) === vaultSlug) : null;
      const abs = vault ? dentroDe(path.join(OBSIDIAN, vault), resto.map(decodeURIComponent).join('/')) : null;
      if (!abs) {
        res.statusCode = 404;
        res.end();
        return;
      }
      enviarArchivo(res, abs);
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

      // Sincronización en vivo: cualquier cambio en los vaults regenera el atlas
      // (con espera de 8 s para agrupar guardados) y avisa al navegador.
      if (process.env.ATLAS_VIGILAR === '0' || !fs.existsSync(OBSIDIAN)) return;
      let temporizador: NodeJS.Timeout | undefined;
      try {
        const vigia = fs.watch(OBSIDIAN, { recursive: true }, (_evento, archivo) => {
          const ruta = String(archivo || '');
          if (!ruta.endsWith('.md') || /(^|\/)(\.obsidian|\.git|\.memoria-system|Graphify)\//.test(ruta)) return;
          clearTimeout(temporizador);
          temporizador = setTimeout(async () => {
            const { ok, salida } = await regenerar();
            server.config.logger.info(`  atlas: ${ok ? 'datos actualizados' : 'error al regenerar'}`, { timestamp: true });
            if (!ok) server.config.logger.error(salida);
            server.ws.send({ type: 'custom', event: 'atlas:datos', data: { ok } });
          }, 8000);
        });
        server.httpServer?.on('close', () => vigia.close());
      } catch (error) {
        server.config.logger.warn(`  atlas: no se pudo vigilar ${OBSIDIAN}: ${String(error)}`);
      }
    },
    configurePreviewServer(server) {
      middlewares(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), atlas()],
  server: { port: 5190, strictPort: false },
  preview: { port: 5190 },
  build: { chunkSizeWarningLimit: 900 },
});
