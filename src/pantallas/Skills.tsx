// Catálogo de skills: por categoría, con filtros por IA, origen y paquete, o como
// red (qué skill menciona a cuál y qué agentes las usan).
import { LayoutGrid, Network, Search, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Grafo, { type EnlaceGrafo, type NodoGrafo } from '../componentes/Grafo';
import { cargarAgentes, cargarSkills, useDatos } from '../lib/datos';
import { COLOR_IA, INICIAL_IA, n, PALETA } from '../lib/formato';
import { navegar, rutaAgente, rutaSkill } from '../lib/rutas';
import { coloresCanvas, tono, useTema } from '../lib/tema';
import type { Atlas, Skill } from '../lib/tipos';
import SkillDetalle from './SkillDetalle';

const sinAcentos = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function InsigniasIA({ ias }: { ias: string[] }) {
  return (
    <span className="insignias-ia">
      {['Claude', 'Codex', 'Antigravity'].map((ia) => (
        <span key={ia} className={`insignia-ia ${ias.includes(ia) ? '' : 'ausente'}`} style={{ ['--ia' as string]: COLOR_IA[ia] }} title={`${ia}: ${ias.includes(ia) ? 'instalada' : 'no instalada'}`}>
          {INICIAL_IA[ia]}
        </span>
      ))}
    </span>
  );
}

export default function Skills({ atlas, skill, categoria }: { atlas: Atlas; skill: string | null; categoria: string | null }) {
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

  useEffect(() => setCat(categoria), [categoria]);

  const colorCategoria = useMemo(() => {
    const m = new Map<string, string>();
    const porTamano = [...(datos.datos?.categorias ?? [])].sort(
      (a, b) => (datos.datos?.skills.filter((s) => s.categoria === b).length ?? 0) - (datos.datos?.skills.filter((s) => s.categoria === a).length ?? 0),
    );
    porTamano.forEach((c, i) => m.set(c, PALETA[i % PALETA.length]));
    return (c: string) => tono(m.get(c) ?? '#a8a59b', tema);
  }, [datos.datos, tema]);

  const filtradas = useMemo(() => {
    const lista = datos.datos?.skills ?? [];
    const consulta = sinAcentos(q.trim());
    return lista.filter(
      (s) =>
        (!cat || s.categoria === cat) &&
        (!ia || s.ias.includes(ia)) &&
        (!origen || s.origen === origen) &&
        (!paquete || s.paquete === paquete) &&
        (!consulta || sinAcentos(`${s.nombre} ${s.titulo} ${s.descripcion} ${s.paquete ?? ''}`).includes(consulta)),
    );
  }, [datos.datos, q, cat, ia, origen, paquete]);

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
  const hayFiltros = q || cat || ia || origen || paquete;

  return (
    <div className="pagina skills">
      <header className="pagina-cabecera">
        <p className="rotulo">Arsenal · {d ? `${n(d.totalInstalaciones)} instalaciones en 3 IAs` : '…'}</p>
        <h1 className="display">
          {d ? n(d.skills.length) : '…'} skills, <em>cada una con su oficio</em>
        </h1>
        <p className="pagina-bajada">
          Una skill es un manual que la IA carga cuando tu pedido coincide con su descripción. Aquí ves qué hace cada una, cuándo se activa, qué archivos lee y con qué otras piezas trabaja.
          {propias > 0 && ` ${propias} son tuyas.`}
        </p>
      </header>

      <div className="filtros">
        <label className="filtro grande">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nombre o por lo que necesitas: «video», «stripe», «landing»…" />
        </label>
        <div className="filtros-fila">
          <span className="rotulo">IA</span>
          {['Claude', 'Codex', 'Antigravity'].map((x) => (
            <button key={x} className={`chip ${ia === x ? 'activo' : ''}`} onClick={() => setIa(ia === x ? null : x)}>
              <span className="chip-punto" style={{ background: COLOR_IA[x] }} />
              {x}
            </button>
          ))}
          <span className="rotulo separado">Origen</span>
          {[
            ['propia', 'Propias'],
            ['instalada', 'Instaladas'],
            ['sistema', 'Sistema'],
          ].map(([v, e]) => (
            <button key={v} className={`chip ${origen === v ? 'activo' : ''}`} onClick={() => setOrigen(origen === v ? null : v)}>
              {v === 'propia' && <Star size={12} />}
              {e}
            </button>
          ))}
          <div className="conmutador derecha" role="tablist">
            <button role="tab" aria-selected={vista === 'tarjetas'} className={vista === 'tarjetas' ? 'activo' : ''} onClick={() => setVista('tarjetas')}>
              <LayoutGrid size={14} /> Tarjetas
            </button>
            <button role="tab" aria-selected={vista === 'red'} className={vista === 'red' ? 'activo' : ''} onClick={() => setVista('red')}>
              <Network size={14} /> Red
            </button>
          </div>
        </div>
        <div className="filtros-fila">
          <span className="rotulo">Categoría</span>
          {d?.categorias.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'activo' : ''}`} onClick={() => setCat(cat === c ? null : c)}>
              <span className="chip-punto" style={{ background: colorCategoria(c) }} />
              {c}
              <span className="mono">{d.skills.filter((s) => s.categoria === c).length}</span>
            </button>
          ))}
        </div>
        {d && d.paquetes.length > 0 && (
          <div className="filtros-fila">
            <span className="rotulo">Paquete</span>
            {d.paquetes.map((p) => (
              <button key={p.nombre} className={`chip ${paquete === p.nombre ? 'activo' : ''}`} onClick={() => setPaquete(paquete === p.nombre ? null : p.nombre)} title={p.descripcion}>
                {p.nombre} <span className="mono">{p.skills.length}</span>
              </button>
            ))}
            {hayFiltros && (
              <button
                className="chip limpiar"
                onClick={() => {
                  setQ('');
                  setCat(null);
                  setIa(null);
                  setOrigen(null);
                  setPaquete(null);
                }}
              >
                Quitar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {datos.error && <p className="vacio">{datos.error}</p>}
      {d && filtradas.length === 0 && <p className="vacio">Ninguna skill coincide con esos filtros.</p>}

      {d && vista === 'tarjetas' && (
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
                  <a key={s.id} href={rutaSkill(s.nombre)} className={`tarjeta-skill ${s.origen}`} style={{ animationDelay: `${Math.min(i, 20) * 0.025}s` }}>
                    <span className="tarjeta-skill-cabeza">
                      <span className="tarjeta-skill-nombre mono">{s.nombre}</span>
                      {s.origen === 'propia' && (
                        <span className="insignia propia">
                          <Star size={10} /> tuya
                        </span>
                      )}
                    </span>
                    <span className="tarjeta-skill-que">{s.que[0] ?? s.descripcion}</span>
                    <span className="tarjeta-skill-pie">
                      <InsigniasIA ias={s.ias} />
                      <span className="mono">
                        {s.archivos.filter((a) => a.k === 'referencias').length} ref · {s.archivos.filter((a) => a.k === 'scripts').length} scripts
                      </span>
                      {s.paquete && <span className="mono paquete">{s.paquete}</span>}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {d && vista === 'red' && (
        <div className="red-skills">
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
          <p className="grafo-ayuda mono">círculos: skills · anillos: categorías · rombos: agentes · líneas: una menciona a la otra</p>
        </div>
      )}
    </div>
  );
}
