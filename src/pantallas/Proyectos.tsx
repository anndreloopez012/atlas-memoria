// Proyectos: cada uno con su estado (semáforo del sistema de memoria, si lo hay),
// su última actividad y las entradas más recientes de su historia. En Hoy aparece
// una tarjeta con los más activos; `#/hoy/proyectos` los muestra todos.
import { ArrowLeft, FolderGit2, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cargarProyectos, useDatos } from '../lib/datos';
import { hace, n } from '../lib/formato';
import { rutaVault } from '../lib/rutas';
import type { Proyecto } from '../lib/tipos';

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const SEMAFORO: Record<string, { etiqueta: string; color: string }> = {
  verde: { etiqueta: 'Al día', color: 'var(--exito)' },
  amarillo: { etiqueta: 'Por revisar', color: 'var(--laton)' },
  rojo: { etiqueta: 'Con problemas', color: 'var(--peligro)' },
  archivado: { etiqueta: 'Archivado', color: 'var(--tinta-3)' },
};

const FECHA = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short' });
const fechaCorta = (d: string) => FECHA.format(new Date(`${d}T12:00:00`)).replace('.', '');

/** Tarjeta de Hoy: los proyectos con actividad más reciente (sin los archivados). */
export function TarjetaProyectos() {
  const datos = useDatos('proyectos', cargarProyectos);
  const lista = datos.datos?.proyectos ?? [];
  if (!lista.length) return null;
  const activos = lista.filter((p) => p.semaforo !== 'archivado').slice(0, 6);
  return (
    <article className="hoy-tarjeta">
      <header>
        <FolderGit2 size={16} />
        <h2>Proyectos</h2>
        <span className="mono">{n(lista.length)}</span>
      </header>
      <ul className="lista-proyectos">
        {activos.map((p) => (
          <li key={p.nombre}>
            <a href={rutaVault(p.s, p.id)}>
              <span className="semaforo" style={{ background: SEMAFORO[p.semaforo ?? '']?.color ?? 'var(--tinta-3)' }} title={SEMAFORO[p.semaforo ?? '']?.etiqueta} />
              <span className="proyecto-nombre">{p.nombre}</span>
              {p.actividad && <span className="mono hoy-meta-linea">{hace(p.actividad)}</span>}
              {p.entradas[0] && <span className="proyecto-ultima">{p.entradas[0].t}</span>}
            </a>
          </li>
        ))}
      </ul>
      <a className="hoy-mas mono" href="#/hoy/proyectos">
        Ver los {n(lista.length)} proyectos →
      </a>
    </article>
  );
}

export default function Proyectos() {
  const datos = useDatos('proyectos', cargarProyectos);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<string | null>(null);
  const lista = datos.datos?.proyectos ?? [];

  const visibles = useMemo(() => {
    const consulta = sinAcentos(q.trim());
    return lista.filter(
      (p) => (!estado || (p.semaforo ?? 'sin') === estado) && (!consulta || sinAcentos(`${p.nombre} ${p.familia ?? ''} ${p.rol ?? ''} ${p.entradas.map((e) => e.t).join(' ')}`).includes(consulta)),
    );
  }, [lista, q, estado]);

  const cuenta = (s: string) => lista.filter((p) => p.semaforo === s).length;

  return (
    <div className="pagina proyectos">
      <a className="volver" href="#/hoy">
        <ArrowLeft size={15} /> Hoy
      </a>
      <header className="pagina-cabecera">
        <p className="rotulo">Hoy · proyectos</p>
        <h1 className="display">
          En qué estás <em>trabajando</em>
        </h1>
        <p className="pagina-bajada">
          {n(lista.length)} proyectos con su última actividad y su historia (bitácora, decisiones, cambios).
          {datos.datos?.semaforo ? ' El estado sale del semáforo de tu sistema de memoria.' : ''}
        </p>
      </header>

      <div className="filtros">
        <div className="filtros-fila">
          <label className="filtro grande">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un proyecto o algo de su historia" aria-label="Buscar proyectos" />
            {q && (
              <button className="filtro-limpiar" onClick={() => setQ('')} aria-label="Quitar búsqueda">
                <X size={13} />
              </button>
            )}
          </label>
        </div>
        {datos.datos?.semaforo && (
          <div className="filtros-fila">
            <button className={`chip ${estado === null ? 'activo' : ''}`} onClick={() => setEstado(null)}>
              Todos
            </button>
            {Object.entries(SEMAFORO)
              .filter(([s]) => cuenta(s))
              .map(([s, info]) => (
                <button key={s} className={`chip ${estado === s ? 'activo' : ''}`} onClick={() => setEstado(estado === s ? null : s)}>
                  <span className="chip-punto" style={{ background: info.color }} />
                  {info.etiqueta} <span className="mono">{cuenta(s)}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {datos.error && <p className="vacio">{datos.error}</p>}
      {datos.datos && !lista.length && (
        <p className="vacio">No encontré proyectos. Una nota con <code>tipo: proyecto</code> en el frontmatter define uno, y las notas con <code>proyecto: &lt;nombre&gt;</code> forman su historia.</p>
      )}

      <div className="rejilla-proyectos">
        {visibles.map((p, i) => (
          <TarjetaProyecto key={p.nombre} p={p} indice={i} />
        ))}
      </div>
    </div>
  );
}

function TarjetaProyecto({ p, indice }: { p: Proyecto; indice: number }) {
  const sem = SEMAFORO[p.semaforo ?? ''];
  return (
    <article className="tarjeta-proyecto" style={{ ['--sem' as string]: sem?.color ?? 'var(--linea-fuerte)', animationDelay: `${Math.min(indice, 16) * 0.03}s` }}>
      <header>
        <a href={rutaVault(p.s, p.id)} className="tarjeta-proyecto-nombre mono">
          {p.nombre}
        </a>
        {sem && <span className="tarjeta-proyecto-estado">{sem.etiqueta}</span>}
      </header>
      <p className="tarjeta-proyecto-sub mono">
        {[p.familia, p.rol, p.actividad ? `activo ${hace(p.actividad)}` : null].filter(Boolean).join(' · ')}
      </p>
      {p.motivos?.[0] && p.semaforo !== 'verde' && <p className="tarjeta-proyecto-motivo">{p.motivos[0]}</p>}
      {p.entradas.length > 0 && (
        <ol className="tarjeta-proyecto-historia">
          {p.entradas.slice(0, 3).map((e) => (
            <li key={e.id}>
              <a href={rutaVault(e.s, e.id)}>
                <span className="mono">{fechaCorta(e.fecha)}</span>
                {e.tipo && <span className="insignia">{e.tipo}</span>}
                <span className="tarjeta-proyecto-entrada">{e.t}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
      <footer className="mono">
        {n(p.notas)} notas{p.totalEntradas ? ` · ${n(p.totalEntradas)} en su historia` : ''}
      </footer>
    </article>
  );
}
