// Lienzo de grafo genérico (force-graph sobre canvas). Lo usan el vault y la red
// de skills. Los datos solo se recargan cuando cambia `clave`; el foco y el hover
// solo repintan.
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
  distancia?: (e: EnlaceGrafo) => number;
  fuerza?: (e: EnlaceGrafo) => number;
  carga?: (n: NodoGrafo) => number;
  onClic?: (n: NodoGrafo) => void;
  onHover?: (n: NodoGrafo | null) => void;
  /** cambia este número para volver a encuadrar */
  encuadrar?: number;
}

type FG = InstanceType<typeof ForceGraph<NodoGrafo & { __vecinos?: Set<string> }, EnlaceGrafo>>;

export default function Grafo(props: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const grafo = useRef<FG | null>(null);
  const estado = useRef({ foco: props.foco ?? null, hover: null as string | null, vecinos: new Set<string>(), props });
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
        const { foco, hover, vecinos, props: p } = estado.current;
        const activo = foco ?? hover;
        const atenuado = activo && nodo.id !== activo && !vecinos.has(nodo.id);
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
          ctx.beginPath();
          ctx.arc(nodo.x!, nodo.y!, r, 0, Math.PI * 2);
          ctx.fillStyle = nodo.color;
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
          (nodo.fija && escala > 0.12) ||
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

    const ro = new ResizeObserver(() => g.width(el.clientWidth).height(el.clientHeight));
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
    const nodos = props.nodos.map((n) => ({ ...n, __vecinos: new Set<string>() }));
    const porId = new Map(nodos.map((n) => [n.id, n]));
    for (const e of props.enlaces) {
      porId.get(e.source)?.__vecinos.add(e.target);
      porId.get(e.target)?.__vecinos.add(e.source);
    }
    const enlaces = props.enlaces.map((e) => ({ ...e }));
    const link = g.d3Force('link') as unknown as { distance: (f: (e: EnlaceGrafo) => number) => { strength: (f: (e: EnlaceGrafo) => number) => void } } | undefined;
    link?.distance((e) => props.distancia?.(e) ?? 30).strength((e) => props.fuerza?.(e) ?? 0.5);
    const carga = g.d3Force('charge') as unknown as { strength: (f: (n: NodoGrafo) => number) => { distanceMax: (d: number) => void } } | undefined;
    carga?.strength((n) => props.carga?.(n) ?? -30).distanceMax(420);
    // Grafos grandes: menos iteraciones. Se encuadra a mitad del acomodo y al terminar.
    g.cooldownTicks(nodos.length > 1500 ? 140 : 260);
    let primera = true;
    g.onEngineStop(() => {
      if (primera) g.zoomToFit(600, 50);
      primera = false;
    });
    g.graphData({ nodes: nodos, links: enlaces });
    const encuadre = window.setTimeout(() => g.zoomToFit(600, 50), 1400);
    const foco = estado.current.foco;
    estado.current.vecinos = foco ? (porId.get(foco)?.__vecinos ?? new Set()) : new Set();
    return () => window.clearTimeout(encuadre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.clave]);

  // Botón «encuadrar» del padre.
  useEffect(() => {
    if (props.encuadrar) grafo.current?.zoomToFit(500, 50);
  }, [props.encuadrar]);

  // Cambio de foco: repintar y centrar.
  useEffect(() => {
    const g = grafo.current;
    estado.current.foco = props.foco ?? null;
    if (!g) return;
    const nodo = (g.graphData().nodes as (NodoGrafo & { __vecinos?: Set<string> })[]).find((n) => n.id === props.foco);
    estado.current.vecinos = nodo?.__vecinos ?? new Set();
    if (nodo?.x !== undefined) g.centerAt(nodo.x, nodo.y, 600);
    g.linkWidth(g.linkWidth());
  }, [props.foco]);

  // Cambio de tema.
  useEffect(() => {
    const g = grafo.current;
    if (g) g.linkColor(g.linkColor());
  }, [props.colorTexto, props.colorLinea, props.colorFondo]);

  return <div ref={contenedor} className="grafo" />;
}
