// Vista inicial: cada vault es un cerebro de neuronas que crece con sus notas. El
// vault central es el núcleo, rodeado de una interfaz holográfica; los demás lo
// orbitan unidos por haces nerviosos por los que viajan impulsos. El anillo
// exterior es el zodiaco de skills (agrupadas por categoría) y agentes.
// Todo sale de los datos de cada equipo: 0, 1 o muchos vaults.
import { ArrowRight, BookOpen } from 'lucide-react';
import { useMemo, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { cargarAgentes, cargarSkills, useDatos } from '../lib/datos';
import { vaultCentral } from '../lib/atlas';
import { colorTexto, enPalabras, hace, n, PALETA } from '../lib/formato';
import { navegar, rutaAgente, rutaSkill, rutaVault } from '../lib/rutas';
import CerebroNeuronal, { type Lobulo } from '../componentes/CerebroNeuronal';
import { bordeCerebro, neuronasPara } from '../lib/neuronas';
import { tono, useTema } from '../lib/tema';
import type { Atlas, Carpeta, ResumenVault } from '../lib/tipos';
import EmpezarVault, { vaultRecienAgregado } from '../componentes/EmpezarVault';

const W = 1500;
const H = 1000;
const CX = 750;
const CY = 500;
const ORBITA = { rx: 405, ry: 280 };
const ANILLO = { rx: 640, ry: 432 };
const ANCHO_CORE = 112;

/** Carpetas principales de un vault como lóbulos de su cerebro. */
const lobulosDe = (c: Carpeta): Lobulo[] =>
  c.h
    .filter((h) => h.t > 0)
    .slice(0, 8)
    .map((h) => ({ nombre: h.n, ruta: h.p, notas: h.t }));

const radianes = (grados: number) => (grados * Math.PI) / 180;

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

// En pantallas angostas se encuadran los cerebros (el anillo queda en los bordes).
const ANGOSTO = '(max-width: 760px)';
const VISTA_ANGOSTA = '250 70 1000 830';
function useAngosto() {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(ANGOSTO);
      m.addEventListener('change', avisar);
      return () => m.removeEventListener('change', avisar);
    },
    () => window.matchMedia(ANGOSTO).matches,
  );
}

