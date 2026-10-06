const numero = new Intl.NumberFormat('es-GT');
export const n = (valor: number) => numero.format(valor);

const fecha = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatoFecha = (iso: string) => (iso ? fecha.format(new Date(iso)) : '—');

export function hace(iso: string): string {
  if (!iso) return '—';
  const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return 'hace un momento';
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 45) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  return formatoFecha(iso);
}

export const minutosLectura = (palabras: number) => Math.max(1, Math.round(palabras / 220));

export function intervalo(segundos: number | null): string {
  if (!segundos) return 'bajo demanda';
  if (segundos < 60) return `cada ${segundos} s`;
  if (segundos < 3600) return `cada ${Math.round(segundos / 60)} min`;
  return `cada ${Math.round(segundos / 3600)} h`;
}

export function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Color legible sobre el fondo actual a partir del color del vault. */
export const colorTexto = (color: string) => `color-mix(in oklab, ${color} 62%, var(--tinta))`;

// Paleta para categorías y carpetas: tonos que conviven con los colores de los vaults.
export const PALETA = ['#7dd3fc', '#f9a8d4', '#fcd34d', '#86efac', '#c4b5fd', '#fda4af', '#5eead4', '#fdba74', '#a5b4fc', '#bef264', '#f0abfc', '#93c5fd'];

const COLOR_IA_CONOCIDA: Record<string, string> = {
  Claude: '#e8875b',
  Codex: '#7dd3fc',
  Antigravity: '#c4b5fd',
  Compartidas: '#fcd34d',
  Extra: '#f9a8d4',
  launchd: '#86efac',
  systemd: '#86efac',
  cron: '#86efac',
};

/** Color de cada IA; las que el atlas no conoce reciben uno estable de la paleta. */
export function colorIA(ia: string): string {
  if (COLOR_IA_CONOCIDA[ia]) return COLOR_IA_CONOCIDA[ia];
  let h = 0;
  for (const c of ia) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

const INICIAL_CONOCIDA: Record<string, string> = { Claude: 'C', Codex: 'X', Antigravity: 'A', Compartidas: '+', Extra: 'E' };
export const inicialIA = (ia: string) => INICIAL_CONOCIDA[ia] ?? ia.charAt(0).toUpperCase();

/** Descripción corta de cada IA para los filtros. */
export const AYUDA_IA: Record<string, string> = {
  Compartidas: 'Carpeta compartida (~/.agents/skills) que leen varias IAs',
};

/** «uno», «dos»… para frases como «de él nacen los otros cinco vaults». */
export function enPalabras(n: number): string {
  const palabras = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce'];
  return palabras[n] ?? String(n);
}

/** Ruta corta para mostrar: el directorio personal se ve como ~ en macOS, Linux y Windows. */
export const corto = (ruta: string) => ruta.replace(/^\/Users\/[^/]+|^\/home\/[^/]+|^[A-Za-z]:\\Users\\[^\\]+/, '~');
