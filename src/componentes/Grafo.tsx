// Lienzo de grafo genérico (force-graph sobre canvas). Lo usan el vault y la red
// de skills. Los datos solo se recargan cuando cambia `clave`; el foco y el hover
// solo repintan.
//
// Extras visuales: territorios (un halo por grupo, p. ej. cada carpeta principal),
// enlaces curvos, brillo en los nodos más conectados y destellos que recorren los
// enlaces del nodo enfocado. Las posiciones finales se recuerdan por `clave`: al
// volver a un vault o carpeta ya vista, el grafo aparece acomodado al instante.
import ForceGraph from 'force-graph';
import { useEffect, useRef } from 'react';

export interface NodoGrafo {
  id: string;
  etiqueta: string;
  color: string;
  radio: number;
  tipo: string;
  /** etiqueta siempre visible */
  fija?: boolean;
  /** cuántas notas cuelgan de este nodo (para dar más espacio a los grupos grandes) */
  peso?: number;
  x?: number;
  y?: number;
}

export interface EnlaceGrafo {
  source: string;
  target: string;
  tipo: string;
}

interface Props {
  clave: string;
  nodos: NodoGrafo[];
  enlaces: EnlaceGrafo[];
  foco?: string | null;
  colorTexto: string;
  colorLinea: string;
  /** halo detrás de las etiquetas y relleno de carpetas */
  colorFondo: string;
  colorEnlace?: string;
  distancia?: (e: EnlaceGrafo, origen: NodoGrafo, destino: NodoGrafo) => number;
  fuerza?: (e: EnlaceGrafo, origen: NodoGrafo, destino: NodoGrafo) => number;
  carga?: (n: NodoGrafo) => number;
  onClic?: (n: NodoGrafo) => void;
  onHover?: (n: NodoGrafo | null) => void;
  /** cambia este número para volver a encuadrar */
  encuadrar?: number;
  /** territorio de cada nodo: se dibuja un halo con su nombre detrás del grupo */
  grupo?: (n: NodoGrafo) => { clave: string; color: string; etiqueta: string } | null;
  /** color de los destellos sobre los enlaces del nodo enfocado */
  colorAcento?: string;
}

type NodoInterno = NodoGrafo & { __vecinos?: Set<string>; __grupo?: { clave: string; color: string; etiqueta: string } | null };

// Posiciones ya calculadas, por clave de datos (vault + carpeta + filtro…).
const posiciones = new Map<string, Map<string, { x: number; y: number }>>();

