import { Check, Copy, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { armarAvance, avanceComoTexto, descargarAvance, type Avance } from '../lib/avance';
import type { Atlas } from '../lib/tipos';

const CLAVE_NOMBRE = 'atlas:avance-nombre';
const leerNombre = () => {
  try {
    return localStorage.getItem(CLAVE_NOMBRE) ?? '';
  } catch {
    return '';
  }
};

/** «Compartir mi avance», dentro del centro de mando: vista previa, descargar o copiar. */
export function VistaAvance({ atlas }: { atlas: Atlas }) {
  const [nombre, setNombre] = useState(leerNombre);
  const [avance, setAvance] = useState<Avance | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vigente = true;
    armarAvance(atlas, nombre).then((a) => vigente && setAvance(a));
    try {
      localStorage.setItem(CLAVE_NOMBRE, nombre);
    } catch {
      /* sin almacenamiento */
    }
    return () => {
      vigente = false;
    };
  }, [atlas, nombre]);

  const ultimaSemana = avance?.semanas[0]?.notas ?? 0;
  return (
    <div className="avance">
      <p className="rotulo">Compartir mi avance</p>
      <p className="avance-que">
        Un resumen para tu mentor o docente: las cifras de tus vaults, tu constancia semana a semana, tareas, proyectos, las skills y agentes que creaste y tu ruta Aprende. <strong>No incluye el contenido de tus notas ni sus títulos</strong> (solo los nombres de tus proyectos).
      </p>
      <label className="avance-nombre">
        <span>Tu nombre (opcional)</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Para que sepan de quién es" maxLength={80} />
      </label>
      {avance ? (
        <dl className="avance-cifras">
          <div>
            <dt>notas</dt>
            <dd>{avance.totales.notas.toLocaleString('es-GT')}</dd>
          </div>
          <div>
            <dt>enlaces</dt>
            <dd>{avance.totales.enlaces.toLocaleString('es-GT')}</dd>
          </div>
          <div>
            <dt>esta semana</dt>
            <dd>{ultimaSemana}</dd>
          </div>
          <div>
            <dt>proyectos</dt>
            <dd>{avance.proyectos.length}</dd>
          </div>
          <div>
            <dt>skills tuyas</dt>
            <dd>{avance.skills.creadas.length}</dd>
          </div>
          <div>
            <dt>Aprende</dt>
            <dd>
              {avance.aprende.hechos}/{avance.aprende.total}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="vacio">Armando el resumen…</p>
      )}
      <div className="aprende-acciones">
        <button type="button" className="boton-primario" disabled={!avance} onClick={() => avance && descargarAvance(avance)}>
          <Download size={16} /> Descargar resumen
        </button>
        <button
          type="button"
          className="boton-secundario"
          disabled={!avance}
          onClick={async () => {
            if (!avance) return;
            try {
              await navigator.clipboard.writeText(avanceComoTexto(avance));
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1600);
            } catch {
              /* sin portapapeles */
            }
          }}
        >
          {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? 'Copiado' : 'Copiar como texto'}
        </button>
      </div>
      <p className="mono avance-nota">El archivo es una página que se abre en cualquier navegador y lleva los datos en JSON, por si tu mentor usa una herramienta o una IA para revisarlos.</p>
    </div>
  );
}
