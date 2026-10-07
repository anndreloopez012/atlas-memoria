// Enrutador por hash: cada vista tiene su URL, así funcionan atrás/adelante y los
// enlaces directos (#/v/programacion/<nota>, #/skills/web-inmersiva…).
import { useSyncExternalStore } from 'react';

export type Ruta =
  | { vista: 'universo' }
  | { vista: 'hoy'; seccion: SeccionHoy }
  | { vista: 'vault'; slug: string; nota: string | null; carpeta: string | null }
  | { vista: 'skills'; skill: string | null; categoria: string | null; uso: 'usadas' | 'nunca' | null }
  | { vista: 'agentes'; agente: string }
  | { vista: 'sistema'; pestana: PestanaSistema };

/** Vistas completas dentro de Hoy (la portada de Hoy es `null`). */
export type SeccionHoy = 'tareas' | 'proyectos' | null;

/** Sistema junta cómo trabaja todo, los agentes y la salud de la memoria. */
export type PestanaSistema = 'como' | 'agentes' | 'salud';

function leer(): Ruta {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [ruta, consulta = ''] = hash.split('?');
  const partes = ruta
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  const params = new URLSearchParams(consulta);
  switch (partes[0]) {
    case 'v':
      // Sin vault en la URL se abre el central (lo resuelve la pantalla con los datos).
      return { vista: 'vault', slug: partes[1] || '', nota: partes[2] || null, carpeta: params.get('carpeta') };
    case 'skills':
      return {
        vista: 'skills',
        skill: partes.slice(1).join('/') || null,
        categoria: params.get('categoria'),
        uso: params.get('uso') === 'nunca' || params.get('uso') === 'usadas' ? (params.get('uso') as 'nunca' | 'usadas') : null,
      };
    case 'agentes':
      // La lista de agentes vive en Sistema; la ficha de cada uno conserva su URL.
      return partes[1] ? { vista: 'agentes', agente: partes[1] } : { vista: 'sistema', pestana: 'agentes' };
    case 'hoy':
      return { vista: 'hoy', seccion: partes[1] === 'tareas' || partes[1] === 'proyectos' ? partes[1] : null };
    case 'sistema':
      return { vista: 'sistema', pestana: partes[1] === 'agentes' || partes[1] === 'salud' ? partes[1] : 'como' };
    default:
      return { vista: 'universo' };
  }
}

let actual = leer();
let hashActual = window.location.hash;
const oyentes = new Set<() => void>();
window.addEventListener('hashchange', () => {
  if (window.location.hash === hashActual) return;
  hashActual = window.location.hash;
  actual = leer();
  oyentes.forEach((f) => f());
});

export function useRuta(): Ruta {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => actual,
  );
}

export const rutaVault = (slug: string, nota?: string | null, carpeta?: string | null) =>
  `#/v/${slug}${nota ? `/${nota}` : ''}${carpeta ? `?carpeta=${encodeURIComponent(carpeta)}` : ''}`;
export const rutaSkill = (nombre: string) => `#/skills/${encodeURIComponent(nombre)}`;
export const rutaAgente = (id: string) => `#/agentes/${encodeURIComponent(id)}`;
export const rutaSistema = (pestana: PestanaSistema = 'como') => (pestana === 'como' ? '#/sistema' : `#/sistema/${pestana}`);

export function navegar(hash: string) {
  if (window.location.hash !== hash) window.location.hash = hash;
}
