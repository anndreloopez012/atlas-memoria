// Una tarea pendiente: casilla para marcarla como hecha (cambia solo esa casilla
// en la nota), su texto, la fecha y la prioridad si tiene, y la nota de donde sale.
import { Check } from 'lucide-react';
import { useState } from 'react';
import { claveDia } from '../lib/actividad';
import { marcarTareaHecha } from '../lib/datos';
import { rutaVault } from '../lib/rutas';
import type { Tarea } from '../lib/tipos';

const CORTA = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short' });

/** «hoy», «mañana», «venció hace 3 días» o la fecha corta. */
export function etiquetaFecha(d: string) {
  const hoy = claveDia(new Date());
  const dias = Math.round((Date.parse(`${d}T12:00:00`) - Date.parse(`${hoy}T12:00:00`)) / 86_400_000);
  if (dias === 0) return { texto: 'hoy', clase: 'hoy' };
  if (dias === 1) return { texto: 'mañana', clase: 'pronto' };
  if (dias < 0) return { texto: dias === -1 ? 'venció ayer' : `venció hace ${-dias} días`, clase: 'vencida' };
  return { texto: CORTA.format(new Date(`${d}T12:00:00`)).replace('.', ''), clase: dias <= 7 ? 'pronto' : '' };
}

export default function FilaTarea({ tarea, color, conNota = true }: { tarea: Tarea; color: string; conNota?: boolean }) {
  const [estado, setEstado] = useState<'pendiente' | 'marcando' | 'hecha'>('pendiente');
  const [error, setError] = useState<string | null>(null);
  const fecha = tarea.d ? etiquetaFecha(tarea.d) : null;

  const marcar = async () => {
    if (estado !== 'pendiente') return;
    setEstado('marcando');
    setError(null);
    const r = await marcarTareaHecha(tarea);
    if (r.ok) setEstado('hecha');
    else {
      setEstado('pendiente');
      setError(r.error ?? 'No se pudo marcar');
    }
  };

  return (
    <li className={`tarea ${estado}`} style={{ ['--c' as string]: color }}>
      <button className="tarea-casilla" onClick={marcar} disabled={estado !== 'pendiente'} aria-label={`Marcar como hecha: ${tarea.x}`} title="Marcar como hecha (cambia la casilla en la nota)">
        {estado === 'hecha' && <Check size={12} strokeWidth={3} />}
      </button>
      <div className="tarea-cuerpo">
        <span className="tarea-texto">{tarea.x}</span>
        <span className="tarea-meta mono">
          {fecha && <span className={`tarea-fecha ${fecha.clase}`}>{fecha.texto}</span>}
          {tarea.p && <span className={`tarea-prioridad ${tarea.p}`}>prioridad {tarea.p}</span>}
          {tarea.e === 'en-curso' && <span className="tarea-curso">en curso</span>}
          {conNota && (
            <a href={rutaVault(tarea.s, tarea.id)} className="tarea-nota">
              {tarea.t}
            </a>
          )}
        </span>
        {error && <span className="tarea-error">{error}</span>}
      </div>
    </li>
  );
}
