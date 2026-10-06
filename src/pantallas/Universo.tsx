// Vista inicial: el vault central es el sol; los demás orbitan y nacen de él.
// El anillo exterior es el zodiaco de skills (agrupadas por categoría) y agentes.
// Todo sale de los datos de cada equipo: 0, 1 o muchos vaults.
import { ArrowRight, BookOpen } from 'lucide-react';
import { useMemo, useState, type MouseEvent } from 'react';
import { cargarAgentes, cargarSkills, useDatos } from '../lib/datos';
import { vaultCentral } from '../lib/atlas';
import { colorTexto, enPalabras, hace, n, PALETA } from '../lib/formato';
import { navegar, rutaAgente, rutaSkill, rutaVault } from '../lib/rutas';
import { mezclar, tono, useTema } from '../lib/tema';
import type { Atlas, ResumenVault } from '../lib/tipos';

const W = 1500;
const H = 1000;
const CX = 750;
const CY = 500;
const ORBITA = { rx: 405, ry: 280 };
const ANILLO = { rx: 640, ry: 432 };
const R_CORE = 82;

const enElipse = (grados: number, rx: number, ry: number) => {
  const a = (grados * Math.PI) / 180;
  return { x: CX + rx * Math.cos(a), y: CY + ry * Math.sin(a), c: Math.cos(a), s: Math.sin(a) };
};

// Etiquetas del zodiaco: siguen la curva del anillo. Arriba van sobre un camino en
// sentido horario y abajo sobre uno antihorario, así nunca quedan de cabeza.
const ETIQUETA_ARRIBA = { rx: ANILLO.rx + 16, ry: ANILLO.ry + 16 };
const ETIQUETA_ABAJO = { rx: ANILLO.rx + 27, ry: ANILLO.ry + 27 };

function largoArco(desde: number, hasta: number, rx: number, ry: number) {
  const pasos = 240;
  const d = (hasta - desde) / pasos;
  let total = 0;
  for (let i = 0; i < pasos; i++) {
    const t = ((desde + d * (i + 0.5)) * Math.PI) / 180;
    total += Math.hypot(rx * Math.sin(t), ry * Math.cos(t)) * Math.abs((d * Math.PI) / 180);
  }
  return total;
}

function posicionEtiqueta(grados: number) {
  const a = ((grados % 360) + 360) % 360;
  const arriba = a > 180;
  const { rx, ry } = arriba ? ETIQUETA_ARRIBA : ETIQUETA_ABAJO;
  const perimetro = largoArco(0, 360, rx, ry);
  const recorrido = arriba ? largoArco(180, a, rx, ry) : largoArco(a, 180, rx, ry);
  return { arriba, offset: `${((recorrido / perimetro) * 100).toFixed(2)}%` };
}

// Tabla de largo de arco acumulado sobre el anillo, desde arriba en sentido horario.
const ARCO = (() => {
  const N = 1440;
  const acumulado = [0];
  let total = 0;
  for (let i = 0; i < N; i++) {
    const t = ((-90 + ((i + 0.5) * 360) / N) * Math.PI) / 180;
    total += Math.hypot(ANILLO.rx * Math.sin(t), ANILLO.ry * Math.cos(t)) * ((2 * Math.PI) / N);
    acumulado.push(total);
  }
  return { N, acumulado, total };
})();

function anguloEnArco(largo: number) {
  const { N, acumulado } = ARCO;
  let bajo = 0;
  let alto = N;
  while (alto - bajo > 1) {
    const medio = (bajo + alto) >> 1;
    if (acumulado[medio] <= largo) bajo = medio;
    else alto = medio;
  }
  const fraccion = (largo - acumulado[bajo]) / (acumulado[bajo + 1] - acumulado[bajo] || 1);
  return -90 + ((bajo + fraccion) * 360) / N;
}

const caminoElipse = (rx: number, ry: number, horario: boolean) =>
  `M${CX - rx},${CY} A${rx},${ry} 0 1 ${horario ? 1 : 0} ${CX + rx},${CY} A${rx},${ry} 0 1 ${horario ? 1 : 0} ${CX - rx},${CY}`;

interface Tip {
  x: number;
  y: number;
  titulo: string;
  texto: string;
  color: string;
}

