// Ayudas sobre el índice general que dependen de cada equipo (qué vault es el
// centro, cuál es cuál por nombre).
import type { Atlas, ResumenVault } from './tipos';

/** El vault central: del que nacen los demás. */
export const vaultCentral = (atlas: Atlas): ResumenVault | null => atlas.vaults.find((v) => v.slug === atlas.centro) ?? atlas.vaults[0] ?? null;

export const vaultPorNombre = (atlas: Atlas, nombre: string) => atlas.vaults.find((v) => v.nombre === nombre);

/** Ruta completa de una nota en el disco, con el separador del sistema del vault. */
export function rutaEnDisco(vault: ResumenVault, rel: string) {
  const sep = vault.ruta.includes('\\') ? '\\' : '/';
  return `${vault.ruta}${sep}${rel.split('/').join(sep)}`;
}
