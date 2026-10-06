// Cerebros de neuronas para dibujar los vaults: la silueta de un cerebro humano
// (vista lateral, la frente a la izquierda) con sus surcos, llena de neuronas
// conectadas por sinapsis. Todo es determinista: la misma semilla (el vault) da
// siempre el mismo cerebro, y el resultado se guarda para no recalcularlo.
//
// Las coordenadas son normalizadas: el cerebro va de x = -1 a x = 1 y de
// y ≈ -0,8 a y ≈ 0,9. Quien lo dibuja lo escala al tamaño del vault.

/** Silueta: lóbulos frontal, parietal, occipital y temporal, cerebelo y tronco. */
export const CONTORNO =
  'M-0.97 0.06 C-1.04 -0.3 -0.8 -0.66 -0.38 -0.74 C0.02 -0.82 0.48 -0.76 0.74 -0.54 C0.96 -0.36 1.03 -0.06 0.93 0.17 C0.99 0.36 0.87 0.58 0.63 0.61 C0.5 0.63 0.42 0.58 0.37 0.52 C0.37 0.64 0.36 0.76 0.33 0.87 L0.21 0.87 C0.21 0.74 0.22 0.6 0.2 0.49 C0.03 0.47 -0.26 0.48 -0.46 0.37 C-0.6 0.3 -0.66 0.2 -0.71 0.17 C-0.82 0.17 -0.93 0.17 -0.97 0.06 Z';

/** Surcos y cisuras (curvas cúbicas) y cuánto espacio dejan libre de neuronas. */
const SURCOS: { p: number[]; ancho: number }[] = [
  { p: [-0.66, 0.15, -0.42, 0.08, -0.12, 0.06, 0.24, -0.1], ancho: 0.045 }, // cisura lateral (Silvio)
  { p: [0.04, -0.79, -0.02, -0.58, 0.1, -0.42, 0.02, -0.1], ancho: 0.04 }, // surco central (Rolando)
  { p: [-0.8, -0.42, -0.62, -0.48, -0.46, -0.4, -0.26, -0.5], ancho: 0.03 }, // frontal superior
  { p: [-0.88, -0.12, -0.68, -0.2, -0.52, -0.1, -0.32, -0.2], ancho: 0.03 }, // frontal inferior
  { p: [-0.56, 0.27, -0.32, 0.24, -0.06, 0.3, 0.24, 0.2], ancho: 0.03 }, // temporal superior
  { p: [0.3, -0.42, 0.48, -0.44, 0.6, -0.3, 0.78, -0.36], ancho: 0.03 }, // intraparietal
  { p: [0.36, 0.47, 0.55, 0.38, 0.78, 0.32, 0.93, 0.18], ancho: 0.045 }, // cerebro / cerebelo
  { p: [0.48, 0.54, 0.62, 0.5, 0.76, 0.46, 0.88, 0.37], ancho: 0.022 }, // folias del cerebelo
];

export const SURCOS_D = SURCOS.map(({ p }) => `M${p[0]} ${p[1]} C${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}`).join(' ');

// Cada surco como polilínea, para medir distancias y cruces.
const TRAMOS: { a: [number, number]; b: [number, number]; ancho: number }[] = [];
for (const { p, ancho } of SURCOS) {
  let previo: [number, number] = [p[0], p[1]];
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    const punto: [number, number] = [
      u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6],
      u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7],
    ];
    TRAMOS.push({ a: previo, b: punto, ancho });
    previo = punto;
  }
}

