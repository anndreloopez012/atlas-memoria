// Mapa del vault como círculos anidados: cada carpeta contiene sus subcarpetas y
// sus notas (el tamaño de una nota crece un poco con su largo). Clic en una
// carpeta para entrar con zoom; clic afuera para subir. La carpeta enfocada es la
// misma de la URL, así que el mapa y el resto de la pantalla siempre coinciden.
//
// Rendimiento: los círculos se dibujan una sola vez por vault; el zoom solo cambia
// la transformación de un grupo (sin volver a renderizar miles de elementos).
import { hierarchy, pack, type HierarchyCircularNode } from 'd3-hierarchy';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { hace } from '../../lib/formato';
import type { Carpeta, Nota, ResumenVault } from '../../lib/tipos';

interface NodoMapa {
  nombre: string;
  ruta: string;
  tipo: 'carpeta' | 'nota';
  nota?: Nota;
  valor: number;
  hijos: NodoMapa[];
}

type Circulo = HierarchyCircularNode<NodoMapa>;

interface Props {
  vault: ResumenVault;
  notas: Nota[];
  carpeta: string | null;
  notaId: string | null;
  coincidencias: Set<string> | null;
  colorDe: (f: string) => string;
  onCarpeta: (ruta: string | null) => void;
  onNota: (id: string) => void;
}

const LADO = 1000;
const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function construir(vault: ResumenVault, notas: Nota[]): NodoMapa {
  const porRuta = new Map<string, NodoMapa>();
  const visitar = (c: Carpeta): NodoMapa => {
    const nodo: NodoMapa = { nombre: c.n || vault.nombre, ruta: c.p, tipo: 'carpeta', valor: 0, hijos: [] };
    porRuta.set(c.p, nodo);
    for (const h of c.h) if (h.t > 0) nodo.hijos.push(visitar(h));
    return nodo;
  };
  const raiz = visitar(vault.carpetas);
  for (const nota of notas) {
    const destino = porRuta.get(nota.f) ?? raiz;
    destino.hijos.push({ nombre: nota.t, ruta: nota.f, tipo: 'nota', nota, valor: 1 + Math.min(4, Math.sqrt(nota.w) / 18), hijos: [] });
  }
  return raiz;
}

