// Enrutador por hash: cada vista tiene su URL, así funcionan atrás/adelante y los
// enlaces directos (#/v/programacion/<nota>, #/skills/web-inmersiva…).
import { useSyncExternalStore } from 'react';

export type Ruta =
  | { vista: 'universo' }
  | { vista: 'vault'; slug: string; nota: string | null; carpeta: string | null }
  | { vista: 'skills'; skill: string | null; categoria: string | null }
  | { vista: 'agentes'; agente: string }
  | { vista: 'sistema'; pestana: PestanaSistema };

/** Sistema junta cómo trabaja todo, los agentes y (más adelante) la salud. */
export type PestanaSistema = 'como' | 'agentes';

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
      return { vista: 'skills', skill: partes.slice(1).join('/') || null, categoria: params.get('categoria') };
    case 'agentes':
      // La lista de agentes vive en Sistema; la ficha de cada uno conserva su URL.
      return partes[1] ? { vista: 'agentes', agente: partes[1] } : { vista: 'sistema', pestana: 'agentes' };
    case 'sistema':
      return { vista: 'sistema', pestana: partes[1] === 'agentes' ? 'agentes' : 'como' };
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