export default function Universo({ atlas }: { atlas: Atlas }) {
  const tema = useTema();
  const skills = useDatos('skills', cargarSkills);
  const agentes = useDatos('agentes', cargarAgentes);
  const [foco, setFoco] = useState<string | null>(null);
  const [categoriaFoco, setCategoriaFoco] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const central = vaultCentral(atlas);
  // Sin vaults, el centro es simbólico y lleva a las skills.
  const core = central ?? { nombre: 'Atlas', slug: '', notas: 0, color: '#1d24f7', inicio: null, carpetas: { n: '', p: '', d: 0, t: 0, a: 0, h: [] } };
  const hijos = atlas.vaults.filter((v) => v !== central);
  const maxNotas = Math.max(...hijos.map((v) => v.notas), 1);
  // Con muchos vaults los planetas se achican para no chocar en la órbita.
  const factor = Math.min(1, 7 / Math.max(hijos.length, 1));
  const cerebro = atlas.sistema.memoria ? 'cerebro' : 'centro';

  const planetas = useMemo(
    () =>
      hijos.map((v, i) => {
        const p = enElipse(-90 + (360 * i) / hijos.length + 18, ORBITA.rx, ORBITA.ry);
        return { v, ...p, r: (21 + 33 * Math.sqrt(v.notas / maxNotas)) * factor };
      }),
    [hijos, maxNotas, factor],
  );
  const porNombre = new Map(planetas.map((p) => [p.v.nombre, p]));

  // Puentes sin dirección: A↔B suma ambos sentidos.
  const puentes = useMemo(() => {
    const m = new Map<string, { a: string; b: string; ida: number; vuelta: number }>();
    for (const p of atlas.puentes) {
      const [a, b] = [p.de, p.a].sort();
      const clave = `${a}|${b}`;
      const e = m.get(clave) ?? { a, b, ida: 0, vuelta: 0 };
      if (p.de === a) e.ida += p.n;
      else e.vuelta += p.n;
      m.set(clave, e);
    }
    return [...m.values()];
  }, [atlas.puentes]);

  // Zodiaco: skills por categoría + agentes, repartidos por el anillo.
  const zodiaco = useMemo(() => {
    if (!skills.datos) return { puntos: [], etiquetas: [] };
    const porCategoria = new Map<string, typeof skills.datos.skills>();
    for (const s of skills.datos.skills) {
      if (!porCategoria.has(s.categoria)) porCategoria.set(s.categoria, []);
      porCategoria.get(s.categoria)!.push(s);
    }
    const grupos = [...porCategoria.entries()].sort((a, b) => b[1].length - a[1].length);
    const listaAgentes = agentes.datos?.agentes ?? [];
    type Punto = { id: string; x: number; y: number; color: string; forma: 'skill' | 'propia' | 'agente' | 'auto'; destino: string; titulo: string; texto: string; categoria: string };
    const bloques: { categoria: string; texto: string; color: string; items: Omit<Punto, 'x' | 'y'>[] }[] = grupos.map(([categoria, lista], i) => ({
      categoria,
      texto: categoria,
      color: PALETA[i % PALETA.length],
      items: lista.map((s) => ({ id: s.id, color: PALETA[i % PALETA.length], forma: s.origen === 'propia' ? 'propia' : 'skill', destino: rutaSkill(s.nombre), titulo: s.nombre, texto: categoria, categoria })),
    }));
    if (listaAgentes.length) {
      bloques.push({
        categoria: 'Agentes',
        texto: 'Agentes',
        color: '#86efac',
        items: listaAgentes.map((a) => ({ id: a.id, color: '#86efac', forma: a.tipo === 'ia' ? 'agente' : 'auto', destino: rutaAgente(a.id), titulo: a.nombre, texto: a.tipo === 'ia' ? `Agente · ${a.ia}` : 'Automatización', categoria: 'Agentes' })),
      });
    }
    // Cada bloque ocupa lo que pida su nombre o sus puntos (lo mayor), medido en largo
    // de arco real del anillo; lo que sobra se reparte en proporción.
    const PASO_MIN = 11;
    const HUECO = 22;
    const necesidad = bloques.map((b) => Math.max(b.items.length * PASO_MIN, `${b.texto} · ${b.items.length}`.length * 7.4 + 24));
    const escala = (ARCO.total - HUECO * bloques.length) / necesidad.reduce((t, x) => t + x, 0);
    const puntos: Punto[] = [];
    const etiquetas: { texto: string; total: number; arriba: boolean; offset: string; color: string; categoria: string }[] = [];
    let recorrido = HUECO / 2;
    bloques.forEach((b, i) => {
      const largo = necesidad[i] * escala;
      b.items.forEach((item, j) => {
        const p = enElipse(anguloEnArco(recorrido + ((j + 0.5) * largo) / b.items.length), ANILLO.rx, ANILLO.ry);
        puntos.push({ ...item, x: p.x, y: p.y });
      });
      etiquetas.push({ texto: b.texto, total: b.items.length, ...posicionEtiqueta(anguloEnArco(recorrido + largo / 2)), color: b.color, categoria: b.categoria });
      recorrido += largo + HUECO;
    });
    return { puntos, etiquetas };
  }, [skills.datos, agentes.datos]);

  const mostrarTip = (e: MouseEvent, t: Omit<Tip, 'x' | 'y'>) => {
    const caja = (e.currentTarget as SVGElement).ownerSVGElement!.parentElement!.getBoundingClientRect();
    setTip({ ...t, x: e.clientX - caja.left, y: e.clientY - caja.top });
  };

  const vaultFoco = foco ? atlas.vaults.find((v) => v.nombre === foco) : null;
  const grosor = (total: number) => 0.8 + Math.log2(1 + total) * 0.55;
  const t = atlas.totales;

  return (
    <div className="universo">
      <section className="cielo" aria-label="Mapa de vaults">
        <div className="cielo-intro">
          <p className="rotulo">Atlas · {formatoFechaCorta(atlas.generado)}</p>
          <h1 className="display">
            Tu memoria,
            <br />
            <em>en un solo cielo.</em>
          </h1>
          <p className="cielo-bajada">
            {central ? (
              <>
                <strong>{central.nombre}</strong> es el {cerebro}
                {hijos.length === 0
                  ? ': toca el sol para entrar.'
                  : `: de él ${hijos.length === 1 ? 'nace el otro vault' : `nacen los otros ${enPalabras(hijos.length)} vaults`}. Toca un planeta para entrar.`}{' '}
                El anillo exterior son tus skills y agentes.
              </>
            ) : (
              <>Todavía no hay vaults de Obsidian en este equipo: el anillo muestra tus skills y agentes. Para sumar uno, pídele a tu IA que lo agregue al atlas.</>
            )}
          </p>
          <dl className="cifras">
            <div>
              <dt>notas</dt>
              <dd>{n(t.notas)}</dd>
            </div>
            <div>
              <dt>enlaces</dt>
              <dd>{n(t.enlaces)}</dd>
            </div>
            <div>
              <dt>puentes</dt>
              <dd>{n(t.puentes)}</dd>
            </div>
            <div>
              <dt>skills</dt>
              <dd>{n(t.skills)}</dd>
            </div>
            <div>
              <dt>agentes</dt>
              <dd>{n(t.agentes + t.automatizaciones)}</dd>
            </div>
          </dl>
          {central && (
            <a className="boton-primario" href={rutaVault(central.slug, atlas.sistema.contexto ?? central.inicio)}>
              <BookOpen size={16} /> Empieza por {central.nombre}
              {atlas.sistema.contexto ? ' · Contexto para IA' : ''}
            </a>
          )}
        </div>

        <div className="cielo-lienzo" onMouseLeave={() => setTip(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${core.nombre} al centro, ${hijos.length} vaults en órbita y el anillo de skills y agentes`}>
            <defs>
              {atlas.vaults.map((v) => (
                <radialGradient key={v.slug} id={`grad-${v.slug}`} cx="35%" cy="32%" r="75%">
                  <stop offset="0%" stopColor={mezclar(v.color, '#ffffff', 0.4)} />
                  <stop offset="55%" stopColor={v.color} />
                  <stop offset="100%" stopColor={mezclar(v.color, '#000000', 0.45)} />
                </radialGradient>
              ))}
              <radialGradient id="corona" r="50%">
                <stop offset="40%" stopColor="#1d24f7" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#1d24f7" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Órbita y anillo */}
            <ellipse cx={CX} cy={CY} rx={ORBITA.rx} ry={ORBITA.ry} className="orbita" />
            <ellipse cx={CX} cy={CY} rx={ANILLO.rx} ry={ANILLO.ry} className="orbita anillo" />
            <ellipse cx={CX} cy={CY} rx={ANILLO.rx - 34} ry={ANILLO.ry - 24} className="orbita fina" />

            {/* Puentes entre vaults hijos (curvas que pasan cerca del centro) */}
            {puentes
              .filter((p) => p.a !== core.nombre && p.b !== core.nombre)
              .map((p) => {
                const A = porNombre.get(p.a);
                const B = porNombre.get(p.b);
                if (!A || !B) return null;
                const mx = (A.x + B.x) / 2;
                const my = (A.y + B.y) / 2;
                const qx = mx + (CX - mx) * 0.55;
                const qy = my + (CY - my) * 0.55;
                const activo = foco === p.a || foco === p.b;
                return (
                  <path
                    key={`${p.a}-${p.b}`}
                    d={`M${A.x},${A.y} Q${qx},${qy} ${B.x},${B.y}`}
                    className={`puente ${activo ? 'activo' : foco ? 'atenuado' : ''}`}
                    strokeWidth={grosor(p.ida + p.vuelta)}
                    onMouseMove={(e) =>
                      mostrarTip(e, { titulo: `${p.a} ↔ ${p.b}`, texto: `${p.ida} enlaces ${p.a} → ${p.b} · ${p.vuelta} de vuelta`, color: 'var(--laton)' })
                    }
                    onMouseLeave={() => setTip(null)}
                  />
                );
              })}

            {/* Rayos: cada vault nace de CORE */}
            {planetas.map((p) => {
              const ida = puentes.find((x) => (x.a === core.nombre && x.b === p.v.nombre) || (x.b === core.nombre && x.a === p.v.nombre));
              const total = ida ? ida.ida + ida.vuelta : 0;
              const dx = p.x - CX;
              const dy = p.y - CY;
              const d = Math.hypot(dx, dy);
              const x1 = CX + (dx / d) * (R_CORE + 10);
              const y1 = CY + (dy / d) * (R_CORE + 10);
              const x2 = p.x - (dx / d) * (p.r + 8);
              const y2 = p.y - (dy / d) * (p.r + 8);
              return (
                <g key={`rayo-${p.v.slug}`} className={`rayo ${foco === p.v.nombre ? 'activo' : foco ? 'atenuado' : ''}`} style={{ color: p.v.color }}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={grosor(total) + 0.6} />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className="flujo" />
                  <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} className="rayo-cifra">
                    {total ? `${total} puentes` : ''}
                  </text>
                </g>
              );
            })}

            {/* CORE */}
            <g
              className="sol"
              onClick={() => navegar(central ? rutaVault(central.slug, central.inicio) : '#/skills')}
              onMouseEnter={() => setFoco(core.nombre)}
              onMouseLeave={() => setFoco(null)}
              role="link"
              aria-label={`Abrir ${core.nombre}`}
            >
              <circle cx={CX} cy={CY} r={R_CORE * 2.1} fill="url(#corona)" className="corona" />
              <circle cx={CX} cy={CY} r={R_CORE + 22} className="sol-anillo" />
              <circle cx={CX} cy={CY} r={R_CORE + 40} className="sol-anillo lento" />
              <circle cx={CX} cy={CY} r={R_CORE} fill={central ? `url(#grad-${core.slug})` : core.color} />
              <text x={CX} y={CY + 6} className="sol-nombre" style={{ fontSize: core.nombre.length > 8 ? `${Math.max(16, 38 - (core.nombre.length - 8) * 2.2)}px` : undefined }}>
                {core.nombre}
              </text>
              <text x={CX} y={CY + 30} className="sol-dato">
                {central ? `${n(core.notas)} notas · ${cerebro}` : `${n(atlas.totales.skills)} skills`}
              </text>
            </g>

            {/* Planetas */}
            {planetas.map((p, i) => {
              const lunas = p.v.carpetas.h.slice(0, 9);
              const maxT = Math.max(...lunas.map((l) => l.t), 1);
              return (
                <g
                  key={p.v.slug}
                  className={`planeta ${foco && foco !== p.v.nombre && foco !== core.nombre ? 'atenuado' : ''}`}
                  style={{ animationDelay: `${0.15 + i * 0.09}s` }}
                  onMouseEnter={() => setFoco(p.v.nombre)}
                  onMouseLeave={() => setFoco(null)}
                  onClick={() => navegar(rutaVault(p.v.slug))}
                  role="link"
                  aria-label={`Abrir ${p.v.nombre}`}
                >
                  <circle cx={p.x} cy={p.y} r={p.r + 26} className="planeta-zona" />
                  <g className="lunas" style={{ transformOrigin: `${p.x}px ${p.y}px`, animationDuration: `${50 + i * 9}s` }}>
                    {lunas.map((l, j) => {
                      const a = (j / lunas.length) * Math.PI * 2;
                      const d = p.r + 13 + (j % 2) * 7;
                      return <circle key={l.p} cx={p.x + Math.cos(a) * d} cy={p.y + Math.sin(a) * d} r={1.6 + 3.2 * Math.sqrt(l.t / maxT)} fill={p.v.color} opacity={0.75} />;
                    })}
                  </g>
                  <circle cx={p.x} cy={p.y} r={p.r} fill={`url(#grad-${p.v.slug})`} className="planeta-cuerpo" />
                  <text x={p.x} y={p.y + p.r + 44} className="planeta-nombre" style={{ fill: tono(p.v.color, tema) }}>
                    {p.v.nombre}
                  </text>
                  <text x={p.x} y={p.y + p.r + 62} className="planeta-dato">
                    {n(p.v.notas)} notas · {p.v.carpetas.h.length} carpetas
                  </text>
                </g>
              );
            })}

            {/* Zodiaco de skills y agentes */}
            <g className="zodiaco">
              <path id="camino-arriba" d={caminoElipse(ETIQUETA_ARRIBA.rx, ETIQUETA_ARRIBA.ry, true)} fill="none" />
              <path id="camino-abajo" d={caminoElipse(ETIQUETA_ABAJO.rx, ETIQUETA_ABAJO.ry, false)} fill="none" />
              {zodiaco.etiquetas.map((e) => (
                <text
                  key={e.texto}
                  className={`signo ${categoriaFoco && categoriaFoco !== e.categoria ? 'atenuado' : ''}`}
                  style={{ fill: tono(e.color, tema) }}
                  onMouseEnter={() => setCategoriaFoco(e.categoria)}
                  onMouseLeave={() => setCategoriaFoco(null)}
                  onClick={() => navegar(e.categoria === 'Agentes' ? '#/agentes' : `#/skills?categoria=${encodeURIComponent(e.categoria)}`)}
                >
                  <textPath href={e.arriba ? '#camino-arriba' : '#camino-abajo'} startOffset={e.offset} textAnchor="middle">
                    {e.texto} · {e.total}
                  </textPath>
                </text>
              ))}
              {zodiaco.puntos.map((p, i) => {
                const atenuado = categoriaFoco && categoriaFoco !== p.categoria;
                const comun = {
                  className: `estrella ${p.forma} ${atenuado ? 'atenuado' : ''}`,
                  style: { animationDelay: `${0.4 + i * 0.006}s`, fill: tono(p.color, tema), color: tono(p.color, tema) },
                  onMouseMove: (e: MouseEvent) => mostrarTip(e, { titulo: p.titulo, texto: p.texto, color: tono(p.color, tema) }),
                  onMouseLeave: () => setTip(null),
                  onClick: () => navegar(p.destino),
                };
                if (p.forma === 'agente' || p.forma === 'auto') {
                  const r = p.forma === 'agente' ? 6 : 5;
                  return <path key={p.id} d={`M${p.x},${p.y - r} L${p.x + r},${p.y} L${p.x},${p.y + r} L${p.x - r},${p.y} Z`} {...comun} />;
                }
                return <circle key={p.id} cx={p.x} cy={p.y} r={p.forma === 'propia' ? 5 : 3.3} {...comun} />;
              })}
            </g>
          </svg>

          {tip && (
            <div className="tip" style={{ left: tip.x, top: tip.y, borderColor: tip.color }}>
              <strong style={{ color: tip.color }}>{tip.titulo}</strong>
              <span>{tip.texto}</span>
            </div>
          )}

          {vaultFoco && <FichaFlotante v={vaultFoco} atlas={atlas} centro={central} cerebro={cerebro} />}
        </div>
      </section>

      {central && <ArbolVaults atlas={atlas} core={central} hijos={hijos} />}
    </div>
  );
}

function formatoFechaCorta(iso: string) {
  return `actualizado ${hace(iso)}`;
}

function FichaFlotante({ v, atlas, centro, cerebro }: { v: ResumenVault; atlas: Atlas; centro: ResumenVault | null; cerebro: string }) {
  const salen = atlas.puentes.filter((p) => p.de === v.nombre).sort((a, b) => b.n - a.n);
  return (
    <aside className="ficha-flotante" style={{ ['--vault' as string]: v.color }}>
      <p className="rotulo">{v === centro ? `Raíz · ${cerebro} del sistema` : `Nace de ${centro?.nombre ?? 'el centro'}`}</p>
      <h2 className="display" style={{ color: colorTexto(v.color) }}>
        {v.nombre}
      </h2>
      <p>{v.proposito}</p>
      <dl className="ficha-cifras mono">
        <div>
          <dt>notas</dt>
          <dd>{n(v.notas)}</dd>
        </div>
        <div>
          <dt>palabras</dt>
          <dd>{n(v.palabras)}</dd>
        </div>
        <div>
          <dt>adjuntos</dt>
          <dd>{n(v.adjuntos)}</dd>
        </div>
      </dl>
      <p className="rotulo">Carpetas principales</p>
      <ul className="ficha-carpetas">
        {v.carpetas.h.slice(0, 6).map((c) => (
          <li key={c.p}>
            <span>{c.n}</span>
            <span className="mono">{n(c.t)}</span>
          </li>
        ))}
      </ul>
      {salen.length > 0 && (
        <p className="ficha-puentes mono">
          Puentes → {salen.map((p) => `${p.a} ${p.n}`).join(' · ')}
        </p>
      )}
    </aside>
  );
}

function ArbolVaults({ atlas, core, hijos }: { atlas: Atlas; core: ResumenVault; hijos: ResumenVault[] }) {
  return (
    <section className="arbol-vaults" aria-label="Estructura de vaults">
      <header className="seccion-cabecera">
        <p className="rotulo">Estructura</p>
        <h2 className="display">
          Un tronco, <em>{hijos.length === 1 ? 'una rama' : `${enPalabras(hijos.length)} ramas`}</em>
        </h2>
        <p>
          Todo nace de {core.nombre} y se reparte en el vault que le corresponde. Cada tarjeta muestra para qué es el vault y sus carpetas; entra para leer cualquier nota.
        </p>
      </header>
      <TarjetaVault v={core} raiz />
      {hijos.length > 0 && (
        <>
          <div className="arbol-tronco" aria-hidden="true" />
          <div className="arbol-ramas" style={{ ['--ramas' as string]: Math.min(hijos.length, 5) }}>
            {hijos.map((v) => (
              <div className="arbol-rama" key={v.slug}>
                <TarjetaVault v={v} />
              </div>
            ))}
          </div>
        </>
      )}
      {atlas.totales.generados > 0 && (
        <p className="arbol-nota mono">
          {n(atlas.totales.generados)} notas generadas por herramientas (por ejemplo, Graphify crea una por archivo de código) no se cargan: su resumen ya vive en el resto del vault.
        </p>
      )}
    </section>
  );
}

function TarjetaVault({ v, raiz = false }: { v: ResumenVault; raiz?: boolean }) {
  return (
    <article className={`tarjeta-vault ${raiz ? 'raiz' : ''}`} style={{ ['--vault' as string]: v.color }}>
      <a href={rutaVault(v.slug)} className="tarjeta-vault-enlace">
        <span className="tarjeta-vault-punto" />
        <span className="rotulo">{raiz ? 'Raíz' : 'Rama'}</span>
        <h3 className="display">{v.nombre}</h3>
        <p>{v.proposito}</p>
        <span className="tarjeta-vault-cifras mono">
          {n(v.notas)} notas · {n(v.enlaces)} enlaces · {hace(v.ultima)}
        </span>
      </a>
      <ul className="tarjeta-vault-carpetas">
        {v.carpetas.h.slice(0, raiz ? 10 : 6).map((c) => (
          <li key={c.p}>
            <a href={rutaVault(v.slug, null, c.p)}>
              {c.n} <span className="mono">{n(c.t)}</span>
            </a>
          </li>
        ))}
      </ul>
      <a className="tarjeta-vault-ir" href={rutaVault(v.slug, v.inicio)}>
        Entrar <ArrowRight size={14} />
      </a>
    </article>
  );
}