export default function MapaCarpetas({ vault, notas, carpeta, notaId, coincidencias, colorDe, onCarpeta, onNota }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const grupo = useRef<SVGGElement>(null);
  const [escalaPantalla, setEscalaPantalla] = useState(0.6);
  const [tip, setTip] = useState<{ x: number; y: number; c: Circulo } | null>(null);
  const [animando, setAnimando] = useState(false);

  const raiz = useMemo(() => {
    const h = hierarchy(construir(vault, notas), (d) => d.hijos)
      .sum((d) => (d.tipo === 'nota' ? d.valor : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return pack<NodoMapa>()
      .size([LADO, LADO])
      .padding((d) => (d.depth === 0 ? 14 : 5))(h);
  }, [vault, notas]);

  const circulos = useMemo(() => raiz.descendants().filter((c) => c.r > 0.4), [raiz]);
  const porRuta = useMemo(() => new Map(circulos.filter((c) => c.data.tipo === 'carpeta').map((c) => [c.data.ruta, c])), [circulos]);
  const foco = (carpeta ? porRuta.get(carpeta) : null) ?? raiz;

  // Vista actual [x, y, radio]: se anima hacia el foco cuando cambia.
  const vista = useRef<[number, number, number]>([foco.x, foco.y, foco.r]);
  const transformar = ([x, y, r]: [number, number, number]) => {
    const k = LADO / 2 / (r * 1.04);
    grupo.current?.setAttribute('transform', `translate(${LADO / 2},${LADO / 2}) scale(${k}) translate(${-x},${-y})`);
  };

  useLayoutEffect(() => {
    transformar(vista.current);
  });

  useEffect(() => {
    const desde = vista.current;
    const hasta: [number, number, number] = [foco.x, foco.y, foco.r];
    if (desde.every((v, i) => Math.abs(v - hasta[i]) < 0.5)) return;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duracion = reducido ? 0 : 650;
    const inicio = performance.now();
    let cuadro = 0;
    setAnimando(true);
    const paso = (ahora: number) => {
      const t = duracion ? Math.min(1, (ahora - inicio) / duracion) : 1;
      const e = suave(t);
      vista.current = [desde[0] + (hasta[0] - desde[0]) * e, desde[1] + (hasta[1] - desde[1]) * e, desde[2] + (hasta[2] - desde[2]) * e];
      transformar(vista.current);
      if (t < 1) cuadro = requestAnimationFrame(paso);
      else setAnimando(false);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [foco]);

  // Tamaño en pantalla, para que las etiquetas se lean igual en cualquier contenedor.
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const medir = () => setEscalaPantalla(Math.min(el.clientWidth, el.clientHeight) / LADO || 0.6);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Los círculos se generan una vez por vault, selección y filtro (no en cada cuadro).
  const dibujo = useMemo(
    () =>
      circulos.map((c, i) => {
        const d = c.data;
        if (d.tipo === 'carpeta') {
          const tono = c.depth === 0 ? vault.color : colorDe(d.ruta);
          return (
            <circle
              key={`c${i}`}
              data-i={i}
              cx={c.x}
              cy={c.y}
              r={c.r}
              className={`mapa-carpeta nivel-${Math.min(c.depth, 4)}`}
              style={{ ['--c' as string]: tono }}
            />
          );
        }
        const apagada = coincidencias && !coincidencias.has(d.nota!.id);
        return (
          <circle
            key={`n${i}`}
            data-i={i}
            cx={c.x}
            cy={c.y}
            r={c.r}
            className={`mapa-nota ${d.nota!.id === notaId ? 'elegida' : ''} ${apagada ? 'apagada' : ''}`}
            style={{ ['--c' as string]: colorDe(d.ruta) }}
          />
        );
      }),
    [circulos, colorDe, vault.color, notaId, coincidencias],
  );

  const circuloDe = (e: MouseEvent) => {
    const i = (e.target as Element).getAttribute('data-i');
    return i === null ? null : circulos[Number(i)];
  };

  const clic = (e: MouseEvent) => {
    const c = circuloDe(e);
    // Se baja de a un nivel: el clic cuenta para el hijo directo del foco que contiene el punto.
    let objetivo = c;
    while (objetivo && objetivo.parent && objetivo.parent !== foco) objetivo = objetivo.parent;
    if (!objetivo || objetivo === foco || objetivo.parent !== foco) {
      // Clic en el fondo, en la carpeta enfocada o fuera de ella: subir un nivel.
      onCarpeta(foco.parent ? foco.parent.data.ruta || null : null);
      return;
    }
    if (objetivo.data.tipo === 'nota') onNota(objetivo.data.nota!.id);
    else onCarpeta(objetivo.data.ruta || null);
  };

  const mover = (e: MouseEvent) => {
    const c = circuloDe(e);
    const caja = contenedor.current!.getBoundingClientRect();
    setTip(c && c !== raiz ? { x: e.clientX - caja.left, y: e.clientY - caja.top, c } : null);
  };

  // Etiquetas de las carpetas hijas del foco (en coordenadas de pantalla).
  const k = LADO / 2 / (foco.r * 1.04);
  const etiquetas = (foco.children ?? []).filter((c) => c.data.tipo === 'carpeta' && c.r * k * escalaPantalla > 30);
  // Notas sueltas del foco con espacio suficiente: su título dentro del círculo.
  const titulos = (foco.children ?? []).filter((c) => c.data.tipo === 'nota' && c.r * k * escalaPantalla > 30);
  const tamanoLetra = 13 / escalaPantalla;
  const migas = foco.ancestors().reverse();

  return (
    <div className="mapa-carpetas" ref={contenedor} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${LADO} ${LADO}`} role="img" aria-label={`Mapa de ${vault.nombre}: carpetas y notas como círculos anidados`} onClick={clic} onMouseMove={mover}>
        <g ref={grupo}>{dibujo}</g>
        <g className={`mapa-etiquetas ${animando ? 'ocultas' : ''}`}>
          {titulos.map((c) => {
            const radio = c.r * k;
            const letra = 11 / escalaPantalla;
            const caben = Math.max(4, Math.floor((radio * 1.7) / (letra * 0.56)));
            const titulo = c.data.nombre.length > caben ? `${c.data.nombre.slice(0, caben - 1)}…` : c.data.nombre;
            return (
              <text key={c.data.nota!.id} className="mapa-titulo-nota" x={(c.x - foco.x) * k + LADO / 2} y={(c.y - foco.y) * k + LADO / 2} style={{ fontSize: letra }} dy="0.35em">
                {titulo}
              </text>
            );
          })}
          {etiquetas.map((c) => {
            const x = (c.x - foco.x) * k + LADO / 2;
            const y = (c.y - foco.y) * k + LADO / 2;
            const nombre = c.data.nombre.length > 26 ? `${c.data.nombre.slice(0, 24)}…` : c.data.nombre;
            return (
              <g key={c.data.ruta} transform={`translate(${x},${y})`}>
                <text className="mapa-etiqueta" style={{ fontSize: tamanoLetra }} dy="-0.2em">
                  {nombre}
                </text>
                <text className="mapa-cuenta" style={{ fontSize: tamanoLetra * 0.78 }} dy="1.1em">
                  {c.leaves().filter((h) => h.data.tipo === 'nota').length} notas
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <nav className="mapa-migas mono" aria-label="Ruta en el mapa">
        {migas.map((c, i) => (
          <span key={c.data.ruta || 'raiz'}>
            {i > 0 && <span className="separador">›</span>}
            <button onClick={() => onCarpeta(c.data.ruta || null)} className={c === foco ? 'actual' : ''}>
              {c.depth === 0 ? vault.nombre : c.data.nombre}
            </button>
          </span>
        ))}
      </nav>
      <p className="grafo-ayuda mono">clic en una carpeta: entrar · clic afuera: subir · clic en un punto: leer</p>

      {tip && (
        <div className="grafo-hover mapa-tip" style={{ left: Math.min(tip.x + 16, (contenedor.current?.clientWidth ?? 0) - 300), top: tip.y + 16 }}>
          {tip.c.data.tipo === 'nota' ? (
            <>
              <strong>{tip.c.data.nombre}</strong>
              <span className="mono">
                {tip.c.data.ruta || 'raíz'} · {hace(tip.c.data.nota!.m)}
              </span>
              {tip.c.data.nota!.ex && <p>{tip.c.data.nota!.ex}</p>}
            </>
          ) : (
            <>
              <strong>{tip.c.data.nombre}</strong>
              <span className="mono">
                {tip.c.leaves().filter((h) => h.data.tipo === 'nota').length} notas · {(tip.c.children ?? []).filter((h) => h.data.tipo === 'carpeta').length} subcarpetas
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
