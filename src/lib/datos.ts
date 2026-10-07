// Carga perezosa de los datos del atlas con caché. Cada archivo se pide una sola
// vez; `recargarDatos()` vacía la caché y avisa a los componentes.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Agente, Atlas, DatosProyectos, DatosSalud, DatosSkills, DatosTareas, DatosVault, DetalleSkill, Recientes, Tarea } from './tipos';

const cache = new Map<string, Promise<unknown>>();
let version = 0;
const oyentes = new Set<() => void>();

function pedir<T>(ruta: string): Promise<T> {
  if (!cache.has(ruta)) {
    const promesa = fetch(`/datos/${ruta}?v=${version}`).then(async (r) => {
      if (!r.ok) throw new Error(`No se pudo leer ${ruta} (${r.status}). Ejecuta npm run instalar.`);
      return r.json();
    });
    promesa.catch(() => cache.delete(ruta));
    cache.set(ruta, promesa);
  }
  return cache.get(ruta) as Promise<T>;
}

export const cargarAtlas = () => pedir<Atlas>('atlas.json');
export const cargarVault = (slug: string) => pedir<DatosVault>(`vault/${slug}.json`);
export const cargarBloque = (bloque: string) => pedir<Record<string, string>>(`contenido/${bloque}.json`);
export const cargarSkills = () => pedir<DatosSkills>('skills.json');
export const cargarDetalleSkill = (archivo: string) => pedir<DetalleSkill>(`skills/${archivo}.json`);
export const cargarAgentes = () => pedir<{ agentes: Agente[] }>('agentes.json');
export const cargarRecientes = () => pedir<Recientes>('recientes.json');
export const cargarTareas = () => pedir<DatosTareas>('tareas.json');
export const cargarProyectos = () => pedir<DatosProyectos>('proyectos.json');
export const cargarSalud = () => pedir<DatosSalud>('salud.json');

/** Marca una tarea como hecha en su nota (el servidor cambia solo esa casilla). */
export async function marcarTareaHecha(t: Tarea): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('/__atlas/tarea', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ s: t.s, r: t.r, l: t.l, h: t.h }) });
    return await r.json();
  } catch {
    return { ok: false, error: 'El servidor no responde' };
  }
}

export function recargarDatos() {
  cache.clear();
  version += 1;
  oyentes.forEach((f) => f());
}

export function useVersionDatos() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => version,
  );
}

export interface Estado<T> {
  datos: T | null;
  error: string | null;
  cargando: boolean;
}

/** Ejecuta un cargador y vuelve a hacerlo cuando cambia la clave o se recargan los datos. */
export function useDatos<T>(clave: string | null, cargador: () => Promise<T>): Estado<T> {
  const v = useVersionDatos();
  const [estado, setEstado] = useState<Estado<T>>({ datos: null, error: null, cargando: clave !== null });
  useEffect(() => {
    if (clave === null) {
      setEstado({ datos: null, error: null, cargando: false });
      return;
    }
    let vivo = true;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    cargador()
      .then((datos) => vivo && setEstado({ datos, error: null, cargando: false }))
      .catch((e: Error) => vivo && setEstado({ datos: null, error: e.message, cargando: false }));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, v]);
  return estado;
}

export async function regenerarEnServidor(): Promise<{ ok: boolean; salida: string }> {
  const r = await fetch('/__atlas/regenerar', { method: 'POST' });
  if (!r.ok) return { ok: false, salida: `El servidor respondió ${r.status}` };
  return r.json();
}