function distanciaATramo(x: number, y: number, [ax, ay]: [number, number], [bx, by]: [number, number]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

function cruzan(p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]) {
  const giro = (a: [number, number], b: [number, number], c: [number, number]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return giro(p1, p2, p3) * giro(p1, p2, p4) < 0 && giro(p3, p4, p1) * giro(p3, p4, p2) < 0;
}

// ¿El punto cae dentro de la silueta? Se usa el lienzo del navegador; sin él, una
// aproximación con elipses (cerebro, lóbulo temporal y cerebelo).
let lienzo: CanvasRenderingContext2D | null | undefined;
let silueta: Path2D | null = null;
function dentro(x: number, y: number) {
  if (lienzo === undefined) {
    lienzo = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    if (lienzo) {
      silueta = new Path2D(CONTORNO);
      lienzo.setTransform(100, 0, 0, 100, 150, 150);
    }
  }
  if (lienzo && silueta) return lienzo.isPointInPath(silueta, x * 100 + 150, y * 100 + 150);
  const en = (cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  return en(0, -0.06, 0.97, 0.72) || en(-0.12, 0.3, 0.55, 0.2) || en(0.62, 0.42, 0.3, 0.2);
}

/** Generador pseudoaleatorio con semilla (mulberry32 sobre un hash del texto). */
function azar(semilla: string) {
  let h = 1779033703 ^ semilla.length;
  for (let i = 0; i < semilla.length; i++) {
    h = Math.imul(h ^ semilla.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Neurona {
  x: number;
  y: number;
  /** 0 a 1: tamaño relativo del soma */
  peso: number;
  /** distancia al centro (0 a 1), para encender el cerebro desde adentro */
  centro: number;
  /** índice del lóbulo (carpeta principal) que representa, o -1 */
  lobulo: number;
  /** [retraso, duración] en segundos si es de las que se disparan */
  chispa: [number, number] | null;
}

export interface Cerebro {
  neuronas: Neurona[];
  /** todas las sinapsis en un solo trazo */
  sinapsis: string;
  /** haces largos entre los lóbulos */
  fibras: string;
  /** ramas de las neuronas grandes */
  dendritas: string;
  /** recorridos de los impulsos eléctricos */
  impulsos: { d: string; retraso: number; duracion: number }[];
}

const cache = new Map<string, Cerebro>();
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Arma (o devuelve ya armado) el cerebro de `cantidad` neuronas con `lobulos` neuronas principales. */
export function generarCerebro(semilla: string, cantidad: number, lobulos = 0): Cerebro {
  const clave = `${semilla}|${cantidad}|${lobulos}`;
  const guardado = cache.get(clave);
  if (guardado) return guardado;

  const rnd = azar(semilla);
  const candidato = (): [number, number] => {
    for (let intento = 0; intento < 400; intento++) {
      const x = -1.02 + rnd() * 2.04;
      const y = -0.82 + rnd() * 1.72;
      if (!dentro(x, y)) continue;
      if (TRAMOS.some((s) => distanciaATramo(x, y, s.a, s.b) < s.ancho)) continue;
      return [x, y];
    }
    return [0, -0.2];
  };

  // Muestreo «mejor candidato»: cada neurona nueva cae lejos de las anteriores, así
  // el tejido queda parejo y orgánico (sin grumos ni cuadrícula).
  const puntos: [number, number][] = [];
  for (let i = 0; i < cantidad; i++) {
    let mejor: [number, number] = candidato();
    let mejorD = -1;
    for (let k = 0; k < 9; k++) {
      const c = k === 0 ? mejor : candidato();
      let d = Infinity;
      for (const p of puntos) d = Math.min(d, (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2);
      if (d > mejorD) {
        mejorD = d;
        mejor = c;
      }
    }
    puntos.push(mejor);
  }

  const espaciado = Math.sqrt(2.3 / Math.max(cantidad, 1));
  const cx = puntos.reduce((t, p) => t + p[0], 0) / Math.max(puntos.length, 1);
  const cy = puntos.reduce((t, p) => t + p[1], 0) / Math.max(puntos.length, 1);
  const maxR = Math.max(...puntos.map((p) => Math.hypot(p[0] - cx, p[1] - cy)), 0.01);

  const neuronas: Neurona[] = puntos.map(([x, y]) => ({
    x: r3(x),
    y: r3(y),
    peso: Math.pow(rnd(), 2.6) * 0.8,
    centro: Math.hypot(x - cx, y - cy) / maxR,
    lobulo: -1,
    chispa: null,
  }));

  // Lóbulos: neuronas principales repartidas por todo el cerebro (la más lejana de
  // las ya elegidas cada vez).
  const principales: number[] = [];
  if (lobulos > 0 && neuronas.length) {
    principales.push(Math.floor(rnd() * neuronas.length));
    while (principales.length < Math.min(lobulos, neuronas.length)) {
      let mejor = 0;
      let mejorD = -1;
      neuronas.forEach((nn, i) => {
        const d = Math.min(...principales.map((j) => (neuronas[j].x - nn.x) ** 2 + (neuronas[j].y - nn.y) ** 2));
        if (d > mejorD) {
          mejorD = d;
          mejor = i;
        }
      });
      principales.push(mejor);
    }
    principales.forEach((i, lobulo) => {
      neuronas[i].lobulo = lobulo;
      neuronas[i].peso = 1;
    });
  }

  // Sinapsis: cada neurona con sus 2 o 3 vecinas más cercanas, sin cruzar un surco.
  const vecinos: number[][] = neuronas.map(() => []);
  const vistas = new Set<string>();
  let sinapsis = '';
  neuronas.forEach((a, i) => {
    const cercanas = neuronas
      .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }))
      .filter((c) => c.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, a.lobulo >= 0 ? 6 : 4);
    const cuantas = a.lobulo >= 0 ? 6 : rnd() < 0.45 ? 3 : 2;
    for (const { j, d } of cercanas.slice(0, cuantas)) {
      if (Math.sqrt(d) > espaciado * 2.4) continue;
      const clave = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (vistas.has(clave)) continue;
      const b = neuronas[j];
      if (TRAMOS.some((s) => cruzan([a.x, a.y], [b.x, b.y], s.a, s.b))) continue;
      vistas.add(clave);
      vecinos[i].push(j);
      vecinos[j].push(i);
      sinapsis += `M${a.x} ${a.y}L${b.x} ${b.y}`;
    }
  });

  // Fibras: haces curvos entre cada lóbulo y sus dos lóbulos más cercanos.
  let fibras = '';
  const hechas = new Set<string>();
  for (const i of principales) {
    const otros = principales
      .filter((j) => j !== i)
      .sort((p, q) => (neuronas[p].x - neuronas[i].x) ** 2 + (neuronas[p].y - neuronas[i].y) ** 2 - ((neuronas[q].x - neuronas[i].x) ** 2 + (neuronas[q].y - neuronas[i].y) ** 2))
      .slice(0, 2);
    for (const j of otros) {
      const clave = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (hechas.has(clave)) continue;
      hechas.add(clave);
      const a = neuronas[i];
      const b = neuronas[j];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const largo = Math.hypot(b.x - a.x, b.y - a.y);
      const lado = rnd() < 0.5 ? -1 : 1;
      const qx = mx + ((-(b.y - a.y) / (largo || 1)) * largo * 0.22 * lado);
      const qy = my + (((b.x - a.x) / (largo || 1)) * largo * 0.22 * lado);
      fibras += `M${a.x} ${a.y}Q${r3(qx)} ${r3(qy)} ${b.x} ${b.y}`;
    }
  }

  // Dendritas: las neuronas grandes echan ramas cortas que se bifurcan.
  let dendritas = '';
  neuronas.forEach((nn) => {
    if (nn.peso < 0.5) return;
    const ramas = 4 + Math.floor(rnd() * 3);
    for (let k = 0; k < ramas; k++) {
      const a = (k / ramas) * Math.PI * 2 + rnd() * 0.9;
      const largo = espaciado * (0.65 + rnd() * 0.7) * (0.8 + nn.peso * 0.7);
      const fx = nn.x + Math.cos(a) * largo;
      const fy = nn.y + Math.sin(a) * largo;
      const curva = a + (rnd() - 0.5) * 0.9;
      const qx = nn.x + Math.cos(curva) * largo * 0.55;
      const qy = nn.y + Math.sin(curva) * largo * 0.55;
      dendritas += `M${nn.x} ${nn.y}Q${r3(qx)} ${r3(qy)} ${r3(fx)} ${r3(fy)}`;
      const bx = nn.x + Math.cos(a) * largo * 0.6;
      const by = nn.y + Math.sin(a) * largo * 0.6;
      const b2 = a + (rnd() < 0.5 ? -0.7 : 0.7);
      dendritas += `M${r3(bx)} ${r3(by)}L${r3(bx + Math.cos(b2) * largo * 0.45)} ${r3(by + Math.sin(b2) * largo * 0.45)}`;
    }
  });

  // Impulsos: caminatas cortas por las sinapsis, sin volver sobre sus pasos.
  const impulsos: Cerebro['impulsos'] = [];
  const conVecinos = neuronas.map((_, i) => i).filter((i) => vecinos[i].length > 0);
  const totalImpulsos = Math.max(3, Math.min(12, Math.round(3 + cantidad / 24)));
  for (let k = 0; k < totalImpulsos && conVecinos.length; k++) {
    let actual = conVecinos[Math.floor(rnd() * conVecinos.length)];
    let previo = -1;
    let d = `M${neuronas[actual].x} ${neuronas[actual].y}`;
    const pasos = 4 + Math.floor(rnd() * 3);
    for (let p = 0; p < pasos; p++) {
      const opciones = vecinos[actual].filter((j) => j !== previo);
      if (!opciones.length) break;
      previo = actual;
      actual = opciones[Math.floor(rnd() * opciones.length)];
      d += `L${neuronas[actual].x} ${neuronas[actual].y}`;
    }
    impulsos.push({ d, retraso: r3(rnd() * 6), duracion: r3(2.2 + rnd() * 2.2) });
  }

  // Chispas: unas pocas neuronas se encienden de vez en cuando.
  const totalChispas = Math.min(16, Math.max(3, Math.round(cantidad * 0.08)));
  for (let k = 0; k < totalChispas && neuronas.length; k++) {
    neuronas[Math.floor(rnd() * neuronas.length)].chispa = [r3(rnd() * 7), r3(3 + rnd() * 4)];
  }

  const cerebro = { neuronas, sinapsis, fibras, dendritas, impulsos };
  cache.set(clave, cerebro);
  return cerebro;
}

/** Cuántas neuronas lleva un vault: crecen con sus notas, con un mínimo y un tope. */
export function neuronasPara(notas: number, tope = 280) {
  return Math.max(24, Math.min(tope, Math.round(24 + 8.5 * Math.sqrt(notas))));
}

/**
 * Punto del borde del cerebro (aproximado como elipse) en la dirección (ux, uy),
 * para que los haces entre cerebros nazcan en la corteza y no en el centro.
 */
export function bordeCerebro(x: number, y: number, ancho: number, ux: number, uy: number) {
  const rx = ancho * 0.96;
  const ry = ancho * 0.78;
  const k = 1 / Math.sqrt((ux / rx) ** 2 + (uy / ry) ** 2);
  return { x: x + ux * k, y: y + uy * k };
}