/** #rrggbb → rgba(r,g,b,a); si no es hex, se devuelve tal cual. */
function conAlfa(color: string, alfa: number) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alfa})` : color;
}

type FG = InstanceType<typeof ForceGraph<NodoInterno, EnlaceGrafo>>;

/** Fuerza que junta cada nodo con el centro de su territorio: los grupos se ven como racimos. */
function fuerzaTerritorio(intensidad: number) {
  let nodos: NodoInterno[] = [];
  const fuerza = (alfa: number) => {
    const centros = new Map<string, { x: number; y: number; n: number }>();
    for (const nodo of nodos) {
      const clave = nodo.__grupo?.clave;
      if (!clave || nodo.x === undefined) continue;
      const c = centros.get(clave) ?? { x: 0, y: 0, n: 0 };
      c.x += nodo.x;
      c.y += nodo.y!;
      c.n += 1;
      centros.set(clave, c);
    }
    const k = alfa * intensidad;
    for (const nodo of nodos) {
      const c = nodo.__grupo && centros.get(nodo.__grupo.clave);
      if (!c || c.n < 2 || nodo.x === undefined) continue;
      const m = nodo as NodoInterno & { vx?: number; vy?: number };
      m.vx = (m.vx ?? 0) - (nodo.x - c.x / c.n) * k;
      m.vy = (m.vy ?? 0) - (nodo.y! - c.y / c.n) * k;
    }
  };
  fuerza.initialize = (lista: NodoInterno[]) => {
    nodos = lista;
  };
  return fuerza;
}

export default function Grafo(props: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const grafo = useRef<FG | null>(null);
  const estado = useRef({ foco: props.foco ?? null, hover: null as string | null, vecinos: new Set<string>(), rotulados: new Set<string>(), props });
  estado.current.props = props;

  // Crear la instancia una sola vez.
  useEffect(() => {
    const el = contenedor.current!;
    const g = new ForceGraph<NodoGrafo, EnlaceGrafo>(el) as unknown as FG;
    grafo.current = g;
    g.backgroundColor('rgba(0,0,0,0)')
      .nodeId('id')
      .nodeLabel(() => '')
      .linkSource('source')
      .linkTarget('target')
      .cooldownTicks(260)
      .d3VelocityDecay(0.32)
      .minZoom(0.08)
      .maxZoom(14)
      .nodeRelSize(1)
      .nodeVal((n) => n.radio * n.radio)
      .linkCurvature((l) => (l.tipo === 'enlace' ? 0.16 : 0))
      .linkDirectionalParticleWidth(2.4)
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleColor(() => estado.current.props.colorAcento ?? estado.current.props.colorTexto)
      .linkDirectionalParticles((l) => {
        const { foco } = estado.current;
        if (!foco) return 0;
        const s = typeof l.source === 'object' ? (l.source as NodoGrafo).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as NodoGrafo).id : l.target;
        return s === foco || t === foco ? 2 : 0;
      })
      .onRenderFramePre((ctx, escala) => {
        // Territorios: un halo suave por grupo, centrado en sus nodos.
        const nodos = g.graphData().nodes as NodoInterno[];
        const grupos = new Map<string, { sx: number; sy: number; n: number; d2: number; color: string; etiqueta: string }>();
        for (const nodo of nodos) {
          const gr = nodo.__grupo;
          if (!gr || nodo.x === undefined) continue;
          const acc = grupos.get(gr.clave) ?? { sx: 0, sy: 0, n: 0, d2: 0, color: gr.color, etiqueta: gr.etiqueta };
          acc.sx += nodo.x;
          acc.sy += nodo.y!;
          acc.n += 1;
          grupos.set(gr.clave, acc);
        }
        for (const nodo of nodos) {
          const acc = nodo.__grupo && grupos.get(nodo.__grupo.clave);
          if (!acc || nodo.x === undefined) continue;
          const dx = nodo.x - acc.sx / acc.n;
          const dy = nodo.y! - acc.sy / acc.n;
          acc.d2 += dx * dx + dy * dy;
        }
        const { foco, hover } = estado.current;
        const apagar = Boolean(foco ?? hover);
        estado.current.rotulados = new Set();
        for (const [clave, acc] of grupos) {
          if (acc.n < 3) continue;
          const cx = acc.sx / acc.n;
          const cy = acc.sy / acc.n;
          const r = Math.sqrt(acc.d2 / acc.n) * 1.7 + 14;
          const degradado = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
          degradado.addColorStop(0, conAlfa(acc.color, apagar ? 0.05 : 0.13));
          degradado.addColorStop(1, conAlfa(acc.color, 0));
          ctx.fillStyle = degradado;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.setLineDash([2 / escala, 6 / escala]);
          ctx.lineWidth = 1 / escala;
          ctx.strokeStyle = conAlfa(acc.color, apagar ? 0.12 : 0.32);
          ctx.stroke();
          ctx.setLineDash([]);
          if (escala < 1.4) {
            const tam = 10.5 / escala;
            ctx.font = `600 ${tam}px 'JetBrains Mono Variable', monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = conAlfa(acc.color, apagar ? 0.35 : 0.85);
            ctx.fillText(acc.etiqueta.toUpperCase(), cx, cy - r - 4 / escala);
            estado.current.rotulados.add(clave);
          }
        }
      })
      .linkWidth((l) => {
        const { foco, hover } = estado.current;
        const activo = foco ?? hover;
        const s = typeof l.source === 'object' ? (l.source as NodoGrafo).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as NodoGrafo).id : l.target;
        return activo && (s === activo || t === activo) ? 1.6 : l.tipo === 'enlace' ? 0.5 : 0.8;
      })
      .linkColor((l) => {
        const { foco, hover, props: p } = estado.current;
        const activo = foco ?? hover;
        const s = typeof l.source === 'object' ? (l.source as NodoGrafo).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as NodoGrafo).id : l.target;
        if (activo && (s === activo || t === activo)) return p.colorTexto;
        if (activo) return 'rgba(128,128,128,0.06)';
        return l.tipo === 'enlace' ? (p.colorEnlace ?? p.colorLinea) : p.colorLinea;
      })
      .nodeCanvasObject((nodo, ctx, escala) => {
        const { foco, hover, vecinos, rotulados, props: p } = estado.current;
        const activo = foco ?? hover;
        const atenuado = activo && nodo.id !== activo && !vecinos.has(nodo.id);
        // La carpeta que encabeza un territorio ya tiene su nombre arriba del halo.
        const cabeza = nodo.tipo === 'carpeta' && nodo.__grupo && nodo.id === `carpeta:${nodo.__grupo.clave}` && rotulados.has(nodo.__grupo.clave);
        const r = nodo.radio;
        ctx.globalAlpha = atenuado ? 0.14 : 1;
        if (nodo.tipo === 'carpeta' || nodo.tipo === 'raiz' || nodo.tipo === 'agente' || nodo.tipo === 'categoria') {
          ctx.beginPath();
          if (nodo.tipo === 'agente') {
            ctx.moveTo(nodo.x!, nodo.y! - r);
            ctx.lineTo(nodo.x! + r, nodo.y!);
            ctx.lineTo(nodo.x!, nodo.y! + r);
            ctx.lineTo(nodo.x! - r, nodo.y!);
            ctx.closePath();
          } else {
            ctx.arc(nodo.x!, nodo.y!, r, 0, Math.PI * 2);
          }
          ctx.fillStyle = nodo.tipo === 'raiz' ? nodo.color : p.colorFondo;
          ctx.fill();
          ctx.lineWidth = nodo.tipo === 'raiz' ? 0 : Math.max(1, 1.6 / escala);
          ctx.strokeStyle = nodo.color;
          ctx.stroke();
        } else {
          // Los nodos más conectados brillan un poco.
          if (r > 4.2 && !atenuado) {
            ctx.beginPath();
            ctx.arc(nodo.x!, nodo.y!, r * 2.3, 0, Math.PI * 2);
            ctx.fillStyle = conAlfa(nodo.color, 0.14);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(nodo.x!, nodo.y!, r, 0, Math.PI * 2);
          ctx.fillStyle = nodo.color;
          ctx.fill();
        }
        if (nodo.tipo === 'raiz') {
          ctx.beginPath();
          ctx.arc(nodo.x!, nodo.y!, r * 2.6, 0, Math.PI * 2);
          ctx.fillStyle = conAlfa(nodo.color, 0.16);
          ctx.fill();
        }
        if (nodo.id === activo) {
          ctx.beginPath();
          ctx.arc(nodo.x!, nodo.y!, r + 4 / escala + 2, 0, Math.PI * 2);
          ctx.lineWidth = 1.5 / escala;
          ctx.strokeStyle = p.colorTexto;
          ctx.stroke();
        }
        const mostrar =
          nodo.id === activo ||
          (activo && vecinos.has(nodo.id) && escala > 0.9) ||
          (nodo.fija && !cabeza && escala > 0.12) ||
          escala > 3.2 ||
          (escala > 1.6 && r > 4);
        if (mostrar && !atenuado) {
          const tam = Math.max(10, nodo.fija ? 13 : 11) / escala;
          ctx.font = `${nodo.fija ? 600 : 450} ${tam}px 'Bricolage Grotesque Variable', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const texto = nodo.etiqueta.length > 42 ? `${nodo.etiqueta.slice(0, 40)}…` : nodo.etiqueta;
          ctx.lineWidth = 3 / escala;
          ctx.strokeStyle = p.colorFondo;
          ctx.strokeText(texto, nodo.x!, nodo.y! + r + 3 / escala);
          ctx.fillStyle = p.colorTexto;
          ctx.fillText(texto, nodo.x!, nodo.y! + r + 3 / escala);
        }
        ctx.globalAlpha = 1;
      })
      .nodePointerAreaPaint((nodo, color, ctx) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(nodo.x!, nodo.y!, Math.max(nodo.radio, 4) + 2, 0, Math.PI * 2);
        ctx.fill();
      })
      .onNodeHover((nodo) => {
        estado.current.hover = nodo?.id ?? null;
        if (!estado.current.foco) estado.current.vecinos = nodo?.__vecinos ?? new Set();
        el.style.cursor = nodo ? 'pointer' : 'grab';
        estado.current.props.onHover?.(nodo ?? null);
      })
      .onNodeClick((nodo) => estado.current.props.onClic?.(nodo));

    // Medir ya (el encuadre inicial necesita el tamaño real) y cada vez que cambie.
    const medir = () => {
      if (el.clientWidth && el.clientHeight && (g.width() !== el.clientWidth || g.height() !== el.clientHeight)) g.width(el.clientWidth).height(el.clientHeight);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => {
      ro.disconnect();
      g._destructor();
      grafo.current = null;
    };
  }, []);

  // Datos nuevos.
  useEffect(() => {
    const g = grafo.current;
    if (!g) return;
    const guardadas = posiciones.get(props.clave);
    const nodos: NodoInterno[] = props.nodos.map((n) => {
      const p = guardadas?.get(n.id);
      return { ...n, ...(p ? { x: p.x, y: p.y } : {}), __vecinos: new Set<string>(), __grupo: props.grupo?.(n) ?? null };
    });
    const porId = new Map(nodos.map((n) => [n.id, n]));
    for (const e of props.enlaces) {
      porId.get(e.source)?.__vecinos?.add(e.target);
      porId.get(e.target)?.__vecinos?.add(e.source);
    }
    const enlaces = props.enlaces.map((e) => ({ ...e }));
    // d3 cambia los ids de cada enlace por los nodos mismos al iniciar; aceptamos ambos.
    const nodoDe = (x: string | NodoGrafo) => (typeof x === 'object' ? x : porId.get(x)!);
    const link = g.d3Force('link') as unknown as { distance: (f: (e: EnlaceGrafo) => number) => { strength: (f: (e: EnlaceGrafo) => number) => void } } | undefined;
    link
      ?.distance((e) => props.distancia?.(e, nodoDe(e.source), nodoDe(e.target)) ?? 30)
      .strength((e) => props.fuerza?.(e, nodoDe(e.source), nodoDe(e.target)) ?? 0.5);
    const carga = g.d3Force('charge') as unknown as { strength: (f: (n: NodoGrafo) => number) => { distanceMax: (d: number) => void } } | undefined;
    carga?.strength((n) => props.carga?.(n) ?? -30).distanceMax(420);
    g.d3Force('territorio', props.grupo ? (fuerzaTerritorio(0.05) as never) : null);
    // El acomodo se precalcula antes del primer cuadro (warmup) para que el grafo
    // aparezca ya formado; con posiciones guardadas aparece tal como quedó. Los
    // grafos grandes usan menos iteraciones para no trabar la pantalla.
    const total = nodos.length;
    g.warmupTicks(guardadas ? 0 : total > 1500 ? 30 : total > 600 ? 70 : 150);
    g.cooldownTicks(guardadas ? 0 : total > 1500 ? 160 : 220);
    let primera = true;
    const clave = props.clave;
    g.onEngineStop(() => {
      if (primera && !guardadas) g.zoomToFit(500, 70);
      primera = false;
      posiciones.set(clave, new Map((g.graphData().nodes as NodoInterno[]).filter((n) => n.x !== undefined).map((n) => [n.id, { x: n.x!, y: n.y! }])));
    });
    g.graphData({ nodes: nodos, links: enlaces });
    const encuadre = window.setTimeout(() => {
      const el = contenedor.current;
      if (el?.clientWidth && el.clientHeight) g.width(el.clientWidth).height(el.clientHeight);
      g.zoomToFit(0, 70);
    }, 60);
    const foco = estado.current.foco;
    estado.current.vecinos = foco ? (porId.get(foco)?.__vecinos ?? new Set()) : new Set();
    return () => window.clearTimeout(encuadre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.clave]);

  // Botón «encuadrar» del padre.
  useEffect(() => {
    if (props.encuadrar) grafo.current?.zoomToFit(500, 70);
  }, [props.encuadrar]);

  // Cambio de foco: repintar y centrar.
  useEffect(() => {
    const g = grafo.current;
    estado.current.foco = props.foco ?? null;
    if (!g) return;
    const nodo = (g.graphData().nodes as NodoInterno[]).find((n) => n.id === props.foco);
    estado.current.vecinos = nodo?.__vecinos ?? new Set();
    if (nodo?.x !== undefined) g.centerAt(nodo.x, nodo.y, 600);
    g.linkWidth(g.linkWidth());
    g.linkDirectionalParticles(g.linkDirectionalParticles());
  }, [props.foco]);

  // Cambio de tema.
  useEffect(() => {
    const g = grafo.current;
    if (g) g.linkColor(g.linkColor());
  }, [props.colorTexto, props.colorLinea, props.colorFondo]);

  return <div ref={contenedor} className="grafo" />;
}
