// Catálogo de skills: por categoría, con filtros por IA, origen y paquete, o como
// red (qué skill menciona a cuál y qué agentes las usan).
import { ChevronDown, LayoutGrid, Network, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { EnlaceGrafo, NodoGrafo } from '../componentes/Grafo';
import { cargarAgentes, cargarSkills, useDatos } from '../lib/datos';
import { AYUDA_IA, colorIA, inicialIA, n, PALETA } from '../lib/formato';
import { recomendador } from '../lib/recomendar';
import { navegar, rutaAgente, rutaSkill } from '../lib/rutas';
import { coloresCanvas, tono, useTema } from '../lib/tema';
import type { Atlas, Skill } from '../lib/tipos';
import SkillDetalle from './SkillDetalle';

const Grafo = lazy(() => import('../componentes/Grafo'));

const sinAcentos = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Una insignia por cada IA del equipo: encendida si la skill está instalada en ella. */
export function InsigniasIA({ ias, todas }: { ias: string[]; todas: string[] }) {
  return (
    <span className="insignias-ia">
      {todas.map((ia) => (
        <span key={ia} className={`insignia-ia ${ias.includes(ia) ? '' : 'ausente'}`} style={{ ['--ia' as string]: colorIA(ia) }} title={`${ia}: ${ias.includes(ia) ? 'instalada' : 'no instalada'}`}>
          {inicialIA(ia)}
        </span>
      ))}
    </span>
  );
}

export default function Skills({ atlas, skill, categoria, usoInicial = null }: { atlas: Atlas; skill: string | null; categoria: string | null; usoInicial?: 'usadas' | 'nunca' | null }) {
  const tema = useTema();
  const colores = coloresCanvas(tema);
  const datos = useDatos('skills', cargarSkills);
  const agentes = useDatos('agentes', cargarAgentes);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(categoria);
  const [ia, setIa] = useState<string | null>(null);
  const [origen, setOrigen] = useState<string | null>(null);
  const [paquete, setPaquete] = useState<string | null>(null);
  const [vista, setVista] = useState<'tarjetas' | 'red'>('tarjetas');
  const [verPlugins, setVerPlugins] = useState(false);
  const [masFiltros, setMasFiltros] = useState(false);
  const [uso, setUso] = useState<'usadas' | 'nunca' | null>(usoInicial);

  useEffect(() => setCat(categoria), [categoria]);
  useEffect(() => setUso(usoInicial), [usoInicial]);

  const colorCategoria = useMemo(() => {
    const m = new Map<string, string>();
    const porTamano = [...(datos.datos?.categorias ?? [])].sort(
      (a, b) => (datos.datos?.skills.filter((s) => s.categoria === b).length ?? 0) - (datos.datos?.skills.filter((s) => s.categoria === a).length ?? 0),
    );
    porTamano.forEach((c, i) => m.set(c, PALETA[i % PALETA.length]));
    return (c: string) => tono(m.get(c) ?? '#a8a59b', tema);
  }, [datos.datos, tema]);

  // Con texto, el orden es por cuánto encaja la skill con lo que pides (con el
  // motivo); sin texto, por categoría.
  const motivos = useMemo(() => {
    const lista = datos.datos?.skills;
    if (!lista || q.trim().length < 3) return null;
    return new Map(recomendador(lista)(q, 40).map((r) => [r.skill.id, r.razon]));
  }, [datos.datos, q]);

  const filtradas = useMemo(() => {
    const lista = datos.datos?.skills ?? [];
    const consulta = sinAcentos(q.trim());
    const pasa = (s: Skill) =>
      (!cat || s.categoria === cat) &&
      (!ia || s.ias.includes(ia)) &&
      (!origen || s.origen === origen) &&
      (!paquete || s.paquete === paquete) &&
      (!uso || (uso === 'usadas' ? Boolean(s.uso) : !s.uso));
    if (!consulta) return lista.filter(pasa);
    const porTexto = lista.filter((s) => pasa(s) && sinAcentos(`${s.nombre} ${s.titulo} ${s.descripcion} ${s.paquete ?? ''}`).includes(consulta));
    const recomendadas = [...(motivos?.keys() ?? [])].map((id) => lista.find((s) => s.id === id)!).filter((s) => s && pasa(s));
    return [...recomendadas, ...porTexto.filter((s) => !motivos?.has(s.id))];
  }, [datos.datos, q, cat, ia, origen, paquete, uso, motivos]);

  const grupos = useMemo(() => {
    const m = new Map<string, Skill[]>();
    for (const s of filtradas) m.set(s.categoria, [...(m.get(s.categoria) ?? []), s]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtradas]);

  const red = useMemo(() => {
    const nodos: NodoGrafo[] = [];
    const enlaces: EnlaceGrafo[] = [];
    const ids = new Set(filtradas.map((s) => s.id));
    for (const [c] of grupos) nodos.push({ id: `cat:${c}`, etiqueta: c, color: colorCategoria(c), radio: 10, tipo: 'categoria', fija: true });
    for (const s of filtradas) {
      nodos.push({ id: s.id, etiqueta: s.nombre, color: colorCategoria(s.categoria), radio: s.origen === 'propia' ? 5.5 : 3 + Math.min(4, s.relacionadas.length * 0.35), tipo: 'nota', fija: s.origen === 'propia' });
      enlaces.push({ source: `cat:${s.categoria}`, target: s.id, tipo: 'arbol' });
      for (const r of s.relacionadas) if (ids.has(r)) enlaces.push({ source: s.id, target: r, tipo: 'enlace' });
    }
    for (const a of agentes.datos?.agentes ?? []) {
      if (a.tipo !== 'ia') continue;
      const usadas = a.skills.filter((s) => ids.has(s));
      if (!usadas.length) continue;
      nodos.push({ id: `agente:${a.id}`, etiqueta: a.nombre, color: tono('#86efac', tema), radio: 7, tipo: 'agente', fija: true });
      for (const s of usadas) enlaces.push({ source: `agente:${a.id}`, target: s, tipo: 'enlace' });
    }
    return { nodos, enlaces };
  }, [filtradas, grupos, agentes.datos, colorCategoria, tema]);

  if (skill) return <SkillDetalle atlas={atlas} nombre={skill} />;

  const d = datos.datos;
  const propias = d?.skills.filter((s) => s.origen === 'propia').length ?? 0;
  const todasLasIAs = d?.ias ?? [];
  const iasReales = todasLasIAs.filter((x) => x !== 'Compartidas' && x !== 'Extra');
  const hayFiltros = q || cat || ia || origen || paquete || uso;
  const filtrosOcultos = [ia, origen, paquete, uso].filter(Boolean).length;
  const limpiar = () => {
    setQ('');
    setCat(null);
    setIa(null);
    setOrigen(null);
    setPaquete(null);
    setUso(null);
  };
  const hayUso = Boolean(atlas.sistema.uso?.activo && d?.skills.some((s) => s.uso));
  const masUsadas = hayUso && !hayFiltros ? [...(d?.skills ?? [])].filter((s) => s.uso).sort((a, b) => b.uso!.total - a.uso!.total).slice(0, 8) : [];

  return (
    <div className="pagina skills">
      <header className="pagina-cabecera">
        <p className="rotulo">Arsenal · {d ? `${n(d.totalInstalaciones)} instalaciones en ${iasReales.length} ${iasReales.length === 1 ? 'IA' : 'IAs'}` : '…'}</p>
        <h1 className="display">
          {d ? n(d.skills.length) : '…'} skills, <em>cada una con su oficio</em>
        </h1>
        <p className="pagina-bajada">
          Una skill es un manual que la IA carga cuando tu pedido coincide con su descripción. Aquí ves qué hace cada una, cuándo se activa, qué archivos lee y con qué otras piezas trabaja.
          {propias > 0 && ` ${propias} son tuyas.`}
        </p>
      </header>

      <div className="filtros">
        <div className="filtros-fila">
          <label className="filtro grande">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿Qué necesitas hacer? Escríbelo con tus palabras: «un video de lanzamiento», «cobrar con tarjeta»…" aria-label="Qué necesitas hacer" />
            {q && (
              <button className="filtro-limpiar" onClick={() => setQ('')} aria-label="Quitar búsqueda">
                <X size={13} />
              </button>
            )}
          </label>
          <div className="conmutador" role="tablist" aria-label="Forma de ver las skills">
            <button role="tab" aria-selected={vista === 'tarjetas'} className={vista === 'tarjetas' ? 'activo' : ''} onClick={() => setVista('tarjetas')}>
              <LayoutGrid size={14} /> <span className="conmutador-texto">Tarjetas</span>
            </button>
            <button role="tab" aria-selected={vista === 'red'} className={vista === 'red' ? 'activo' : ''} onClick={() => setVista('red')}>
              <Network size={14} /> <span className="conmutador-texto">Red</span>
            </button>
          </div>
        </div>
        <div className="filtros-fila una-linea">
          <button className={`chip ${cat === null ? 'activo' : ''}`} onClick={() => setCat(null)}>
            Todas
          </button>
          {d?.categorias.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'activo' : ''}`} onClick={() => setCat(cat === c ? null : c)}>
              <span className="chip-punto" style={{ background: colorCategoria(c) }} />
              {c}
              <span className="mono">{d.skills.filter((s) => s.categoria === c).length}</span>
            </button>
          ))}
        </div>
        <div className="filtros-fila">
          <button className={`chip ${masFiltros || filtrosOcultos ? 'activo' : ''}`} onClick={() => setMasFiltros((x) => !x)} aria-expanded={masFiltros}>
            <SlidersHorizontal size={13} /> Más filtros{filtrosOcultos ? ` · ${filtrosOcultos}` : ''} <ChevronDown size={13} className={masFiltros ? 'girado' : ''} />
          </button>
          {hayFiltros && (
            <button className="chip limpiar" onClick={limpiar}>
              Quitar filtros
            </button>
          )}
          {d && <span className="mono filtros-cuenta">{q ? `${filtradas.length} que encajan` : `${filtradas.length} de ${d.skills.length}`}</span>}
        </div>
        {masFiltros && (
          <div className="filtros-mas">
            <div className="filtros-fila">
              <span className="rotulo">IA</span>
              {todasLasIAs.map((x) => (
                <button key={x} className={`chip ${ia === x ? 'activo' : ''}`} onClick={() => setIa(ia === x ? null : x)} title={AYUDA_IA[x]}>
                  <span className="chip-punto" style={{ background: colorIA(x) }} />
                  {x}
                </button>
              ))}
            </div>
            <div className="filtros-fila">
              <span className="rotulo">Origen</span>
              {[
                ['propia', 'Propias'],
                ['instalada', 'Instaladas'],
                ['plugin', 'De plugins'],
                ['sistema', 'Sistema'],
              ]
                .filter(([v]) => d?.skills.some((x) => x.origen === v))
                .map(([v, e]) => (
                  <button key={v} className={`chip ${origen === v ? 'activo' : ''}`} onClick={() => setOrigen(origen === v ? null : v)}>
                    {v === 'propia' && <Star size={12} />}
                    {e}
                  </button>
                ))}
            </div>
            {hayUso && (
              <div className="filtros-fila">
                <span className="rotulo">Uso</span>
                <button className={`chip ${uso === 'usadas' ? 'activo' : ''}`} onClick={() => setUso(uso === 'usadas' ? null : 'usadas')}>
                  Las que usas
                </button>
                <button className={`chip ${uso === 'nunca' ? 'activo' : ''}`} onClick={() => setUso(uso === 'nunca' ? null : 'nunca')} title={`Sin uso en los últimos ${atlas.sistema.uso?.dias ?? 180} días`}>
                  Nunca usadas
                </button>
              </div>
            )}
            {d && d.paquetes.length > 0 && (
              <div className="filtros-fila">
                <span className="rotulo">Paquete</span>
                {d.paquetes
                  .filter((p) => !p.nombre.startsWith('Plugin ') || verPlugins || paquete === p.nombre)
                  .map((p) => (
                    <button key={p.nombre} className={`chip ${paquete === p.nombre ? 'activo' : ''}`} onClick={() => setPaquete(paquete === p.nombre ? null : p.nombre)} title={p.descripcion}>
                      {p.nombre} <span className="mono">{p.skills.length}</span>
                    </button>
                  ))}
                {d.paquetes.some((p) => p.nombre.startsWith('Plugin ')) && (
                  <button className="chip limpiar" onClick={() => setVerPlugins((x) => !x)} aria-expanded={verPlugins}>
                    {verPlugins ? 'Ocultar plugins' : `Plugins · ${d.paquetes.filter((p) => p.nombre.startsWith('Plugin ')).length}`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {datos.error && <p className="vacio">{datos.error}</p>}
      {d && filtradas.length === 0 && <p className="vacio">Ninguna skill coincide con esos filtros.</p>}

      {d && vista === 'tarjetas' && q.trim() && filtradas.length > 0 && (
        <section className="grupo-skills">
          <header>
            <span className="grupo-punto" />
            <h2 className="display">Las que mejor encajan</h2>
            <span className="mono">{filtradas.length}</span>
          </header>
          <div className="rejilla-skills">
            {filtradas.map((s, i) => (
              <TarjetaSkill key={s.id} s={s} indice={i} todas={todasLasIAs} motivo={motivos?.get(s.id)} />
            ))}
          </div>
        </section>
      )}

      {d && vista === 'tarjetas' && masUsadas.length > 0 && (
        <section className="grupo-skills mas-usadas">
          <header>
            <span className="grupo-punto" />
            <h2 className="display">Las que más usas</h2>
            <span className="mono">últimos {atlas.sistema.uso?.dias ?? 180} días</span>
          </header>
          <div className="rejilla-skills">
            {masUsadas.map((s, i) => (
              <TarjetaSkill key={s.id} s={s} indice={i} todas={todasLasIAs} />
            ))}
          </div>
        </section>
      )}

      {d && vista === 'tarjetas' && !q.trim() && (
        <div className="grupos-skills">
          {grupos.map(([categoriaGrupo, lista]) => (
            <section key={categoriaGrupo} className="grupo-skills" style={{ ['--cat' as string]: colorCategoria(categoriaGrupo) }}>
              <header>
                <span className="grupo-punto" />
                <h2 className="display">{categoriaGrupo}</h2>
                <span className="mono">{lista.length}</span>
              </header>
              <div className="rejilla-skills">
                {lista.map((s, i) => (
                  <TarjetaSkill key={s.id} s={s} indice={i} todas={todasLasIAs} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {d && vista === 'red' && (
        <div className="red-skills">
          <Suspense fallback={null}>
          <Grafo
            clave={`skills|${q}|${cat}|${ia}|${origen}|${paquete}|${tema}|${agentes.datos ? 1 : 0}`}
            nodos={red.nodos}
            enlaces={red.enlaces}
            colorTexto={colores.texto}
            colorLinea={colores.linea}
            colorEnlace={colores.enlace}
            colorFondo={colores.fondo}
            distancia={(e) => (e.tipo === 'arbol' ? 40 : 70)}
            fuerza={(e) => (e.tipo === 'arbol' ? 0.5 : 0.06)}
            carga={(nodo) => (nodo.tipo === 'categoria' ? -300 : nodo.tipo === 'agente' ? -120 : -40)}
            onClic={(nodo) => {
              if (nodo.tipo === 'nota') navegar(rutaSkill(nodo.id));
              else if (nodo.tipo === 'agente') navegar(rutaAgente(nodo.id.slice(7)));
              else if (nodo.tipo === 'categoria') setCat(nodo.id.slice(4));
            }}
          />
          </Suspense>
          <p className="grafo-ayuda mono">círculos: skills · anillos: categorías · rombos: agentes · líneas: una menciona a la otra</p>
        </div>
      )}
    </div>
  );
}

function TarjetaSkill({ s, indice, todas, motivo }: { s: Skill; indice: number; todas: string[]; motivo?: string }) {
  return (
    <a href={rutaSkill(s.nombre)} className={`tarjeta-skill ${s.origen}`} style={{ animationDelay: `${Math.min(indice, 20) * 0.025}s` }}>
      <span className="tarjeta-skill-cabeza">
        <span className="tarjeta-skill-nombre mono">{s.nombre}</span>
        {s.origen === 'propia' && (
          <span className="insignia propia">
            <Star size={10} /> tuya
          </span>
        )}
        {s.uso && (
          <span className="insignia uso" title={`Último uso ${new Date(s.uso.ultimo).toLocaleDateString('es-GT')}`}>
            {s.uso.total} {s.uso.total === 1 ? 'uso' : 'usos'}
          </span>
        )}
      </span>
      {motivo ? <span className="tarjeta-skill-que motivo">{motivo}</span> : <span className="tarjeta-skill-que">{s.que[0] ?? s.descripcion}</span>}
      <span className="tarjeta-skill-pie">
        <InsigniasIA ias={s.ias} todas={todas} />
        <span className="mono">
          {s.archivos.filter((a) => a.k === 'referencias').length} ref · {s.archivos.filter((a) => a.k === 'scripts').length} scripts
        </span>
        {s.paquete && <span className="mono paquete">{s.paquete}</span>}
      </span>
    </a>
  );
}
