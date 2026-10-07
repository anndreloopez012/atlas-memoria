// Agentes: subagentes de IA (Claude Code, Codex, Antigravity…) que envuelven
// skills, y las automatizaciones del sistema que trabajan sobre los vaults.
import { ArrowLeft, Bot, Clock, Cpu, Eye, FileText, Wrench } from 'lucide-react';
import Markdown from '../componentes/Markdown';
import Pipeline from '../componentes/Pipeline';
import { vaultPorNombre } from '../lib/atlas';
import { cargarAgentes, cargarSkills, useDatos } from '../lib/datos';
import { colorIA, corto, intervalo } from '../lib/formato';
import { useEffect } from 'react';
import { registrarReciente } from '../lib/recientes';
import { rutaAgente, rutaSkill, rutaVault } from '../lib/rutas';
import type { Agente, AgenteIA, Atlas, Automatizacion } from '../lib/tipos';

export default function Agentes({ atlas, agente }: { atlas: Atlas; agente: string | null }) {
  const datos = useDatos('agentes', cargarAgentes);
  if (agente) return <AgenteDetalle atlas={atlas} id={agente} />;

  const lista = datos.datos?.agentes ?? [];
  const ia = lista.filter((a): a is AgenteIA => a.tipo === 'ia');
  const autos = lista.filter((a): a is Automatizacion => a.tipo === 'automatizacion');
  const orden = ['Claude', 'Codex', 'Antigravity'];
  const nombresIA = [...new Set(ia.map((a) => a.ia))].sort((x, y) => (orden.indexOf(x) + 1 || 9) - (orden.indexOf(y) + 1 || 9));
  const porIA = nombresIA.map((x) => [x, ia.filter((a) => a.ia === x)] as const);

  return (
    <div className="pagina agentes">
      <header className="pagina-cabecera">
        <p className="rotulo">Equipo · {lista.length} piezas</p>
        <h1 className="display">
          Agentes que <em>trabajan por ti</em>
        </h1>
        <p className="pagina-bajada">
          Un agente es un especialista al que la IA le delega una tarea completa: tiene sus propias instrucciones, herramientas y skills. Las automatizaciones, en cambio, corren solas en tu equipo y trabajan sobre tus vaults.
        </p>
      </header>

      {datos.error && <p className="vacio">{datos.error}</p>}

      {porIA.map(([nombreIA, agentes]) => (
        <section key={nombreIA} className="grupo-agentes">
          <header>
            <span className="grupo-punto" style={{ background: colorIA(nombreIA) }} />
            <h2 className="display">Agentes de {nombreIA}</h2>
            <span className="mono">{agentes.length}</span>
          </header>
          <div className="rejilla-agentes">
            {agentes.map((a, i) => (
              <a key={a.id} href={rutaAgente(a.id)} className="tarjeta-agente" style={{ ['--ia' as string]: colorIA(a.ia), animationDelay: `${i * 0.04}s` }}>
                <span className="tarjeta-agente-icono">
                  <Bot size={18} />
                </span>
                <span className="tarjeta-agente-nombre mono">{a.nombre}</span>
                <span className="tarjeta-agente-ambito rotulo">{a.ambito}</span>
                <span className="tarjeta-agente-que">{a.que[0] ?? a.descripcion}</span>
                <span className="tarjeta-agente-pie mono">
                  {a.skills.length} skills · {a.herramientas.length ? `${a.herramientas.length} herramientas` : 'todas las herramientas'} · {a.modelo}
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}

      {autos.length > 0 && (
        <section className="grupo-agentes">
          <header>
            <span className="grupo-punto" style={{ background: colorIA('launchd') }} />
            <h2 className="display">Automatizaciones del sistema</h2>
            <span className="mono">{autos.length}</span>
          </header>
          <div className="rejilla-agentes">
            {autos.map((a) => (
              <a key={a.id} href={rutaAgente(a.id)} className="tarjeta-agente automatizacion" style={{ ['--ia' as string]: colorIA(a.ia) }}>
                <span className="tarjeta-agente-icono">
                  <Clock size={18} />
                </span>
                <span className="tarjeta-agente-nombre mono">{a.nombre}</span>
                <span className="tarjeta-agente-ambito rotulo">
                  {a.programacion ? `cron ${a.programacion}` : intervalo(a.intervalo)}
                  {a.vigila.length ? ` · vigila ${a.vigila.length} carpetas` : ''}
                </span>
                <span className="tarjeta-agente-que">{a.descripcion}</span>
              </a>
            ))}
          </div>
          {atlas.vaults.length > 0 && (
            <p className="nota-al-pie">
              Así encaja todo: <a href="#/sistema">mira cómo trabaja el sistema completo</a>.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function AgenteDetalle({ atlas, id }: { atlas: Atlas; id: string }) {
  const datos = useDatos('agentes', cargarAgentes);
  const skills = useDatos('skills', cargarSkills);
  const a: Agente | undefined = datos.datos?.agentes.find((x) => x.id === id);

  useEffect(() => {
    if (a) registrarReciente({ tipo: 'agente', id: a.id, titulo: a.nombre, contexto: `${a.tipo === 'ia' ? 'agente' : 'automatización'} · ${a.ia}`, destino: rutaAgente(a.id), color: '#86efac' });
  }, [a]);

  if (!datos.datos) return <div className="pantalla-estado cargando"><p className="rotulo">Abriendo agente…</p></div>;
  if (!a)
    return (
      <div className="pagina">
        <a className="volver" href="#/agentes">
          <ArrowLeft size={15} /> Todos los agentes
        </a>
        <p className="vacio">No encuentro ese agente.</p>
      </div>
    );

  const descripcionSkill = (nombre: string) => skills.datos?.skills.find((s) => s.nombre === nombre)?.que[0];

  return (
    <div className="pagina ficha">
      <a className="volver" href="#/agentes">
        <ArrowLeft size={15} /> Todos los agentes
      </a>
      <header className="ficha-cabecera">
        <p className="rotulo">
          {a.tipo === 'ia' ? `Agente de ${a.ia}` : 'Automatización'} · {a.ambito}
        </p>
        <h1 className="display">{a.nombre}</h1>
        <p className="ficha-id mono">{corto(a.ruta)}</p>
      </header>

      {a.tipo === 'ia' ? (
        <div className="ficha-columnas">
          <div className="ficha-principal">
            <section className="bloque">
              <h2 className="rotulo">Para qué sirve</h2>
              <div className="para-que">
                {(a.que.length ? a.que : [a.descripcion]).map((o, i) => (
                  <p key={i} className={i === 0 ? 'destacado' : ''}>
                    {o}
                  </p>
                ))}
              </div>
            </section>
            {a.cuando.length > 0 && (
              <section className="bloque">
                <h2 className="rotulo">Cuándo se le delega</h2>
                <ul className="lista-limpia">{a.cuando.map((o, i) => <li key={i}>{o}</li>)}</ul>
              </section>
            )}
            <section className="bloque">
              <h2 className="rotulo">Cómo trabaja</h2>
              <Pipeline
                pasos={[
                  { titulo: 'Pides algo', detalle: a.activadores.length ? `Por ejemplo: ${a.activadores.slice(0, 4).map((x) => `«${x}»`).join(', ')}.` : 'Tu pedido coincide con su descripción, o lo pides por nombre.' },
                  { titulo: `${a.ia} delega`, detalle: `La sesión principal reconoce la tarea y se la entrega a «${a.nombre}» con un contexto propio, separado de la conversación.` },
                  {
                    titulo: 'Trabaja con sus herramientas',
                    cifra: a.herramientas.length ? `${a.herramientas.length}` : 'todas',
                    detalle: a.herramientas.length ? (
                      <span className="activadores">
                        {a.herramientas.map((h) => (
                          <span key={h} className="activador mono">
                            {h}
                          </span>
                        ))}
                      </span>
                    ) : (
                      'Hereda todas las herramientas de la sesión.'
                    ),
                  },
                  {
                    titulo: 'Carga sus skills',
                    cifra: a.skills.length ? `${a.skills.length}` : undefined,
                    apagado: !a.skills.length,
                    detalle: a.skills.length ? (
                      <span className="activadores">
                        {a.skills.map((s) => (
                          <a key={s} href={rutaSkill(s)} className="activador enlace mono">
                            {s}
                          </a>
                        ))}
                      </span>
                    ) : (
                      'No menciona skills concretas.'
                    ),
                  },
                  { titulo: 'Devuelve el resultado', detalle: `Modelo: ${a.modelo}. El resultado vuelve a la conversación principal.` },
                ]}
              />
            </section>
            <section className="bloque">
              <h2 className="rotulo">Instrucciones completas</h2>
              <Markdown texto={a.cuerpo} />
            </section>
          </div>
          <aside className="ficha-lateral">
            <section className="lateral-bloque">
              <h2 className="rotulo">
                <Cpu size={12} /> Modelo
              </h2>
              <p>{a.modelo}</p>
            </section>
            {a.herramientas.length > 0 && (
              <section className="lateral-bloque">
                <h2 className="rotulo">
                  <Wrench size={12} /> Herramientas
                </h2>
                <div className="chips">
                  {a.herramientas.map((h) => (
                    <span key={h} className="chip mono">
                      {h}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {a.skills.length > 0 && (
              <section className="lateral-bloque">
                <h2 className="rotulo">Skills que usa</h2>
                <ul className="skills-agente">
                  {a.skills.map((s) => (
                    <li key={s}>
                      <a href={rutaSkill(s)}>
                        <span className="mono">{s}</span>
                        {descripcionSkill(s) && <span>{descripcionSkill(s)}</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {a.notas.length > 0 && (
              <section className="lateral-bloque">
                <h2 className="rotulo">
                  <FileText size={12} /> Notas en Obsidian
                </h2>
                <ul className="notas-relacionadas">
                  {a.notas.map((ref) => {
                    const v = vaultPorNombre(atlas, ref.v);
                    return v ? (
                      <li key={ref.id}>
                        <a href={rutaVault(v.slug, ref.id)} style={{ ['--vault' as string]: v.color }}>
                          <span className="relacion-punto" />
                          {ref.t}
                        </a>
                      </li>
                    ) : null;
                  })}
                </ul>
              </section>
            )}
          </aside>
        </div>
      ) : (
        <div className="ficha-columnas">
          <div className="ficha-principal">
            <section className="bloque">
              <h2 className="rotulo">Qué hace</h2>
              <div className="para-que">
                <p className="destacado">{a.descripcion}</p>
              </div>
            </section>
            <section className="bloque">
              <h2 className="rotulo">Cómo trabaja</h2>
              <Pipeline
                pasos={[
                  {
                    titulo: `${a.ia} lo despierta`,
                    cifra: a.programacion ? `cron ${a.programacion}` : intervalo(a.intervalo),
                    detalle: `${a.ambito}: se ejecuta ${a.programacion ? `según la programación «${a.programacion}»` : intervalo(a.intervalo)}${a.alIniciar ? ' y al iniciar sesión' : ''}${a.vigila.length ? `, y también cuando cambia algo en ${a.vigila.join(', ')}` : ''}.`,
                  },
                  { titulo: 'Corre el script', detalle: <span className="mono">{corto(a.script)}</span> },
                  { titulo: 'Deja registro', detalle: a.logs.length ? a.logs.map((l) => <span key={l} className="mono bloque-linea">{corto(l)}</span>) : 'Sin archivo de registro.' },
                ]}
              />
            </section>
            {a.detalle && (
              <section className="bloque">
                <h2 className="rotulo">Detalle del script</h2>
                <pre className="detalle-script mono">{a.detalle}</pre>
              </section>
            )}
          </div>
          <aside className="ficha-lateral">
            <section className="lateral-bloque">
              <h2 className="rotulo">
                <Clock size={12} /> Frecuencia
              </h2>
              <p>{a.programacion ? `cron ${a.programacion}` : intervalo(a.intervalo)}</p>
            </section>
            {a.vigila.length > 0 && (
              <section className="lateral-bloque">
                <h2 className="rotulo">
                  <Eye size={12} /> Vigila
                </h2>
                <div className="chips">
                  {a.vigila.map((v) => {
                    const vault = atlas.vaults.find((x) => x.nombre === v);
                    return vault ? (
                      <a key={v} className="chip" href={rutaVault(vault.slug)}>
                        <span className="chip-punto" style={{ background: vault.color }} />
                        {v}
                      </a>
                    ) : (
                      <span key={v} className="chip">
                        {v}
                      </span>
                    );
                  })}
                </div>
              </section>
            )}
            <section className="lateral-bloque">
              <h2 className="rotulo">Pausar y reactivar</h2>
              {a.pausar.map((c) => (
                <pre key={c} className="mono comando">
                  {corto(c)}
                </pre>
              ))}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
