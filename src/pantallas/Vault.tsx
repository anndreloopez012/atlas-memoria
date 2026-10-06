// Un vault por dentro: portada arriba; carpetas a la izquierda; al centro tres
// formas de verlo (Constelación, Mapa y Actividad); y el lector de notas a la
// derecha. La carpeta elegida y la nota abierta viven en la URL.
import { Activity, CircleDot, Maximize2, Network, Search, Share2, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import ArbolCarpetas from '../componentes/ArbolCarpetas';
import type { EnlaceGrafo, NodoGrafo } from '../componentes/Grafo';
import LectorNota from '../componentes/LectorNota';
import Actividad from '../componentes/vault/Actividad';
import MapaCarpetas from '../componentes/vault/MapaCarpetas';
import PortadaVault from '../componentes/vault/PortadaVault';
import { vaultCentral } from '../lib/atlas';
import { cargarVault, useDatos } from '../lib/datos';
import { colorTexto, n, PALETA } from '../lib/formato';
import { navegar, rutaVault } from '../lib/rutas';
import { coloresCanvas, tono, useTema } from '../lib/tema';
import type { Atlas, Carpeta, Nota } from '../lib/tipos';

// El grafo (force-graph) pesa: se carga solo cuando se usa.
const Grafo = lazy(() => import('../componentes/Grafo'));

type Vista = 'constelacion' | 'mapa' | 'actividad';

const VISTAS: { id: Vista; etiqueta: string; Icono: typeof Network; ayuda: string }[] = [
  { id: 'constelacion', etiqueta: 'Constelación', Icono: Network, ayuda: 'Notas y carpetas como una red, con los enlaces entre notas' },
  { id: 'mapa', etiqueta: 'Mapa', Icono: CircleDot, ayuda: 'Carpetas dentro de carpetas: entra con un clic' },
  { id: 'actividad', etiqueta: 'Actividad', Icono: Activity, ayuda: 'Qué cambió y cuándo' },
];

function vistaGuardada(): Vista {
  try {
    const v = localStorage.getItem('atlas-vista-vault');
    if (v === 'constelacion' || v === 'mapa' || v === 'actividad') return v;
  } catch {
    /* sin almacenamiento */
  }
  return 'constelacion';
}

function buscarCarpeta(raiz: Carpeta, ruta: string | null): Carpeta {
  if (!ruta) return raiz;
  let actual = raiz;
  for (const parte of ruta.split('/')) {
    const siguiente = actual.h.find((h) => h.n === parte);
    if (!siguiente) return actual;
    actual = siguiente;
  }
  return actual;
}

// Fuerzas de la constelación. Cada carpeta se aleja de su madre según cuántas notas
// tiene (los grupos grandes necesitan más espacio) y sus notas quedan pegadas a
// ella; los enlaces entre notas tiran poco para no deshacer los racimos.
const distanciaVault = (e: EnlaceGrafo, origen: NodoGrafo, destino: NodoGrafo) => {
  if (e.tipo === 'enlace') return 60;
  if (destino.tipo === 'nota') return 12 + destino.radio + Math.sqrt(origen.peso ?? 1) * 2;
  return 34 + Math.sqrt(destino.peso ?? 1) * 5.5;
};
const fuerzaVault = (e: EnlaceGrafo, _origen: NodoGrafo, destino: NodoGrafo) => (e.tipo === 'enlace' ? 0.025 : destino.tipo === 'nota' ? 0.85 : 0.6);
const cargaVault = (nodo: NodoGrafo) =>
  nodo.tipo === 'nota' ? -7 - nodo.radio * 1.5 : nodo.tipo === 'raiz' ? -90 : -24 - Math.sqrt(nodo.peso ?? 1) * 5;

const sinAcentos = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

interface Props {
  atlas: Atlas;
  slug: string;
  notaId: string | null;
  carpeta: string | null;
}

export default function Vault({ atlas, slug, notaId, carpeta }: Props) {
  const tema = useTema();
  const colores = coloresCanvas(tema);
  const centro = vaultCentral(atlas);
  const resumen = atlas.vaults.find((v) => v.slug === slug) ?? centro ?? atlas.vaults[0];
  const datos = useDatos(`vault:${resumen.slug}`, () => cargarVault(resumen.slug));
  const [vista, setVistaEstado] = useState<Vista>(vistaGuardada);
  // null = automático: con enlaces solo si el alcance es manejable (si no, el grafo es un ovillo).
  const [enlacesElegidos, setConEnlaces] = useState<boolean | null>(null);
  const [filtro, setFiltro] = useState('');
  const [hover, setHover] = useState<NodoGrafo | null>(null);
  const [encuadrar, setEncuadrar] = useState(0);

  const setVista = (v: Vista) => {
    setVistaEstado(v);
    try {
      localStorage.setItem('atlas-vista-vault', v);
    } catch {
      /* sin almacenamiento */
    }
  };

  const nodoCarpeta = buscarCarpeta(resumen.carpetas, carpeta);
  const carpetaReal = nodoCarpeta.p || null;
  const notas = useMemo(() => datos.datos?.notas ?? null, [datos.datos]);

  const { porId, entrantes } = useMemo(() => {
    const porId = new Map<string, Nota>();
    const entrantes = new Map<string, string[]>();
    for (const nota of notas ?? []) porId.set(nota.id, nota);
    for (const nota of notas ?? []) {
      for (const d of nota.o) entrantes.set(d, [...(entrantes.get(d) ?? []), nota.id]);
    }
    return { porId, entrantes };
  }, [notas]);

  // Un color por carpeta de primer nivel (el mismo en todas las vistas).
  const colorDe = useMemo(() => {
    const m = new Map<string, string>();
    resumen.carpetas.h.forEach((c, i) => m.set(c.p, PALETA[i % PALETA.length]));
    return (f: string) => tono(m.get(f.split('/')[0]) ?? '#a8a59b', tema);
  }, [resumen, tema]);

  const notasEnAlcance = useMemo(() => {
    const todas = notas ?? [];
    if (!carpetaReal) return todas;
    return todas.filter((x) => x.f === carpetaReal || x.f.startsWith(`${carpetaReal}/`));
  }, [notas, carpetaReal]);

  // Filtro: texto libre o #etiqueta.
  const coincidencias = useMemo(() => {
    const q = sinAcentos(filtro.trim());
    if (!q) return null;
    const etiqueta = q.startsWith('#') ? q.slice(1) : null;
    return new Set(
      notasEnAlcance
        .filter((x) => (etiqueta !== null ? x.tg.some((t) => sinAcentos(t).startsWith(etiqueta)) : sinAcentos(`${x.t} ${x.f} ${x.tg.join(' ')}`).includes(q)))
        .map((x) => x.id),
    );
  }, [notasEnAlcance, filtro]);
  const filtradas = useMemo(() => (coincidencias ? notasEnAlcance.filter((x) => coincidencias.has(x.id)) : notasEnAlcance), [notasEnAlcance, coincidencias]);

  const conEnlaces = enlacesElegidos ?? filtradas.length <= 1200;

  // Grafo estructurado: raíz → carpetas → notas, más los enlaces entre notas.
  const grafo = useMemo(() => {
    const nodos: NodoGrafo[] = [];
    const enlaces: EnlaceGrafo[] = [];
    const ids = new Set(filtradas.map((x) => x.id));
    const raizId = `carpeta:${carpetaReal ?? ''}`;
    nodos.push({ id: raizId, etiqueta: carpetaReal ? nodoCarpeta.n : resumen.nombre, color: resumen.color, radio: 9, tipo: 'raiz', fija: true });
    // Carpetas con notas en alcance y cuántas notas cuelgan de cada una (peso).
    const pesos = new Map<string, number>();
    for (const x of filtradas) {
      let ruta = x.f;
      while (ruta && ruta !== carpetaReal) {
        pesos.set(ruta, (pesos.get(ruta) ?? 0) + 1);
        ruta = ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '';
      }
    }
    const carpetasUsadas = new Set(pesos.keys());
    nodos[0].peso = filtradas.length;
    for (const ruta of carpetasUsadas) {
      const c = buscarCarpeta(resumen.carpetas, ruta);
      const padre = ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '';
      const padreId = carpetasUsadas.has(padre) ? `carpeta:${padre}` : raizId;
      nodos.push({ id: `carpeta:${ruta}`, etiqueta: ruta.split('/').pop()!, color: colorDe(ruta), radio: 3.5 + Math.sqrt(c.t) * 0.55, tipo: 'carpeta', peso: pesos.get(ruta), fija: pesos.get(ruta)! >= 4 && ruta.split('/').length <= (carpetaReal ? carpetaReal.split('/').length + 1 : 1) });
      enlaces.push({ source: padreId, target: `carpeta:${ruta}`, tipo: 'arbol' });
    }
    for (const x of filtradas) {
      const grado = x.o.length + (entrantes.get(x.id)?.length ?? 0) + x.x.length + x.xb.length;
      nodos.push({ id: x.id, etiqueta: x.t, color: colorDe(x.f), radio: 1.8 + Math.min(7, Math.sqrt(grado) * 0.8), tipo: 'nota' });
      enlaces.push({ source: x.f && x.f !== carpetaReal && carpetasUsadas.has(x.f) ? `carpeta:${x.f}` : raizId, target: x.id, tipo: 'arbol' });
      if (conEnlaces) for (const d of x.o) if (ids.has(d)) enlaces.push({ source: x.id, target: d, tipo: 'enlace' });
    }
    return { nodos, enlaces };
  }, [filtradas, carpetaReal, conEnlaces, resumen, nodoCarpeta, colorDe, entrantes]);

  // Territorio de cada nodo en la constelación: la carpeta del nivel siguiente al alcance.
  const nivelGrupo = carpetaReal ? carpetaReal.split('/').length : 0;
  const grupo = useMemo(
    () => (nodo: NodoGrafo) => {
      const ruta = nodo.tipo === 'nota' ? porId.get(nodo.id)?.f : nodo.tipo === 'carpeta' ? nodo.id.slice(8) : null;
      if (!ruta) return null;
      const partes = ruta.split('/');
      if (partes.length <= nivelGrupo) return null;
      const clave = partes.slice(0, nivelGrupo + 1).join('/');
      return { clave, color: colorDe(clave), etiqueta: partes[nivelGrupo] };
    },
    [porId, nivelGrupo, colorDe],
  );

  const nota = notaId ? porId.get(notaId) : null;
  const cerrarNota = () => navegar(rutaVault(resumen.slug, null, carpetaReal));

  // Esc cierra la nota abierta.
  useEffect(() => {
    if (!nota) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement)?.closest('input, textarea')) cerrarNota();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nota, resumen.slug, carpetaReal]);

  const irACarpeta = (c: string | null) => navegar(rutaVault(resumen.slug, notaId, c));
  const enlaceDe = (id: string) => rutaVault(resumen.slug, id, carpetaReal);
  const sinNotas = notas !== null && notas.length === 0;

  return (
    <div className={`vault ${nota ? 'con-lector' : ''}`} style={{ ['--vault' as string]: resumen.color, ['--acento' as string]: colorTexto(resumen.color) }}>
      <PortadaVault atlas={atlas} vault={resumen} notas={notas} porId={porId} onEtiqueta={setFiltro} />

      <div className="vault-cuerpo">
        <aside className="panel-carpetas" aria-label="Carpetas">
          <ArbolCarpetas raiz={resumen.carpetas} seleccion={carpetaReal} nombreVault={resumen.nombre} colorDe={colorDe} onSeleccion={irACarpeta} />
          {resumen.generados > 0 && <p className="arbol-pie mono">+ {n(resumen.generados)} notas generadas por herramientas (no se cargan)</p>}
        </aside>

        <section className={`lienzo vista-${vista}`} aria-label="Notas">
          <div className="lienzo-barra">
            <div className="lienzo-titulo">
              <span className="rotulo">{carpetaReal ?? 'Todo el vault'}</span>
              <span className="mono">
                {coincidencias ? `${n(filtradas.length)} de ` : ''}
                {n(notasEnAlcance.length)} notas
              </span>
            </div>
            <label className="filtro">
              <Search size={14} />
              <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por título, carpeta o #etiqueta" aria-label="Filtrar notas" />
              {filtro && (
                <button className="filtro-limpiar" onClick={() => setFiltro('')} aria-label="Quitar filtro">
                  <X size={13} />
                </button>
              )}
            </label>
            <div className="conmutador" role="tablist" aria-label="Forma de ver el vault">
              {VISTAS.map(({ id, etiqueta, Icono, ayuda }) => (
                <button key={id} role="tab" aria-selected={vista === id} className={vista === id ? 'activo' : ''} onClick={() => setVista(id)} title={ayuda}>
                  <Icono size={14} /> <span className="conmutador-texto">{etiqueta}</span>
                </button>
              ))}
            </div>
            {vista === 'constelacion' && (
              <>
                <button className={`chip ${conEnlaces ? 'activo' : ''}`} onClick={() => setConEnlaces(!conEnlaces)} title="Mostrar los enlaces entre notas además de la estructura de carpetas">
                  <Share2 size={13} /> Enlaces
                </button>
                <button className="icono-boton" onClick={() => setEncuadrar((x) => x + 1)} title="Encuadrar todo el grafo" aria-label="Encuadrar todo el grafo">
                  <Maximize2 size={15} />
                </button>
              </>
            )}
          </div>

          {/* En pantallas chicas las carpetas son una fila de chips. */}
          <div className="carpetas-chips" role="list" aria-label="Carpetas">
            <button role="listitem" className={`chip ${carpetaReal === null ? 'activo' : ''}`} onClick={() => irACarpeta(null)}>
              Todo · {n(resumen.notas)}
            </button>
            {(nodoCarpeta.h.length ? nodoCarpeta.h : resumen.carpetas.h).map((c) => (
              <button role="listitem" key={c.p} className={`chip ${carpetaReal === c.p ? 'activo' : ''}`} onClick={() => irACarpeta(c.p)}>
                <span className="chip-punto" style={{ background: colorDe(c.p) }} />
                {c.n} <span className="mono">{n(c.t)}</span>
              </button>
            ))}
          </div>

          {datos.cargando && !datos.datos && (
            <div className="lienzo-cargando">
              <div className="cargando-orbita" aria-hidden="true" />
              <p className="rotulo">Abriendo {resumen.nombre}…</p>
            </div>
          )}
          {datos.error && <p className="vacio">{datos.error}</p>}
          {sinNotas && (
            <div className="lienzo-vacio">
              <p className="display">Este vault todavía no tiene notas</p>
              <p>Cuando escribas en Obsidian, aparecerán aquí solas.</p>
            </div>
          )}

          {notas && !sinNotas && vista === 'constelacion' && (
            <div className="lienzo-grafo">
              <Suspense fallback={<div className="lienzo-cargando"><div className="cargando-orbita" aria-hidden="true" /></div>}>
                <Grafo
                  clave={`${resumen.slug}|${carpetaReal}|${filtro}|${conEnlaces}|${tema}`}
                  nodos={grafo.nodos}
                  enlaces={grafo.enlaces}
                  foco={notaId}
                  colorTexto={colores.texto}
                  colorLinea={colores.linea}
                  colorEnlace={colores.enlace}
                  colorFondo={colores.fondo}
                  colorAcento={tono(resumen.color, tema)}
                  grupo={grupo}
                  distancia={distanciaVault}
                  fuerza={fuerzaVault}
                  carga={cargaVault}
                  onHover={setHover}
                  encuadrar={encuadrar}
                  onClic={(nodo) => {
                    if (nodo.tipo === 'nota') navegar(enlaceDe(nodo.id));
                    else irACarpeta(nodo.id.slice(8) || null);
                  }}
                />
              </Suspense>
              <div className="leyenda">
                {(nodoCarpeta.h.length ? nodoCarpeta.h : resumen.carpetas.h).slice(0, 12).map((c) => (
                  <button key={c.p} onClick={() => irACarpeta(c.p)}>
                    <span style={{ background: colorDe(c.p) }} />
                    {c.n}
                  </button>
                ))}
              </div>
              {hover && hover.tipo === 'nota' && porId.get(hover.id) && (
                <div className="grafo-hover" style={{ ['--c' as string]: hover.color }}>
                  <strong>{porId.get(hover.id)!.t}</strong>
                  <span className="mono">{porId.get(hover.id)!.f || 'raíz'}</span>
                  {porId.get(hover.id)!.ex && <p>{porId.get(hover.id)!.ex}</p>}
                </div>
              )}
              <p className="grafo-ayuda mono">rueda: zoom · arrastra: mover · clic: abrir</p>
            </div>
          )}

          {notas && !sinNotas && vista === 'mapa' && (
            <MapaCarpetas
              vault={resumen}
              notas={notas}
              carpeta={carpetaReal}
              notaId={notaId}
              coincidencias={coincidencias}
              colorDe={colorDe}
              onCarpeta={irACarpeta}
              onNota={(id) => navegar(enlaceDe(id))}
            />
          )}

          {notas && !sinNotas && vista === 'actividad' && <Actividad notas={filtradas} color={tono(resumen.color, tema)} notaId={notaId} colorDe={colorDe} enlaceDe={enlaceDe} />}
        </section>

        {nota && datos.datos && (
          <LectorNota atlas={atlas} nota={nota} datos={datos.datos} porId={porId} entrantes={entrantes.get(nota.id) ?? []} carpeta={carpetaReal} cerrar={cerrarNota} />
        )}
      </div>
    </div>
  );
}
