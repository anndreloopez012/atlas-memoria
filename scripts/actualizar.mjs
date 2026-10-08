#!/usr/bin/env node
// Busca si hay una versión nueva del atlas en GitHub y la instala sobre esta copia
// (sin tocar tu configuración, tus datos ni tus vaults). La app de doble clic lo
// ofrece sola al abrirse; esto es lo mismo desde la terminal.
//
//   npm run actualizar              instala la versión nueva si la hay
//   npm run actualizar -- --buscar  solo dice si hay una
//   --json                          resultado en JSON (para una IA)
import { aplicarActualizacion, buscarActualizacion } from './lib/actualizacion.mjs';

const comoJSON = process.argv.includes('--json');
const salir = (datos, codigo = 0) => {
  if (comoJSON) console.log(JSON.stringify(datos, null, 2));
  process.exit(codigo);
};
const log = (m) => !comoJSON && console.log(m);

const r = await buscarActualizacion({ forzar: true });
if (r.error) {
  log(r.error);
  salir(r, 1);
}
if (!r.nueva) {
  log(`Tienes la última versión (${r.actual}).`);
  salir(r);
}
log(`Hay una versión nueva: ${r.nueva.version} (tienes ${r.actual}). ${r.nueva.url}`);
if (process.argv.includes('--buscar')) salir(r);
if (r.git) {
  log('Esta copia es un repositorio git: actualízala con  git pull  y luego  npm install.');
  salir(r);
}
const hecho = await aplicarActualizacion(r.nueva, log);
if (!hecho.ok) {
  log(`No se pudo actualizar: ${hecho.error}`);
  salir(hecho, 1);
}
log(`Listo: el atlas quedó en la versión ${hecho.version}. Ciérralo y vuelve a abrirlo para usarla.`);
salir(hecho);
