// Ficha de una skill: para qué sirve, cuándo se activa, cómo trabaja paso a paso,
// qué archivos carga y con qué skills, agentes y notas se relaciona.
import { ArrowLeft, BookOpen, Check, Copy, ExternalLink, FileCode2, FileText, FolderTree, Package, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import EstrellaFavorito from '../componentes/EstrellaFavorito';
import Markdown from '../componentes/Markdown';
import Pipeline, { type Paso } from '../componentes/Pipeline';
import Visor from '../componentes/Visor';
import { vaultPorNombre } from '../lib/atlas';
import { cargarAgentes, cargarDetalleSkill, cargarSkills, useDatos } from '../lib/datos';
import { colorIA, corto, hace, inicialIA, n, tamano } from '../lib/formato';
import { registrarReciente } from '../lib/recientes';
import { rutaAgente, rutaSkill, rutaVault } from '../lib/rutas';
import { pedidoPara } from '../lib/recomendar';
import type { ArchivoSkill, Atlas, Skill } from '../lib/tipos';
import { InsigniasIA } from './Skills';

// Las claves del frontmatter son identificadores en inglés: se muestran en español.
const ETIQUETA_METADATO: Record<string, string> = {
  license: 'Licencia',
  version: 'Versión',
  'user-invocable': 'Se puede invocar',
  'argument-hint': 'Argumento',
  'allowed-tools': 'Herramientas permitidas',
  metadata: 'Metadatos',
  model: 'Modelo',
  compatibility: 'Compatibilidad',
  author: 'Autor',
  tags: 'Etiquetas',
  'disable-model-invocation': 'Solo manual',
};

const valorMetadato = (v: string) => (v === 'true' ? 'sí' : v === 'false' ? 'no' : v);

const ETIQUETA_TIPO: Record<ArchivoSkill['k'], string> = {
  referencias: 'Referencias',
  scripts: 'Scripts',
  recursos: 'Plantillas y recursos',
  otros: 'Otros archivos',
};

export default function SkillDetalle({ atlas, nombre }: { atlas: Atlas; nombre: string }) {
  const datos = useDatos('skills', cargarSkills);
  const agentes = useDatos('agentes', cargarAgentes);
  const skill = datos.datos?.skills.find((s) => s.nombre === nombre);
  const detalle = useDatos(skill ? `skill:${skill.archivoDetalle}` : null, () => cargarDetalleSkill(skill!.archivoDetalle));
  const [visor, setVisor] = useState<{ titulo: string; texto: string; subtitulo: string } | null>(null);
  const [completo, setCompleto] = useState(false);

  useEffect(() => {
    if (skill) registrarReciente({ tipo: 'skill', id: skill.id, titulo: skill.nombre, contexto: `skill · ${skill.categoria}`, destino: rutaSkill(skill.nombre), color: '#dcb56c' });
  }, [skill]);

  if (datos.cargando || !datos.datos) return <div className="pantalla-estado cargando"><p className="rotulo">Abriendo skill…</p></div>;
  if (!skill)
    return (
      <div className="pagina">
        <a className="volver" href="#/skills">
          <ArrowLeft size={15} /> Todas las skills
        </a>
        <p className="vacio">No encuentro la skill «{nombre}».</p>
      </div>
    );

  const refs = skill.archivos.filter((a) => a.k === 'referencias');
  const scripts = skill.archivos.filter((a) => a.k === 'scripts');
  const recursos = skill.archivos.filter((a) => a.k === 'recursos');
  const hermanas = skill.paquete ? datos.datos.skills.filter((s) => s.paquete === skill.paquete && s.nombre !== skill.nombre) : [];
  const hijas = datos.datos.skills.filter((s) => s.padre === skill.nombre);
  const agentesQueUsan = (agentes.datos?.agentes ?? []).filter((a) => skill.agentes.includes(a.id));

  const abrirArchivo = (ruta: string) => {
    const limpia = decodeURIComponent(ruta).replace(/^(\.\.?\/)+/, '').replace(/#.*$/, '');
    const refs = detalle.datos?.referencias ?? {};
    // Los enlaces dentro de una referencia son relativos a su carpeta: se busca por final de ruta.
    const clave = limpia in refs ? limpia : Object.keys(refs).find((k) => k.endsWith(`/${limpia}`));
    if (clave) setVisor({ titulo: clave, texto: refs[clave], subtitulo: `${skill.nombre} · referencia · texto original del archivo` });
  };

  const listaArchivos = (lista: ArchivoSkill[], max = 8) => (
    <ul className="archivos-paso">
      {lista.slice(0, max).map((a) => (
        <li key={a.r}>
          {detalle.datos?.referencias[a.r] !== undefined ? (
            <button onClick={() => abrirArchivo(a.r)}>
              <span className="mono">{a.r}</span>
              {a.t && <span className="archivo-titulo">{a.t}</span>}
            </button>
          ) : (
            <span className="mono">{a.r}</span>
          )}
        </li>
      ))}
      {lista.length > max && <li className="mono relaciones-mas">y {lista.length - max} más (ver «Archivos»)</li>}
    </ul>
  );

  const pasos: Paso[] = [
    {
      titulo: 'Pides algo',
      detalle: skill.activadores.length ? (
        <>
          Frases que la despiertan:
          <span className="activadores">
            {skill.activadores.slice(0, 10).map((a) => (
              <span key={a} className="activador">
                «{a}»
              </span>
            ))}
          </span>
        </>
      ) : (
        'Tu pedido coincide con su descripción o la invocas por nombre.'
      ),
    },
    {
      titulo: 'La IA la elige',
      cifra: skill.ias.join(' · '),
      detalle: `Compara tu pedido con la descripción de «${skill.nombre}». ${skill.cuando[0] ?? ''} También se puede llamar con /${skill.nombre}.`,
    },
    {
      titulo: 'Lee el manual',
      cifra: `${n(skill.palabras)} palabras`,
      detalle: skill.secciones.length ? `SKILL.md: ${skill.secciones.filter((s) => s.n === 2).slice(0, 6).map((s) => s.t).join(' · ')}` : 'SKILL.md con las instrucciones.',
    },
    {
      titulo: 'Consulta referencias',
      cifra: refs.length ? `${refs.length} archivos` : undefined,
      apagado: !refs.length,
      detalle: refs.length ? listaArchivos(refs, 6) : 'No trae referencias aparte: todo está en SKILL.md.',
    },
    {
      titulo: 'Ejecuta scripts',
      cifra: scripts.length ? `${scripts.length}` : undefined,
      apagado: !scripts.length,
      detalle: scripts.length ? listaArchivos(scripts, 6) : 'No ejecuta scripts propios; trabaja con las herramientas normales.',
    },
    {
      titulo: 'Usa plantillas y recursos',
      cifra: recursos.length ? `${recursos.length}` : undefined,
      apagado: !recursos.length,
      detalle: recursos.length ? listaArchivos(recursos, 5) : 'Sin plantillas.',
    },
    { titulo: 'Entrega', detalle: skill.que[0] ?? skill.descripcion },
  ];

  const porTipo = (['referencias', 'scripts', 'recursos', 'otros'] as const).map((k) => [k, skill.archivos.filter((a) => a.k === k)] as const).filter(([, l]) => l.length);

  return (
    <div className="pagina ficha">
      <a className="volver" href="#/skills">
        <ArrowLeft size={15} /> Todas las skills
      </a>

      <header className="ficha-cabecera">
        <p className="rotulo">
          {skill.categoria}
          {skill.paquete && ` · paquete ${skill.paquete}`}
          {skill.padre && ` · parte de ${skill.padre}`}
        </p>
        <h1 className="display">{skill.titulo !== skill.nombre ? skill.titulo : skill.nombre}</h1>
        <p className="ficha-id mono">
          /{skill.nombre}
          {skill.origen === 'propia' && (
            <span className="insignia propia">
              <Star size={10} /> tuya
            </span>
          )}
          {skill.origen === 'sistema' && <span className="insignia">sistema</span>}
          {skill.origen === 'plugin' && <span className="insignia">plugin</span>}
          <InsigniasIA ias={skill.ias} todas={datos.datos.ias} />
          <EstrellaFavorito item={{ tipo: 'skill', id: skill.id, titulo: skill.nombre, contexto: `skill · ${skill.categoria}`, destino: rutaSkill(skill.nombre), color: '#dcb56c' }} />
        </p>
      </header>

      <div className="ficha-columnas">
        <div className="ficha-principal">
          <section className="bloque">
            <h2 className="rotulo">Para qué sirve</h2>
            <div className="para-que">
              {(skill.que.length ? skill.que : [skill.descripcion]).map((o, i) => (
                <p key={i} className={i === 0 ? 'destacado' : ''}>
                  {o}
                </p>
              ))}
            </div>
          </section>

          {(skill.cuando.length > 0 || skill.noPara.length > 0) && (
            <section className="bloque dos">
              {skill.cuando.length > 0 && (
                <div>
                  <h2 className="rotulo">Cuándo se activa</h2>
                  <ul className="lista-limpia">{skill.cuando.map((o, i) => <li key={i}>{o}</li>)}</ul>
                </div>
              )}
              {skill.noPara.length > 0 && (
                <div className="no-para">
                  <h2 className="rotulo">Cuándo no usarla</h2>
                  <ul className="lista-limpia">{skill.noPara.map((o, i) => <li key={i}>{o}</li>)}</ul>
                </div>
              )}
            </section>
          )}

          <section className="bloque">
            <h2 className="rotulo">Cómo trabaja</h2>
            <Pipeline pasos={pasos} />
          </section>

          {skill.secciones.length > 0 && (
            <section className="bloque">
              <h2 className="rotulo">Qué hay dentro del manual · {skill.secciones.length} secciones</h2>
              <ol className="secciones-skill">
                {skill.secciones.map((s, i) => (
                  <li key={i} className={`nivel-${s.n}`}>
                    <h3>{s.t}</h3>
                    {s.r && <p>{s.r}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="bloque">
            <div className="bloque-titulo">
              <h2 className="rotulo">Manual completo · SKILL.md</h2>
              <button className="boton-secundario" onClick={() => setCompleto((x) => !x)}>
                <BookOpen size={14} /> {completo ? 'Ocultar' : 'Leer completo'}
              </button>
            </div>
            {completo && detalle.datos && !detalle.datos.traducido && (
              <p className="aviso-original">Texto original del archivo, tal como lo lee la IA. Su resumen en español está arriba, en «Qué hay dentro del manual».</p>
            )}
            {detalle.cargando && <div className="esqueleto" />}
            {completo && detalle.datos && <Markdown texto={detalle.datos.cuerpo} onRuta={abrirArchivo} className="skill-md" />}
          </section>
        </div>

        <aside className="ficha-lateral">
          <ComoPedirla skill={skill} />
          {atlas.sistema.uso?.activo && (
            <section className="lateral-bloque">
              <h2 className="rotulo">Uso</h2>
              {skill.uso ? (
                <p className="uso-skill">
                  <strong>
                    {n(skill.uso.total)} {skill.uso.total === 1 ? 'vez' : 'veces'}
                  </strong>{' '}
                  en los últimos {atlas.sistema.uso.dias} días · la última {hace(skill.uso.ultimo)}
                  <span className="mono">{Object.entries(skill.uso.ias).map(([ia, k]) => `${ia} ${k}`).join(' · ')}</span>
                </p>
              ) : (
                <p className="uso-skill">Ninguna IA la usó en los últimos {atlas.sistema.uso.dias} días.</p>
              )}
            </section>
          )}
          <section className="lateral-bloque">
            <h2 className="rotulo">Instalada en</h2>
            <ul className="instalaciones">
              {skill.instalaciones.map((i) => (
                <li key={`${i.ia}${i.ruta}`}>
                  <span className="insignia-ia" style={{ ['--ia' as string]: colorIA(i.ia) }}>
                    {inicialIA(i.ia)}
                  </span>
                  <span>
                    <strong>{i.ia}</strong>
                    <span className="mono ruta">{corto(i.ruta)}</span>
                    {i.real && <span className="mono ruta enlace">→ {corto(i.real)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {skill.repo && (
            <section className="lateral-bloque">
              <h2 className="rotulo">Repositorio</h2>
              {skill.repo.remoto ? (
                <a className="enlace-externo" href={skill.repo.remoto} target="_blank" rel="noopener noreferrer">
                  {skill.repo.remoto.replace(/^https:\/\/github\.com\//, '')} <ExternalLink size={13} />
                </a>
              ) : (
                <p className="mono ruta">{corto(skill.repo.raiz)}</p>
              )}
            </section>
          )}

          {(hermanas.length > 0 || hijas.length > 0) && (
            <section className="lateral-bloque">
              <h2 className="rotulo">
                <Package size={12} /> {hijas.length ? 'Sub-skills' : `Paquete ${skill.paquete}`}
              </h2>
              <div className="chips">
                {(hijas.length ? hijas : hermanas).map((s) => (
                  <a key={s.id} className="chip" href={rutaSkill(s.nombre)}>
                    {s.nombre}
                  </a>
                ))}
              </div>
            </section>
          )}

          {skill.relacionadas.length > 0 && (
            <section className="lateral-bloque">
              <h2 className="rotulo">Trabaja con</h2>
              <div className="chips">
                {skill.relacionadas.map((r) => (
                  <a key={r} className="chip" href={rutaSkill(r)}>
                    {r}
                  </a>
                ))}
              </div>
            </section>
          )}

          {agentesQueUsan.length > 0 && (
            <section className="lateral-bloque">
              <h2 className="rotulo">Agentes que la usan</h2>
              <div className="chips">
                {agentesQueUsan.map((a) => (
                  <a key={a.id} className="chip agente" href={rutaAgente(a.id)}>
                    {a.nombre}
                  </a>
                ))}
              </div>
            </section>
          )}

          {skill.notas.length > 0 && (
            <section className="lateral-bloque">
              <h2 className="rotulo">Notas en Obsidian</h2>
              <ul className="notas-relacionadas">
                {skill.notas.map((ref) => {
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

          {Object.keys(skill.extras).length > 0 && (
            <section className="lateral-bloque">
              <h2 className="rotulo">Metadatos</h2>
              <dl className="metadatos">
                {Object.entries(skill.extras).map(([k, v]) => (
                  <div key={k}>
                    <dt>{ETIQUETA_METADATO[k] ?? k}</dt>
                    <dd>{valorMetadato(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="lateral-bloque">
            <h2 className="rotulo">
              <FolderTree size={12} /> Archivos · {skill.archivos.length + 1}
            </h2>
            <ul className="arbol-archivos">
              <li>
                <FileText size={13} />
                <span className="mono">SKILL.md</span>
              </li>
              {porTipo.map(([k, lista]) => (
                <li key={k} className="grupo-archivos">
                  <span className="rotulo">{ETIQUETA_TIPO[k]}</span>
                  <ul>
                    {lista.slice(0, 40).map((a) => (
                      <li key={a.r}>
                        {k === 'scripts' ? <FileCode2 size={13} /> : <FileText size={13} />}
                        {detalle.datos?.referencias[a.r] !== undefined ? (
                          <button className="mono" onClick={() => abrirArchivo(a.r)}>
                            {a.r}
                          </button>
                        ) : (
                          <span className="mono">{a.r}</span>
                        )}
                        <span className="mono peso">{tamano(a.b)}</span>
                      </li>
                    ))}
                    {lista.length > 40 && <li className="mono relaciones-mas">y {lista.length - 40} más</li>}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {visor && <Visor {...visor} cerrar={() => setVisor(null)} onRuta={abrirArchivo} />}
    </div>
  );
}

/** El pedido listo para copiar en cualquier IA, y el atajo de Claude Code si aplica. */
function ComoPedirla({ skill }: { skill: Skill }) {
  const [copiado, setCopiado] = useState(false);
  const tarea = skill.activadores[0] ?? skill.que[0]?.replace(/\.$/, '').toLowerCase() ?? '';
  const pedido = pedidoPara(skill, tarea);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(pedido);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      /* el navegador no dejó copiar */
    }
  };
  const conBarra = skill.ias.includes('Claude') && skill.extras['user-invocable'] !== 'false';
  return (
    <section className="lateral-bloque como-pedirla">
      <h2 className="rotulo">Cómo pedirla</h2>
      <button className="pedido" onClick={copiar} title="Copiar el pedido">
        <span>{pedido}</span>
        {copiado ? <Check size={14} /> : <Copy size={14} />}
      </button>
      {conBarra && (
        <p className="mono como-pedirla-nota">
          En Claude Code también: <code>/{skill.nombre}</code>
        </p>
      )}
      {skill.activadores.length > 1 && <p className="como-pedirla-nota">O con tus palabras: «{skill.activadores[1]}»</p>}
    </section>
  );
}
