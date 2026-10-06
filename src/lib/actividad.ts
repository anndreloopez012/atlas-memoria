// Actividad de un vault a partir de la fecha de modificación de cada nota: pulso
// semanal, calendario de calor por día y grupos por cercanía («Hoy», «Esta semana»…).
import type { Nota } from './tipos';

const DIA = 86_400_000;

/** Fecha local en formato AAAA-MM-DD (clave de cada día del calendario). */
export const claveDia = (fecha: Date) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

const inicioDelDia = (fecha: Date) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

/** Notas tocadas por semana en las últimas `semanas` (la última es la actual). */
export function pulsoSemanal(notas: Nota[], semanas = 26, hoy = new Date()): number[] {
  const fin = inicioDelDia(hoy).getTime() + DIA;
  const conteo = new Array(semanas).fill(0);
  for (const n of notas) {
    const t = new Date(n.m).getTime();
    const atras = Math.floor((fin - t) / (7 * DIA));
    if (atras >= 0 && atras < semanas) conteo[semanas - 1 - atras] += 1;
  }
  return conteo;
}

export interface CeldaDia {
  clave: string;
  fecha: Date;
  cuenta: number;
}

/**
 * Calendario de las últimas `semanas` semanas, en columnas de lunes a domingo
 * (como el de contribuciones de GitHub). Los días futuros quedan como `null`.
 */
export function calendario(notas: Nota[], semanas = 53, hoy = new Date()) {
  const porDia = new Map<string, number>();
  for (const n of notas) {
    const clave = claveDia(new Date(n.m));
    porDia.set(clave, (porDia.get(clave) ?? 0) + 1);
  }
  const hoy0 = inicioDelDia(hoy);
  const diaSemana = (hoy0.getDay() + 6) % 7; // lunes = 0
  const inicio = new Date(hoy0.getTime() - ((semanas - 1) * 7 + diaSemana) * DIA);
  const columnas: (CeldaDia | null)[][] = [];
  let maximo = 0;
  for (let s = 0; s < semanas; s++) {
    const columna: (CeldaDia | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + s * 7 + d);
      if (fecha > hoy0) {
        columna.push(null);
        continue;
      }
      const clave = claveDia(fecha);
      const cuenta = porDia.get(clave) ?? 0;
      maximo = Math.max(maximo, cuenta);
      columna.push({ clave, fecha, cuenta });
    }
    columnas.push(columna);
  }
  const diasActivos = [...porDia.entries()].filter(([clave]) => clave >= claveDia(inicio)).length;
  return { columnas, maximo, diasActivos };
}

const MESES = new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' });

/** Nombre del grupo de una fecha: Hoy, Ayer, Esta semana, Este mes, o «septiembre de 2026». */
export function grupoDeFecha(iso: string, hoy = new Date()): string {
  const fecha = new Date(iso);
  const hoy0 = inicioDelDia(hoy).getTime();
  const t = inicioDelDia(fecha).getTime();
  if (t >= hoy0) return 'Hoy';
  if (t >= hoy0 - DIA) return 'Ayer';
  if (t >= hoy0 - 6 * DIA) return 'Esta semana';
  if (fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear()) return 'Este mes';
  const texto = MESES.format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Notas tocadas en los últimos `dias` días. */
export const recientes = (notas: Nota[], dias = 30, hoy = new Date()) => notas.filter((n) => hoy.getTime() - new Date(n.m).getTime() <= dias * DIA).length;
