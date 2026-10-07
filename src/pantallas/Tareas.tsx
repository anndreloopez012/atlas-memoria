// Todas las tareas pendientes de los vaults, agrupadas por cuándo vencen (y las
// que no tienen fecha, por nota). Un solo buscador, chips de vault y la opción de
// incluir las tareas de notas que reescriben las herramientas.
import { ArrowLeft, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import FilaTarea from '../componentes/FilaTarea';
import { claveDia } from '../lib/actividad';
import { cargarTareas, useDatos } from '../lib/datos';
import { n } from '../lib/formato';
import { rutaVault } from '../lib/rutas';
import type { Atlas, Tarea } from '../lib/tipos';

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const LIMITE_NOTAS = 40;

export default function Tareas({ atlas }: { atlas: Atlas }) {
  const datos = useDatos('tareas', cargarTareas);
  const [q, setQ] = useState('');
  const [vault, setVault] = useState<string | null>(null);
  const [conHerramientas, setConHerramientas] = useState(false);
  const [limite, setLimite] = useState(LIMITE_NOTAS);
  const colorDe = (v: string) => atlas.vaults.find((x) => x.nombre === v)?.color ?? '#64748b';

  const todas = datos.datos?.tareas ?? [];
  const deHerramientas = todas.filter((t) => t.g).length;
  const visibles = useMemo(() => {
    const consulta = sinAcentos(q.trim());
    return todas.filter((t) => (conHerramientas || !t.g) && (!vault || t.v === vault) && (!consulta || sinAcentos(`${t.x} ${t.t} ${t.f}`).includes(consulta)));
  }, [todas, q, vault, conHerramientas]);

  const grupos = useMemo(() => {
    const hoy = claveDia(new Date());
    const semana = claveDia(new Date(Date.now() + 7 * 86_400_000));
    const conFecha = visibles.filter((t) => t.d);
    const porNota = new Map<string, Tarea[]>();
    for (const t of visibles.filter((x) => !x.d)) porNota.set(t.id, [...(porNota.get(t.id) ?? []), t]);
    return {
      fechados: [
        { titulo: 'Vencidas', lista: conFecha.filter((t) => t.d! < hoy) },
        { titulo: 'Hoy', lista: conFecha.filter((t) => t.d === hoy) },
        { titulo: 'Esta semana', lista: conFecha.filter((t) => t.d! > hoy && t.d! <= semana) },
        { titulo: 'Más adelante', lista: conFecha.filter((t) => t.d! > semana) },
      ].filter((g) => g.lista.length),
      porNota: [...porNota.values()],
    };
  }, [visibles]);

  const vaultsConTareas = atlas.vaults.filter((v) => todas.some((t) => t.v === v.nombre && (conHerramientas || !t.g)));

  return (
    <div className="pagina tareas">
      <a className="volver" href="#/hoy">
        <ArrowLeft size={15} /> Hoy
      </a>
      <header className="pagina-cabecera">
        <p className="rotulo">Hoy · pendientes</p>
        <h1 className="display">
          Lo que tienes <em>pendiente</em>
        </h1>
        <p className="pagina-bajada">
          {datos.datos ? `${n(todas.length - deHerramientas)} tareas abiertas en tus notas (${n(datos.datos.hechas)} ya hechas). ` : ''}
          Márcalas aquí o en Obsidian: el atlas cambia solo la casilla de esa línea.
        </p>
      </header>

      <div className="filtros">
        <div className="filtros-fila">
          <label className="filtro grande">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en tareas y notas" aria-label="Buscar tareas" />
            {q && (
              <button className="filtro-limpiar" onClick={() => setQ('')} aria-label="Quitar búsqueda">
                <X size={13} />
              </button>
            )}
          </label>
        </div>
        <div className="filtros-fila">
          <button className={`chip ${vault === null ? 'activo' : ''}`} onClick={() => setVault(null)}>
            Todos
          </button>
          {vaultsConTareas.map((v) => (
            <button key={v.slug} className={`chip ${vault === v.nombre ? 'activo' : ''}`} onClick={() => setVault(vault === v.nombre ? null : v.nombre)}>
              <span className="chip-punto" style={{ background: v.color }} />
              {v.nombre}
            </button>
          ))}
          {deHerramientas > 0 && (
            <label className="chip interruptor derecha">
              <input type="checkbox" checked={conHerramientas} onChange={(e) => setConHerramientas(e.target.checked)} />
              Incluir las de herramientas <span className="mono">{n(deHerramientas)}</span>
            </label>
          )}
        </div>
      </div>

      {datos.error && <p className="vacio">{datos.error}</p>}
      {datos.datos && visibles.length === 0 && <p className="vacio">No hay tareas pendientes con esos filtros.</p>}

      {grupos.fechados.map((g) => (
        <section key={g.titulo} className="tareas-grupo">
          <h2 className="rotulo">
            {g.titulo} <span className="mono">{g.lista.length}</span>
          </h2>
          <ul className="lista-tareas">
            {g.lista.map((t) => (
              <FilaTarea key={`${t.id}:${t.l}`} tarea={t} color={colorDe(t.v)} />
            ))}
          </ul>
        </section>
      ))}

      {grupos.porNota.length > 0 && (
        <section className="tareas-grupo">
          <h2 className="rotulo">
            Sin fecha <span className="mono">{grupos.porNota.reduce((t, l) => t + l.length, 0)}</span>
          </h2>
          <div className="tareas-notas">
            {grupos.porNota.slice(0, limite).map((lista) => {
              const t0 = lista[0];
              return (
                <article key={t0.id} className="tareas-nota" style={{ ['--c' as string]: colorDe(t0.v) }}>
                  <a href={rutaVault(t0.s, t0.id)} className="tareas-nota-titulo">
                    <span className="chip-punto" />
                    {t0.t}
                    <span className="mono">{t0.v}{t0.f ? ` / ${t0.f}` : ''}</span>
                  </a>
                  <ul className="lista-tareas">
                    {lista.map((t) => (
                      <FilaTarea key={`${t.id}:${t.l}`} tarea={t} color={colorDe(t.v)} conNota={false} />
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
          {grupos.porNota.length > limite && (
            <button className="boton-secundario mas-notas" onClick={() => setLimite((l) => l + LIMITE_NOTAS)}>
              Mostrar {Math.min(LIMITE_NOTAS, grupos.porNota.length - limite)} notas más
            </button>
          )}
        </section>
      )}
    </div>
  );
}