interface Tip {
  x: number;
  y: number;
  /** ancho del lienzo: cerca del borde derecho el tip se abre hacia la izquierda */
  ancho?: number;
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
  const angosto = useAngosto();

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
        const angulo = -90 + (360 * i) / hijos.length + 18;
        const o = enElipse(angulo, ORBITA.rx, ORBITA.ry);
        // El cerebro (y sus neuronas) crece con las notas del vault; los grandes se
        // alejan un poco del núcleo para no tapar sus lecturas.
        const ancho = (34 + 62 * Math.sqrt(v.notas / maxNotas)) * factor;
        const afuera = Math.max(0, ancho - 46) * 0.75;
        const p = { ...o, x: o.x + o.c * afuera, y: o.y + o.s * afuera };
        return { v, ...p, angulo, ancho, cantidad: neuronasPara(v.notas), espejo: p.x < CX - 1, lobulos: lobulosDe(v.carpetas) };
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
    setTip({ ...t, x: e.clientX - caja.left, y: e.clientY - caja.top, ancho: caja.width });
  };

  // Las lecturas del núcleo van entre los haces, para no taparlos.
  const angulosLectura = useMemo(() => {
    if (planetas.length < 2) return [-40, 40, 140, 220];
    const lista = planetas.map((p) => p.angulo);
    return lista.map((a, i) => (a + (i + 1 < lista.length ? lista[i + 1] : lista[0] + 360)) / 2);
  }, [planetas]);

  const lobuloTip = (v: ResumenVault, color: string) => (l: Lobulo | null, e: MouseEvent) =>
    l ? mostrarTip(e, { titulo: l.nombre, texto: `${n(l.notas)} notas · lóbulo de ${v.nombre} · clic para entrar`, color }) : setTip(null);

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
            <em>una sola mente.</em>
          </h1>
          <p className="cielo-bajada">
            {central ? (
              <>
                <strong>{central.nombre}</strong> es el {cerebro}
                {hijos.length === 0
                  ? ': toca el núcleo para entrar.'
                  : `: de él ${hijos.length === 1 ? 'nace el otro vault' : `nacen los otros ${enPalabras(hijos.length)} vaults`}. Cada cerebro crece con sus notas y sus neuronas grandes son las carpetas: toca uno para entrar.`}{' '}
                El anillo exterior son tus skills y agentes.
              </>
            ) : (
              <>Todavía no hay vaults de Obsidian en este equipo. Cuando tengas uno, aquí verás tus notas como neuronas de un cerebro; el anillo exterior son tus skills y agentes.</>
            )}
          </p>
          {(central || t.skills > 0 || t.agentes > 0) && (
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
          )}
          {(!central || vaultRecienAgregado()) && <EmpezarVault />}
          {central && (
            <a className="boton-primario" href={rutaVault(central.slug, atlas.sistema.contexto ?? central.inicio)}>
              <BookOpen size={16} /> Empieza por {central.nombre}
              {atlas.sistema.contexto ? ' · Contexto para IA' : ''}
            </a>
          )}
        </div>

        <div className="cielo-lienzo" onMouseLeave={() => setTip(null)}>
          <svg viewBox={angosto ? VISTA_ANGOSTA : `0 0 ${W} ${H}`} role="img" aria-label={`${core.nombre} al centro como un cerebro, ${hijos.length} vaults alrededor y el anillo de skills y agentes`}>
            <defs>
              {atlas.vaults.map((v) => (
                <radialGradient key={v.slug} id={`aura-${v.slug}`} r="50%">
                  <stop offset="0%" stopColor={tono(v.color, tema)} stopOpacity={tema === 'oscuro' ? 0.3 : 0.16} />
                  <stop offset="60%" stopColor={tono(v.color, tema)} stopOpacity={tema === 'oscuro' ? 0.08 : 0.05} />
                  <stop offset="100%" stopColor={tono(v.color, tema)} stopOpacity="0" />
                </radialGradient>
              ))}
              <radialGradient id="aura-nucleo" r="50%">
                <stop offset="30%" stopColor={tono(core.color, tema)} stopOpacity={tema === 'oscuro' ? 0.4 : 0.14} />
                <stop offset="100%" stopColor={tono(core.color, tema)} stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Órbita y anillo */}
            <ellipse cx={CX} cy={CY} rx={ORBITA.rx} ry={ORBITA.ry} className="orbita" />
            <ellipse cx={CX} cy={CY} rx={ANILLO.rx} ry={ANILLO.ry} className="orbita anillo" />
            <ellipse cx={CX} cy={CY} rx={ANILLO.rx - 34} ry={ANILLO.ry - 24} className="orbita fina" />

            {/* Puentes entre vaults hijos: haces que pasan cerca del núcleo */}
            {puentes
              .filter((p) => p.a !== core.nombre && p.b !== core.nombre)
              .map((p, i) => {
                const A = porNombre.get(p.a);
                const B = porNombre.get(p.b);
                if (!A || !B) return null;
                const mx = (A.x + B.x) / 2;
                const my = (A.y + B.y) / 2;
                const qx = mx + (CX - mx) * 0.55;
                const qy = my + (CY - my) * 0.55;
                const activo = foco === p.a || foco === p.b;
                const d = `M${A.x},${A.y} Q${qx},${qy} ${B.x},${B.y}`;
                return (
                  <g key={`${p.a}-${p.b}`} className={`puente-haz ${activo ? 'activo' : foco ? 'atenuado' : ''}`}>
                    <path
                      d={d}
                      className="puente"
                      strokeWidth={grosor(p.ida + p.vuelta)}
                      onMouseMove={(e) =>
                        mostrarTip(e, { titulo: `${p.a} ↔ ${p.b}`, texto: `${p.ida} enlaces ${p.a} → ${p.b} · ${p.vuelta} de vuelta`, color: 'var(--laton)' })
                      }
                      onMouseLeave={() => setTip(null)}
                    />
                    <path d={d} className="puente-impulso" pathLength={100} style={{ animationDelay: `${2 + (i % 7) * 0.7}s`, animationDuration: `${4 + (i % 3)}s` }} />
                  </g>
                );
              })}

            {/* Haces nerviosos: cada vault nace del núcleo */}
            {planetas.map((p, i) => {
              const ida = puentes.find((x) => (x.a === core.nombre && x.b === p.v.nombre) || (x.b === core.nombre && x.a === p.v.nombre));
              const total = ida ? ida.ida + ida.vuelta : 0;
              const dx = p.x - CX;
              const dy = p.y - CY;
              const d = Math.hypot(dx, dy) || 1;
              const [ux, uy] = [dx / d, dy / d];
              const a = bordeCerebro(CX, CY, ANCHO_CORE, ux, uy);
              const b = bordeCerebro(p.x, p.y, p.ancho, -ux, -uy);
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const fibra = (desvio: number) => `M${a.x},${a.y} Q${mx - uy * desvio},${my + ux * desvio} ${b.x},${b.y}`;
              return (
                <g key={`haz-${p.v.slug}`} className={`haz ${foco === p.v.nombre ? 'activo' : foco ? 'atenuado' : ''}`} style={{ color: tono(p.v.color, tema) }}>
                  <path d={fibra(-18)} className="fibra" strokeWidth={0.8} />
                  <path d={fibra(18)} className="fibra" strokeWidth={0.8} />
                  <path d={fibra(0)} className="fibra central" strokeWidth={grosor(total) + 0.4} />
                  <path d={fibra(0)} className="haz-impulso" pathLength={100} style={{ animationDelay: `${1.8 + i * 0.45}s` }} />
                  <path d={fibra(-18)} className="haz-impulso vuelta" pathLength={100} style={{ animationDelay: `${3 + i * 0.6}s` }} />
                  <text x={mx} y={my - 10} className="rayo-cifra">
                    {total ? `${total} puentes` : ''}
                  </text>
                </g>
              );
            })}

            {/* Núcleo: el vault central como cerebro dentro de la interfaz holográfica */}
            <circle cx={CX} cy={CY} r={ANCHO_CORE * 1.75} fill="url(#aura-nucleo)" className="corona" />
            <HudNucleo
              r={ANCHO_CORE}
              angulos={angulosLectura}
              lecturas={[
                { etiqueta: 'neuronas', valor: n(t.notas) },
                { etiqueta: 'sinapsis', valor: n(t.enlaces) },
                { etiqueta: 'puentes', valor: n(t.puentes) },
                { etiqueta: 'vaults', valor: String(atlas.vaults.length) },
                { etiqueta: 'skills', valor: n(t.skills) },
              ]}
            />
            <g
              className={`sol ${foco === core.nombre ? 'activo' : ''}`}
              onClick={() => navegar(central ? rutaVault(central.slug, central.inicio) : '#/skills')}
              onMouseEnter={() => setFoco(core.nombre)}
              onMouseLeave={() => setFoco(null)}
              role="link"
              aria-label={`Abrir ${core.nombre}`}
            >
              <circle cx={CX} cy={CY} r={ANCHO_CORE * 1.05} className="planeta-zona" />
              <CerebroNeuronal
                semilla={core.slug || 'atlas'}
                color={tono(core.color, tema)}
                cantidad={Math.max(230, neuronasPara(core.notas))}
                x={CX}
                y={CY}
                ancho={ANCHO_CORE}
                lobulos={lobulosDe(core.carpetas)}
                retraso={0.1}
                onLobulo={central ? lobuloTip(central, tono(core.color, tema)) : undefined}
                onLobuloClic={central ? (l) => navegar(rutaVault(central.slug, null, l.ruta)) : undefined}
              />
              <text x={CX} y={CY + 6} className="sol-nombre" style={{ fontSize: core.nombre.length > 8 ? `${Math.max(16, 38 - (core.nombre.length - 8) * 2.2)}px` : undefined }}>
                {core.nombre}
              </text>
              <text x={CX} y={CY + 28} className="sol-dato">
                {central ? `${n(core.notas)} notas · ${cerebro}` : `${n(atlas.totales.skills)} skills`}
              </text>
            </g>

            {/* Vaults: un cerebro por vault, del tamaño de sus notas */}
            {planetas.map((p, i) => {
              const color = tono(p.v.color, tema);
              const q = p.ancho * 1.08;
              const esquina = Math.min(14, p.ancho * 0.3);
              const esquinas = [
                [-1, -1],
                [1, -1],
                [1, 1],
                [-1, 1],
              ]
                .map(([sx, sy]) => `M${p.x + sx * q},${p.y + sy * q - sy * esquina} L${p.x + sx * q},${p.y + sy * q} L${p.x + sx * q - sx * esquina},${p.y + sy * q}`)
                .join(' ');
              return (
                <g
                  key={p.v.slug}
                  className={`vault-neuronal ${foco === p.v.nombre ? 'activo' : foco && foco !== core.nombre ? 'atenuado' : ''}`}
                  style={{ ['--c' as string]: color, animationDelay: `${0.3 + i * 0.12}s` }}
                  onMouseEnter={() => setFoco(p.v.nombre)}
                  onMouseLeave={() => setFoco(null)}
                  onClick={() => navegar(rutaVault(p.v.slug))}
                  role="link"
                  aria-label={`Abrir ${p.v.nombre}`}
                >
                  <circle cx={p.x} cy={p.y} r={p.ancho * 1.7} fill={`url(#aura-${p.v.slug})`} className="vault-aura" />
                  <circle cx={p.x} cy={p.y} r={p.ancho * 1.25 + 10} className="planeta-zona" />
                  <g className="reticula" style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
                    <circle cx={p.x} cy={p.y} r={p.ancho * 1.2} className="reticula-circulo" style={{ transformOrigin: `${p.x}px ${p.y}px`, animationDuration: `${36 + i * 7}s` }} />
                    <path d={esquinas} className="reticula-esquinas" />
                  </g>
                  <CerebroNeuronal
                    semilla={p.v.slug}
                    color={color}
                    cantidad={p.cantidad}
                    x={p.x}
                    y={p.y}
                    ancho={p.ancho}
                    espejo={p.espejo}
                    lobulos={p.lobulos}
                    retraso={0.35 + i * 0.15}
                    onLobulo={lobuloTip(p.v, color)}
                    onLobuloClic={(l) => navegar(rutaVault(p.v.slug, null, l.ruta))}
                  />
                  <text x={p.x} y={p.y + p.ancho * 0.92 + 30} className="planeta-nombre" style={{ fill: color }}>
                    {p.v.nombre}
                  </text>
                  <text x={p.x} y={p.y + p.ancho * 0.92 + 48} className="planeta-dato">
                    {n(p.v.notas)} notas · {p.lobulos.length} lóbulos
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
            <div className={`tip ${tip.ancho && tip.x > tip.ancho - 320 ? 'a-la-izquierda' : ''}`} style={{ left: tip.x, top: tip.y, borderColor: tip.color }}>
              <strong style={{ color: tip.color }}>{tip.titulo}</strong>
              <span>{tip.texto}</span>
            </div>
          )}

          {vaultFoco && (
            <FichaFlotante v={vaultFoco} atlas={atlas} centro={central} cerebro={cerebro} lado={(porNombre.get(vaultFoco.nombre)?.x ?? 0) > CX ? 'izquierda' : 'derecha'} />
          )}
        </div>
      </section>

      {central && <ArbolVaults atlas={atlas} core={central} hijos={hijos} />}
    </div>
  );
}

