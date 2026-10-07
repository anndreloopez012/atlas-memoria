// Favoritos: notas, skills y agentes que marcas con la estrella. Viven en este
// navegador (localStorage) y se avisan entre componentes, así la estrella, Hoy y el
// centro de mando siempre coinciden. Sin almacenamiento, duran lo que la pestaña.
import { useSyncExternalStore } from 'react';
import type { Reciente } from './recientes';

export type Favorito = Reciente;

const CLAVE = 'atlas-favoritos';
const oyentes = new Set<() => void>();

function leer(): Favorito[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

let actuales = leer();

function guardar(lista: Favorito[]) {
  actuales = lista;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* sin almacenamiento: quedan en memoria */
  }
  oyentes.forEach((f) => f());
}

// Otra pestaña cambió los favoritos.
window.addEventListener('storage', (e) => {
  if (e.key !== CLAVE) return;
  actuales = leer();
  oyentes.forEach((f) => f());
});

export function useFavoritos(): Favorito[] {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => actuales,
  );
}

export const esFavorito = (lista: Favorito[], tipo: Favorito['tipo'], id: string) => lista.some((x) => x.tipo === tipo && x.id === id);

export function alternarFavorito(f: Favorito) {
  const sin = actuales.filter((x) => !(x.tipo === f.tipo && x.id === f.id));
  guardar(sin.length === actuales.length ? [f, ...actuales] : sin);
}
