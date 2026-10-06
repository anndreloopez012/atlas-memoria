// Actividad de un vault: calendario de calor del último año (cada cuadro es un día;
// más intenso, más notas tocadas) y la línea de tiempo de notas agrupadas por
// cercanía. Clic en un día para ver solo lo que cambió ese día.
import { CalendarDays, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { calendario, claveDia, grupoDeFecha } from '../../lib/actividad';
import { hace, n } from '../../lib/formato';
import type { Nota } from '../../lib/tipos';

interface Props {
  notas: Nota[];
  color: string;
  notaId: string | null;
  colorDe: (f: string) => string;
  enlaceDe: (id: string) => string;
}

const CELDA = 12;
const HUECO = 3;
const PASO = CELDA + HUECO;
const MES_CORTO = new Intl.DateTimeFormat('es-GT', { month: 'short' });
const FECHA_LARGA = new Intl.DateTimeFormat('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const LIMITE = 120;

export default function Actividad({ notas, color, notaId, colorDe, enlaceDe }: Props) {
  const [dia, setDia] = useState<string | null>(null);
  const [limite, setLimite] = useState(LIMITE);
  const { columnas, maximo, diasActivos } = useMemo(() => calendario(notas), [notas]);
  const desplazable = useRef<HTMLDivElement>(null);

  // En pantallas chicas el calendario se desplaza: empezar mostrando lo más reciente.
  useEffect(() => {
    const el = desplazable.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [columnas]);

  const delDia = useMemo(() => (dia ? notas.filter((x) => claveDia(new Date(x.m)) === dia) : notas), [notas, dia]);
  const ordenadas = useMemo(() => [...delDia].sort((a, b) => b.m.localeCompare(a.m)), [delDia]);
  const grupos = useMemo(() => {
    const salida: { titulo: string; notas: Nota[] }[] = [];
    for (const x of ordenadas.slice(0, limite)) {
      const titulo = grupoDeFecha(x.m);
      if (salida.at(-1)?.titulo !== titulo) salida.push({ titulo, notas: [] });
      salida.at(-1)!.notas.push(x);
    }
    return salida;
  }, [ordenadas, limite]);

  // Escala logarítmica: un día con una importación masiva no debe apagar al resto.
  const nivel = (cuenta: number) => (cuenta === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((Math.log1p(cuenta) / Math.log1p(Math.max(maximo, 1))) * 4))));
  const ancho = 26 + columnas.length * PASO;
  const alto = 18 + 7 * PASO;

  return (
    <div className="actividad">
      <section className="actividad-calendario" aria-label="Calendario de actividad del último año">
        <header>
          <p className="rotulo">
            <CalendarDays size={12} /> Último año
          </p>
          <p className="mono">
            {n(diasActivos)} días con cambios · máximo {n(maximo)} notas en un día
          </p>
        </header>
        <div className="calendario-desplazable" ref={desplazable}>
          <svg viewBox={`0 0 ${ancho} ${alto}`} className="calendario" style={{ ['--c' as string]: color }}>
            {columnas.map((columna, s) => {
              const primero = columna.find(Boolean);
              const anterior = columnas[s - 1]?.find(Boolean);
              const nuevoMes = primero && (!anterior || anterior.fecha.getMonth() !== primero.fecha.getMonth());
              return (
                <g key={s} transform={`translate(${26 + s * PASO},18)`}>
                  {nuevoMes && s < columnas.length - 2 && (
                    <text className="calendario-mes" y={-6}>
                      {MES_CORTO.format(primero.fecha).replace('.', '')}
                    </text>
                  )}
                  {columna.map((celda, d) =>
                    celda ? (
                      <rect
                        key={d}
                        y={d * PASO}
                        width={CELDA}
                        height={CELDA}
                        rx={3}
                        className={`dia nivel-${nivel(celda.cuenta)} ${dia === celda.clave ? 'elegido' : ''}`}
                        onClick={() => {
                          setDia(dia === celda.clave || celda.cuenta === 0 ? null : celda.clave);
                          setLimite(LIMITE);
                        }}
                      >
                        <title>{`${FECHA_LARGA.format(celda.fecha)}: ${celda.cuenta} ${celda.cuenta === 1 ? 'nota' : 'notas'}`}</title>
                      </rect>
                    ) : null,
                  )}
                </g>
              );
            })}
            {['L', 'X', 'V'].map((letra, i) => (
              <text key={letra} className="calendario-dia" x={0} y={18 + (i * 2) * PASO + CELDA - 2}>
                {letra}
              </text>
            ))}
          </svg>
        </div>
        <div className="calendario-leyenda mono" aria-hidden="true">
          menos
          {[0, 1, 2, 3, 4].map((x) => (
            <span key={x} className={`dia-muestra nivel-${x}`} style={{ ['--c' as string]: color }} />
          ))}
          más
        </div>
      </section>

      {dia && (
        <p className="actividad-filtro">
          Cambios del {FECHA_LARGA.format(new Date(`${dia}T12:00:00`))} · {n(delDia.length)} {delDia.length === 1 ? 'nota' : 'notas'}
          <button className="icono-boton" onClick={() => setDia(null)} aria-label="Quitar el filtro del día">
            <X size={14} />
          </button>
        </p>
      )}

      <div className="linea-tiempo">
        {grupos.map((g) => (
          <section key={g.titulo} className="tiempo-grupo">
            <h3 className="rotulo tiempo-titulo">
              {g.titulo} <span className="mono">{g.notas.length}</span>
            </h3>
            <ol>
              {g.notas.map((x) => (
                <li key={x.id}>
                  <a href={enlaceDe(x.id)} className={`tarjeta-nota ${x.id === notaId ? 'activa' : ''}`} style={{ ['--c' as string]: colorDe(x.f) }}>
                    <span className="tarjeta-nota-cabeza">
                      <span className="tarjeta-nota-titulo">{x.t}</span>
                      <span className="mono tarjeta-nota-fecha">{hace(x.m)}</span>
                    </span>
                    <span className="mono tarjeta-nota-ruta">{x.f || 'raíz'}</span>
                    {x.ex && <span className="tarjeta-nota-extracto">{x.ex}</span>}
                    {x.tg.length > 0 && (
                      <span className="tarjeta-nota-etiquetas">
                        {x.tg.slice(0, 3).map((t) => (
                          <span key={t}>#{t}</span>
                        ))}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {ordenadas.length > limite && (
          <button className="boton-secundario mas-notas" onClick={() => setLimite((l) => l + LIMITE)}>
            Mostrar {n(Math.min(LIMITE, ordenadas.length - limite))} más
          </button>
        )}
        {ordenadas.length === 0 && <p className="vacio">No hay notas que mostrar.</p>}
      </div>
    </div>
  );
}