// Interfaz holográfica del núcleo: barrido de radar, marcas de escala, anillos
// segmentados que giran en sentidos opuestos, mira y lecturas con su línea guía.
function HudNucleo({ r, angulos, lecturas }: { r: number; angulos: number[]; lecturas: { etiqueta: string; valor: string }[] }) {
  const marcas = useMemo(() => {
    let d = '';
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const largo = i % 10 === 0 ? 10 : i % 5 === 0 ? 6 : 3;
      const r1 = r * 1.22;
      d += `M${(CX + Math.cos(a) * r1).toFixed(1)} ${(CY + Math.sin(a) * r1).toFixed(1)}L${(CX + Math.cos(a) * (r1 + largo)).toFixed(1)} ${(CY + Math.sin(a) * (r1 + largo)).toFixed(1)}`;
    }
    return d;
  }, [r]);
  const punto = (grados: number, radio: number) => ({ x: CX + Math.cos(radianes(grados)) * radio, y: CY + Math.sin(radianes(grados)) * radio });
  const arco = (radio: number, desde: number, hasta: number) => {
    const a = punto(desde, radio);
    const b = punto(hasta, radio);
    return `M${a.x} ${a.y} A${radio} ${radio} 0 ${hasta - desde > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
  };
  const origen = { transformOrigin: `${CX}px ${CY}px` };
  const barrido = Array.from({ length: 12 }, (_, i) => {
    const a = punto(-i * 3.5, r * 1.2);
    const b = punto(-(i + 1) * 3.5, r * 1.2);
    return { d: `M${CX} ${CY} L${a.x} ${a.y} A${r * 1.2} ${r * 1.2} 0 0 0 ${b.x} ${b.y} Z`, opacidad: 0.2 * (1 - i / 12) };
  });
  return (
    <g className="hud" aria-hidden="true">
      <g className="hud-barrido" style={origen}>
        {barrido.map((w, i) => (
          <path key={i} d={w.d} style={{ opacity: w.opacidad }} />
        ))}
      </g>
      <circle cx={CX} cy={CY} r={r * 1.12} className="hud-fino" />
      <path d={marcas} className="hud-marcas" />
      <circle cx={CX} cy={CY} r={r * 1.38} className="hud-segmentos" style={origen} />
      <g className="hud-arcos" style={origen}>
        <path d={arco(r * 1.48, -24, 46)} />
        <path d={arco(r * 1.48, 156, 226)} />
      </g>
      <g className="hud-arcos inverso" style={origen}>
        <path d={arco(r * 1.55, 70, 112)} />
        <path d={arco(r * 1.55, 250, 292)} />
      </g>
      {[0, 90, 180, 270].map((g) => {
        const a = punto(g, r * 1.6);
        const b = punto(g, r * 1.7);
        return <line key={g} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="hud-cruz" />;
      })}
      {lecturas.slice(0, angulos.length).map((l, i) => {
        const a = punto(angulos[i], r * 1.5);
        const b = punto(angulos[i], r * 1.72);
        const lado = Math.cos(radianes(angulos[i])) >= 0 ? 1 : -1;
        const fin = { x: b.x + lado * 16, y: b.y };
        return (
          <g key={l.etiqueta} className="hud-lectura" style={{ animationDelay: `${1.2 + i * 0.15}s` }}>
            <circle cx={a.x} cy={a.y} r={2} />
            <path d={`M${a.x} ${a.y} L${b.x} ${b.y} L${fin.x} ${fin.y}`} />
            <text x={fin.x + lado * 6} y={fin.y - 3} textAnchor={lado > 0 ? 'start' : 'end'} className="hud-lectura-etiqueta">
              {l.etiqueta}
            </text>
            <text x={fin.x + lado * 6} y={fin.y + 13} textAnchor={lado > 0 ? 'start' : 'end'} className="hud-lectura-valor">
              {l.valor}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function formatoFechaCorta(iso: string) {
  return `actualizado ${hace(iso)}`;
}

// La ficha aparece del lado contrario al vault, para no taparlo.
function FichaFlotante({ v, atlas, centro, cerebro, lado }: { v: ResumenVault; atlas: Atlas; centro: ResumenVault | null; cerebro: string; lado: 'izquierda' | 'derecha' }) {
  const salen = atlas.puentes.filter((p) => p.de === v.nombre).sort((a, b) => b.n - a.n);
  return (
    <aside className={`ficha-flotante ${lado}`} style={{ ['--vault' as string]: v.color }}>
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
