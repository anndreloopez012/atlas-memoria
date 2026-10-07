// Todas las notas de todos los vaults como una red (enlaces en ambos sentidos,
// incluidos los puentes entre vaults), para encontrar cómo se conectan dos notas.
// Se arma solo cuando alguien lo pide y se reutiliza mientras no cambien los datos.
import { cargarVault } from './datos';
import type { Atlas } from './tipos';

export interface NotaMin {
  id: string;
  /** slug del vault */
  s: string;
  v: string;
  t: string;
  f: string;
  color: string;
}

export interface GrafoNotas {
  notas: Map<string, NotaMin>;
  vecinos: Map<string, Set<string>>;
}

let cache: { version: number; grafo: Promise<GrafoNotas> } | null = null;

export function cargarGrafoNotas(atlas: Atlas, version: number): Promise<GrafoNotas> {
  if (cache?.version === version) return cache.grafo;
  const grafo = Promise.all(atlas.vaults.map((v) => cargarVault(v.slug))).then((datos) => {
    const notas = new Map<string, NotaMin>();
    const vecinos = new Map<string, Set<string>>();
    const unir = (a: string, b: string) => {
      if (a === b) return;
      if (!vecinos.has(a)) vecinos.set(a, new Set());
      if (!vecinos.has(b)) vecinos.set(b, new Set());
      vecinos.get(a)!.add(b);
      vecinos.get(b)!.add(a);
    };
    atlas.vaults.forEach((v, i) => {
      for (const n of datos[i].notas) {
        notas.set(n.id, { id: n.id, s: v.slug, v: v.nombre, t: n.t, f: n.f, color: v.color });
        for (const d of [...n.o, ...n.x, ...n.xb]) unir(n.id, d);
      }
    });
    return { notas, vecinos };
  });
  cache = { version, grafo };
  return grafo;
}

/** Camino más corto (por enlaces) entre dos notas, o null si no se conectan. */
export function camino(grafo: GrafoNotas, desde: string, hasta: string, maximo = 10): string[] | null {
  if (desde === hasta) return [desde];
  const previo = new Map<string, string>([[desde, '']]);
  let frente = [desde];
  for (let paso = 0; paso < maximo && frente.length; paso++) {
    const siguiente: string[] = [];
    for (const id of frente) {
      for (const v of grafo.vecinos.get(id) ?? []) {
        if (previo.has(v)) continue;
        previo.set(v, id);
        if (v === hasta) {
          const ruta = [v];
          let actual = id;
          while (actual) {
            ruta.unshift(actual);
            actual = previo.get(actual)!;
          }
          return ruta;
        }
        siguiente.push(v);
      }
    }
    frente = siguiente;
  }
  return null;
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Notas cuyo título coincide con el texto (primero las que empiezan igual). */
export function buscarNotas(grafo: GrafoNotas, texto: string, cuantas = 6, excluir?: string): NotaMin[] {
  const q = normalizar(texto.trim());
  if (q.length < 2) return [];
  const empiezan: NotaMin[] = [];
  const contienen: NotaMin[] = [];
  for (const n of grafo.notas.values()) {
    if (n.id === excluir) continue;
    const t = normalizar(n.t);
    if (t.startsWith(q)) empiezan.push(n);
    else if (t.includes(q)) contienen.push(n);
    if (empiezan.length >= cuantas) break;
  }
  return [...empiezan, ...contienen].slice(0, cuantas);
}
