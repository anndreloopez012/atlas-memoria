// Tema oscuro («Observatorio») o claro («Carta»). Se recuerda por navegador.
import { useSyncExternalStore } from 'react';

export type Tema = 'oscuro' | 'claro';

function leerGuardado(): Tema {
  try {
    const t = localStorage.getItem('atlas-tema');
    if (t === 'claro' || t === 'oscuro') return t;
  } catch {
    /* almacenamiento bloqueado */
  }
  return 'oscuro';
}

let tema: Tema = leerGuardado();
document.documentElement.dataset.tema = tema;
const oyentes = new Set<() => void>();

export function alternarTema() {
  tema = tema === 'oscuro' ? 'claro' : 'oscuro';
  document.documentElement.dataset.tema = tema;
  try {
    localStorage.setItem('atlas-tema', tema);
  } catch {
    /* sin almacenamiento: solo dura la sesión */
  }
  oyentes.forEach((f) => f());
}

export function useTema(): Tema {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => tema,
  );
}

/** Colores para dibujar en canvas (no puede leer variables CSS). */
export function coloresCanvas(t: Tema) {
  return t === 'oscuro'
    ? { texto: '#ece8dd', linea: 'rgba(236,232,221,0.10)', enlace: 'rgba(236,232,221,0.16)', fondo: 'rgba(8,9,14,0.82)' }
    : { texto: '#1c1b18', linea: 'rgba(27,26,23,0.12)', enlace: 'rgba(27,26,23,0.2)', fondo: 'rgba(251,249,243,0.9)' };
}

/** Mezcla dos colores hex (#rrggbb). `peso` es la proporción del primero. */
export function mezclar(a: string, b: string, peso: number): string {
  const ha = a.replace('#', '');
  const hb = b.replace('#', '');
  const canal = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const c = [0, 2, 4].map((i) => Math.round(canal(ha, i) * peso + canal(hb, i) * (1 - peso)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** En tema claro los tonos pastel se oscurecen para que se lean sobre papel. */
export const tono = (color: string, t: Tema) => (t === 'oscuro' || !/^#[0-9a-f]{6}$/i.test(color) ? color : mezclar(color, '#1c1b18', 0.62));
