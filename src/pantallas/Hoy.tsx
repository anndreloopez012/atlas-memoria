// Hoy: lo que importa ahora. Empieza por lo que cambió desde tu última visita:
// las notas que escribiste o editaste (por vault), las skills y agentes nuevos y,
// aparte y en silencio, lo que tu sistema actualizó solo. Las demás secciones de
// Hoy se suman aquí, no como botones en la barra.
import { ArrowRight, Bot, CheckSquare, ChevronDown, FileText, Sparkles, Star } from 'lucide-react';
import { useMemo } from 'react';
import FilaTarea from '../componentes/FilaTarea';
import OrbeVault from '../componentes/vault/OrbeVault';
import { cargarRecientes, cargarTareas, useDatos } from '../lib/datos';
import { useFavoritos } from '../lib/favoritos';
import { hace, n } from '../lib/formato';
import { rutaAgente, rutaSkill, rutaVault, type SeccionHoy } from '../lib/rutas';
import type { Atlas, Recientes } from '../lib/tipos';
import { desdeNovedades, visitaAnterior } from '../lib/visita';
import Proyectos, { TarjetaProyectos } from './Proyectos';
import Tareas from './Tareas';

const FECHA = new Intl.DateTimeFormat('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
const POR_VAULT = 5;

/** Lo nuevo desde `desde` (ms): notas propias por vault, automáticas, skills y agentes. */
export function novedades(datos: Recientes | null, desde: number) {
  const despues = (iso: string | null) => Boolean(iso) && Date.parse(iso!) > desde;
  const notas = (datos?.notas ?? []).filter((x) => despues(x.m));
  return {
    propias: notas.filter((x) => !x.g),
    automaticas: notas.filter((x) => x.g),
    skills: (datos?.skills ?? []).filter((x) => despues(x.c) || despues(x.m)).map((x) => ({ ...x, nueva: despues(x.c) })),
    agentes: (datos?.agentes ?? []).filter((x) => despues(x.c) || despues(x.m)).map((x) => ({ ...x, nuevo: despues(x.c) })),
    esNueva: (c: string | null) => despues(c),
  };
}

export default function Hoy({ atlas, seccion }: { atlas: Atlas; seccion: SeccionHoy }) {
  if (seccion === 'tareas') return <Tareas atlas={atlas} />;
  if (seccion === 'proyectos') return <Proyectos />;
  return <PortadaHoy atlas={atlas} />;
}

/** Tarjeta lateral: lo que marcaste con la estrella. */
function Favoritos() {
  const favoritos = useFavoritos();
  if (!favoritos.length) return null;
  return (
    <article className="hoy-tarjeta">
      <header>
        <Star size={16} />
        <h2>Favoritos</h2>
        <span className="mono">{n(favoritos.length)}</span>
      </header>
      <ul className="lista-favoritos">
        {favoritos.slice(0, 10).map((f) => {
          const Icono = f.tipo === 'nota' ? FileText : f.tipo === 'skill' ? Sparkles : Bot;
          return (
            <li key={`${f.tipo}:${f.id}`}>
              <a href={f.destino}>
                <Icono size={14} style={{ color: f.color }} />
                <span className="favorito-titulo">{f.titulo}</span>
                <span className="mono hoy-meta-linea">{f.contexto}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

/** Tarjeta lateral: las tareas propias más urgentes (con fecha primero). */
function Pendientes({ atlas }: { atlas: Atlas }) {
  const datos = useDatos('tareas', cargarTareas);
  const propias = (datos.datos?.tareas ?? []).filter((t) => !t.g);
  // Variedad: como mucho dos tareas por nota, así una lista larga no lo llena todo.
  const porNota = new Map<string, number>();
  const destacadas = propias.filter((t) => {
    const k = porNota.get(t.id) ?? 0;
    porNota.set(t.id, k + 1);
    return k < 2;
  });
  const colorDe = (v: string) => atlas.vaults.find((x) => x.nombre === v)?.color ?? '#64748b';
  if (!datos.datos || datos.datos.tareas.length === 0) return null;
  return (
    <article className="hoy-tarjeta">
      <header>
        <CheckSquare size={16} />
        <h2>Pendientes</h2>
        <span className="mono">{n(propias.length)}</span>
      </header>
      {propias.length ? (
        <ul className="lista-tareas">
          {destacadas.slice(0, 7).map((t) => (
            <FilaTarea key={`${t.id}:${t.l}`} tarea={t} color={colorDe(t.v)} />
          ))}
        </ul>
      ) : (
        <p className="hoy-meta">No tienes tareas pendientes en tus notas.</p>
      )}
      <a className="hoy-mas mono" href="#/hoy/tareas">
        {propias.length > 7 ? `Ver las ${n(propias.length)} tareas` : 'Ver todas las tareas'} →
      </a>
    </article>
  );
}

function PortadaHoy({ atlas }: { atlas: Atlas }) {
  const recientes = useDatos('recientes', cargarRecientes);
  const desde = useMemo(() => desdeNovedades(7), []);
  const nov = useMemo(() => novedades(recientes.datos, desde), [recientes.datos, desde]);

  const porVault = atlas.vaults
    .map((v) => ({ v, notas: nov.propias.filter((x) => x.v === v.nombre) }))
    .filter((g) => g.notas.length);
  const automaticasPorVault = atlas.vaults
    .map((v) => ({ v, total: nov.automaticas.filter((x) => x.v === v.nombre).length }))
    .filter((g) => g.total);

  const nada = recientes.datos && !nov.propias.length && !nov.skills.length && !nov.agentes.length;
  const desdeTexto = visitaAnterior ? `Tu última visita fue ${hace(new Date(visitaAnterior).toISOString())}.` : 'Primera visita en este navegador: esto es lo que cambió en los últimos 7 días.';
  const resumen = [
    nov.propias.length ? `${n(nov.propias.length)} ${nov.propias.length === 1 ? 'nota escrita o editada' : 'notas escritas o editadas'} en ${porVault.length} ${porVault.length === 1 ? 'vault' : 'vaults'}` : '',
    nov.skills.length ? `${n(nov.skills.length)} ${nov.skills.length === 1 ? 'skill nueva o actualizada' : 'skills nuevas o actualizadas'}` : '',
    nov.agentes.length ? `${n(nov.agentes.length)} ${nov.agentes.length === 1 ? 'agente' : 'agentes'}` : '',
  ].filter(Boolean);

  return (
    <div className="pagina hoy">
      <header className="pagina-cabecera">
        <p className="rotulo">Hoy · {FECHA.format(new Date())}</p>
        <h1 className="display">
          Lo nuevo <em>{visitaAnterior ? 'desde tu última visita' : 'de esta semana'}</em>
        </h1>
        <p className="pagina-bajada">
          {desdeTexto} {resumen.length ? `${visitaAnterior ? 'Desde entonces' : 'En ese tiempo'}: ${resumen.join(', ')}.` : nada ? 'Desde entonces no cambió nada.' : ''}
        </p>
      </header>

      {recientes.error && <p className="vacio">{recientes.error}</p>}

      <div className="hoy-rejilla">
        <aside className="hoy-lateral" aria-label="Lo pendiente">
          <Favoritos />
          <Pendientes atlas={atlas} />
          <TarjetaProyectos />
        </aside>
        <section className="hoy-seccion hoy-novedades" aria-label="Novedades">
          {porVault.map(({ v, notas }) => (
            <article key={v.slug} className="hoy-vault" style={{ ['--vault' as string]: v.color }}>
              <header>
                <OrbeVault color={v.color} semilla={v.slug} tamano={22} simple />
                <h2>{v.nombre}</h2>
                <span className="mono">{n(notas.length)}</span>
                <a href={rutaVault(v.slug)} className="hoy-ir" aria-label={`Abrir ${v.nombre}`}>
                  <ArrowRight size={14} />
                </a>
              </header>
              <ol>
                {notas.slice(0, POR_VAULT).map((x) => (
                  <li key={x.id}>
                    <a href={rutaVault(v.slug, x.id)}>
                      <span className="hoy-titulo">{x.t}</span>
                      {nov.esNueva(x.c) && <span className="insignia nueva">nueva</span>}
                      <span className="mono hoy-meta">
                        {x.f || 'raíz'} · {hace(x.m)}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
              {notas.length > POR_VAULT && (
                <a className="hoy-mas mono" href={rutaVault(v.slug)}>
                  y {n(notas.length - POR_VAULT)} más
                </a>
              )}
            </article>
          ))}

          {(nov.skills.length > 0 || nov.agentes.length > 0) && (
            <article className="hoy-vault hoy-arsenal">
              <header>
                <Sparkles size={16} />
                <h2>Skills y agentes</h2>
                <span className="mono">{n(nov.skills.length + nov.agentes.length)}</span>
              </header>
              <div className="hoy-chips">
                {nov.skills.slice(0, 18).map((s) => (
                  <a key={s.nombre} className="chip" href={rutaSkill(s.nombre)} title={`${s.categoria} · ${s.nueva ? 'nueva' : 'actualizada'}`}>
                    {s.nombre}
                    {s.nueva && <span className="insignia nueva">nueva</span>}
                  </a>
                ))}
                {nov.skills.length > 18 && <span className="mono hoy-meta">y {n(nov.skills.length - 18)} más</span>}
                {nov.agentes.map((a) => (
                  <a key={a.id} className="chip" href={rutaAgente(a.id)} title={`agente de ${a.ia}`}>
                    <Bot size={12} /> {a.nombre}
                    {a.nuevo && <span className="insignia nueva">nuevo</span>}
                  </a>
                ))}
              </div>
            </article>
          )}

          {automaticasPorVault.length > 0 && (
            <details className="hoy-automaticas">
              <summary>
                <ChevronDown size={14} /> Además, tus herramientas actualizaron solas {nov.automaticas.length >= 400 ? 'más de 400' : n(nov.automaticas.length)} {nov.automaticas.length === 1 ? 'nota' : 'notas'} (reportes, fichas, cambios en lote)
              </summary>
              <ul>
                {automaticasPorVault.map(({ v, total }) => (
                  <li key={v.slug}>
                    <a href={rutaVault(v.slug)}>{v.nombre}</a> <span className="mono">{n(total)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {nada && (
            <div className="hoy-vacio">
              <p className="display">Todo sigue igual</p>
              <p>No hay notas, skills ni agentes nuevos desde tu última visita.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
