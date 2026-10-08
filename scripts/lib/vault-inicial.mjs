// Vault inicial: para quien todavía no tiene ninguno. Copia instalador/vault-inicial
// (notas guía, plantillas y carpetas) a Documentos/«Mi memoria». Nunca sobrescribe:
// si ya existe una carpeta con ese nombre que no es el vault inicial, usa otro nombre.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLANTILLA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'instalador', 'vault-inicial');
const MARCA = 'Empieza aquí.md';

/** Carpeta donde se crea: Documentos (o la carpeta personal si no hay Documentos). */
function carpetaBase() {
  const documentos = path.join(os.homedir(), 'Documents');
  return fs.existsSync(documentos) ? documentos : os.homedir();
}

function copiar(origen, destino) {
  fs.mkdirSync(destino, { recursive: true });
  for (const e of fs.readdirSync(origen, { withFileTypes: true })) {
    if (e.name === '.gitkeep' || e.name === '.DS_Store') continue;
    const de = path.join(origen, e.name);
    const a = path.join(destino, e.name);
    if (e.isDirectory()) copiar(de, a);
    else if (!fs.existsSync(a)) fs.copyFileSync(de, a);
  }
}

/** Abre la carpeta en Obsidian (la registra como vault si hacía falta). */
export const enlaceObsidianCarpeta = (ruta) => `obsidian://open?path=${encodeURIComponent(ruta)}`;

/**
 * @param {{ nombre?: string, base?: string }} [opciones]
 * @returns {{ ruta: string, nombre: string, creado: boolean }}
 */
export function crearVaultInicial({ nombre = 'Mi memoria', base = carpetaBase() } = {}) {
  for (let k = 1; k < 50; k++) {
    const nombreFinal = k === 1 ? nombre : `${nombre} ${k}`;
    const ruta = path.join(base, nombreFinal);
    if (fs.existsSync(ruta)) {
      // Ya es el vault inicial (se creó antes): se reutiliza.
      if (fs.existsSync(path.join(ruta, MARCA)) && fs.existsSync(path.join(ruta, '.obsidian'))) return { ruta, nombre: nombreFinal, creado: false };
      continue;
    }
    copiar(PLANTILLA, ruta);
    return { ruta, nombre: nombreFinal, creado: true };
  }
  throw new Error(`No encontré un nombre libre para el vault en ${base}`);
}
