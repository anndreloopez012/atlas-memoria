// Un vault por dentro: carpetas a la izquierda, grafo o lista al centro y el
// lector de notas a la derecha. La carpeta elegida vive en la URL.
import { Clock, Maximize2, Network, Search, Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import ArbolCarpetas from '../componentes/ArbolCarpetas';
import Grafo, { type EnlaceGrafo, type NodoGrafo } from '../componentes/Grafo';
import LectorNota from '../componentes/LectorNota';
import SelectorVaults from '../componentes/SelectorVaults';
import { vaultCentral } from '../lib/atlas';
import { cargarVault, useDatos } from '../lib/datos';
import { colorTexto, hace, n, PALETA } from '../lib/formato';
import { navegar, rutaVault } from '../lib/rutas';
import { coloresCanvas, tono, useTema } from '../lib/tema';
import type { Atlas, Carpeta, Nota } from '../lib/tipos';

interface Props {
  atlas: Atlas;
  slug: string;
  notaId: string | null;
  carpeta: string | null;
}

const LIMITE_LISTA = 200;

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

export default function Vault({ atlas, slug, notaId, carpeta }: Props) {
  const tema = useTema();
  const colores = coloresCanvas(tema);
  const centro = vaultCentral(atlas);
  const resumen = atlas.vaults.find((v) => v.slug === slug) ?? centro ?? atlas.vaults[0];
  const datos = useDatos(`vault:${resumen.slug}`, () => cargarVault(resumen.slug));
  const [vista, setVista] = useState<'grafo' | 'lista'>('grafo');
  // null = automático: con enlaces solo si el alcance es manejable (si no, el grafo es un ovillo).
  const [enlacesElegidos, setConEnlaces] = useState<boolean | null>(null);
  const [filtro, setFiltro] = useState('');
  const [limite, setLimite] = useState(LIMITE_LISTA);
  const [hover, setHover] = useState<NodoGrafo | null>(null);
  const [encuadrar, setEncuadrar] = useState(0);

  const indice = atlas.vaults.indexOf(resumen);
  const nodoCarpeta = buscarCarpeta(resumen.carpetas, carpeta);
  const carpetaReal = nodoCarpeta.p || null;

  const { porId, entrantes } = useMemo(() => {
    const porId = new Map<string, Nota>();
    const entrantes = new Map<string, string[]>();
    for (const nota of datos.datos?.notas ?? []) porId.set(nota.id, nota);
    for (const nota of datos.datos?.notas ?? []) {
      for (const d of nota.o) entrantes.set(d, [...(entrantes.get(d) ?? []), nota.id]);
    }
    return { porId, entrantes };
  }, [datos.datos]);

  // Color por carpeta de primer nivel.
  const colorDe = useMemo(() => {
    const m = new Map<string, string>();
    resumen.carpetas.h.forEach((c, i) => m.set(c.p, PALETA[i % PALETA.length]));
    return (f: string) => tono(m.get(f.split('/')[0]) ?? '#a8a59b', tema);
  }, [resumen, tema]);

  const notasEnAlcance = useMemo(() => {
    const todas = datos.datos?.notas ?? [];
    if (!carpetaReal) return todas;
    return todas.filter((x) => x.f === carpetaReal || x.f.startsWith(`${carpetaReal}/`));
  }, [datos.datos, carpetaReal]);

  const conEnlaces = enlacesElegidos ?? notasEnAlcance.length <= 1200;

  const filtradas = useMemo(() => {
    const q = filtro
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const base = q
      ? notasEnAlcance.filter((x) =>
          `${x.t} ${x.f} ${x.tg.join(' ')}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .includes(q),
        )
      : notasEnAlcance;
    return [...base].sort((a, b) => b.m.localeCompare(a.m));
  }, [notasEnAlcance, filtro]);

  // Grafo estructurado: raíz → carpetas → notas, más los enlaces entre notas.
  const grafo = useMemo(() => {
    const nodos: NodoGrafo[] = [];
    const enlaces: EnlaceGrafo[] = [];
    const ids = new Set(filtradas.map((x) => x.id));
    const raizId = `carpeta:${carpetaReal ?? ''}`;
    nodos.push({ id: raizId, etiqueta: carpetaReal ? nodoCarpeta.n : resumen.nombre, color: resumen.color, radio: 9, tipo: 'raiz', fija: true });
    const carpetasUsadas = new Set<string>();
    for (const x of filtradas) {
      // Asegura la cadena de carpetas desde la raíz del alcance hasta la nota.
      let ruta = x.f;
      while (ruta && ruta !== carpetaReal && !carpetasUsadas.has(ruta)) {
        carpetasUsadas.add(ruta);
        ruta = ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '';
      }
    }
    for (const ruta of carpetasUsadas) {
      const c = buscarCarpeta(resumen.carpetas, ruta);
      const padre = ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '';
      const padreId = carpetasUsadas.has(padre) ? `carpeta:${padre}` : raizId;
      nodos.push({ id: `carpeta:${ruta}`, etiqueta: ruta.split('/').pop()!, color: colorDe(ruta), radio: 3.5 + Math.sqrt(c.t) * 0.55, tipo: 'carpeta', fija: ruta.split('/').length <= (carpetaReal ? carpetaReal.split('/').length + 1 : 1) });
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

  const nota = notaId ? porId.get(notaId) : null;
  const total = notasEnAlcance.length;

  return (
    <div className={`vault ${nota ? 'con-lector' : ''}`} style={{ ['--vault' as string]: resumen.color, ['--acento' as string]: colorTexto(resumen.color) }}>
      <header className="vault-cabecera">
        <SelectorVaults atlas={atlas} actual={resumen.slug} />
        <div className="vault-titulo">
          <div>
            <p className="rotulo">
              Vault {String(indice + 1).padStart(2, '0')} / {String(atlas.vaults.length).padStart(2, '0')} · {resumen === centro ? 'centro: de aquí nacen los demás' : `nace de ${centro?.nombre ?? 'el centro'}`}
            </p>
            <h1 className="display">{resumen.nombre}</h1>
            <p className="vault-proposito">{resumen.proposito}</p>
          </div>
          <dl className="vault-cifras mono">
            <div>
              <dt>notas</dt>
              <dd>{n(resumen.notas)}</dd>
            </div>
            <div>
              <dt>enlaces</dt>
              <dd>{n(resumen.enlaces)}</dd>
            </div>
            <div>
              <dt>palabras</dt>
              <dd>{n(resumen.palabras)}</dd>
            </div>
            <div>
              <dt>actividad</dt>
              <dd>{hace(resumen.ultima)}</dd>
            </div>
          </dl>
        </div>
        {(resumen.incluye.length > 0 || resumen.entradas.length > 0) && (
          <details className="vault-detalles">
            <summary className="rotulo">Qué guarda, qué no y por dónde empezar</summary>
            <div className="vault-detalles-cuerpo">
              {resumen.incluye.length > 0 && (
                <div>
                  <h3 className="rotulo">Incluye</h3>
                  <ul>{resumen.incluye.map((i) => <li key={i}>{i}</li>)}</ul>
                </div>
              )}
              {resumen.noIncluye.length > 0 && (
                <div>
                  <h3 className="rotulo">No incluye</h3>
                  <ul>{resumen.noIncluye.map((i) => <li key={i}>{i}</li>)}</ul>
                </div>
              )}
              {resumen.entradas.length > 0 && (
                <div>
                  <h3 className="rotulo">Entradas</h3>
                  <ul className="entradas">
                    {resumen.entradas.map((id) => (
                      <li key={id}>
                        <a href={rutaVault(resumen.slug, id)}>{porId.get(id)?.t ?? '…'}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {resumen.complementos.length > 0 && (
                <div>
                  <h3 className="rotulo">Complementos de Obsidian</h3>
                  <p className="mono complementos">{resumen.complementos.join(' · ')}</p>
                </div>
              )}
            </div>
          </details>
        )}
      </header>

      <div className="vault-cuerpo">
        <aside className="panel-carpetas" aria-label="Carpetas">
          <ArbolCarpetas raiz={resumen.carpetas} seleccion={carpetaReal} nombreVault={resumen.nombre} onSeleccion={(c) => navegar(rutaVault(resumen.slug, notaId, c))} />
          {resumen.generados > 0 && <p className="arbol-pie mono">+ {n(resumen.generados)} notas generadas por herramientas (no se cargan)</p>}
        </aside>

        <section className="lienzo" aria-label="Notas">
          <div className="lienzo-barra">
            <div className="lienzo-titulo">
              <span className="rotulo">{carpetaReal ?? 'Todo el vault'}</span>
              <span className="mono">
                {filtro ? `${n(filtradas.length)} de ` : ''}
                {n(total)} notas
              </span>
            </div>
            <label className="filtro">
              <Search size={14} />
              <input
                value={filtro}
                onChange={(e) => {
                  setFiltro(e.target.value);
                  setLimite(LIMITE_LISTA);
                }}
                placeholder="Filtrar por título, carpeta o #etiqueta"
              />
            </label>
            <div className="conmutador" role="tablist">
              <button role="tab" aria-selected={vista === 'grafo'} className={vista === 'grafo' ? 'activo' : ''} onClick={() => setVista('grafo')}>
                <Network size={14} /> Grafo
              </button>
              <button role="tab" aria-selected={vista === 'lista'} className={vista === 'lista' ? 'activo' : ''} onClick={() => setVista('lista')}>
                <Clock size={14} /> Recientes
              </button>
            </div>
            {vista === 'grafo' && (
              <>
                <button className={`chip ${conEnlaces ? 'activo' : ''}`} onClick={() => setConEnlaces(!conEnlaces)} title="Mostrar los enlaces entre notas además de la estructura de carpetas">
                  <Share2 size={13} /> Enlaces
                </button>
                <button className="icono-boton" onClick={() => setEncuadrar((x) => x + 1)} title="Encuadrar todo el grafo">
                  <Maximize2 size={15} />
                </button>
              </>
            )}
          </div>

          {datos.cargando && !datos.datos && <div className="pantalla-estado cargando"><p className="rotulo">Abriendo {resumen.nombre}…</p></div>}
          {datos.error && <p className="vacio">{datos.error}</p>}

          {datos.datos && vista === 'grafo' && (
            <div className="lienzo-grafo">
              <Grafo
                clave={`${resumen.slug}|${carpetaReal}|${filtro}|${conEnlaces}|${tema}`}
                nodos={grafo.nodos}
                enlaces={grafo.enlaces}
                foco={notaId}
                colorTexto={colores.texto}
                colorLinea={colores.linea}
                colorEnlace={colores.enlace}
                colorFondo={colores.fondo}
                distancia={(e) => (e.tipo === 'enlace' ? 46 : e.tipo === 'arbol' ? 26 : 30)}
                fuerza={(e) => (e.tipo === 'enlace' ? 0.04 : 0.55)}
                carga={(nodo) => (nodo.tipo === 'nota' ? -14 : nodo.tipo === 'raiz' ? -260 : -90)}
                onHover={setHover}
                encuadrar={encuadrar}
                onClic={(nodo) => {
                  if (nodo.tipo === 'nota') navegar(rutaVault(resumen.slug, nodo.id, carpetaReal));
                  else navegar(rutaVault(resumen.slug, notaId, nodo.id.slice(8) || null));
                }}
              />
              <div className="leyenda">
                {resumen.carpetas.h.slice(0, 12).map((c) => (
                  <button key={c.p} onClick={() => navegar(rutaVault(resumen.slug, notaId, c.p))}>
                    <span style={{ background: colorDe(c.p) }} />
                    {c.n}
                  </button>
                ))}
              </div>
              {hover && hover.tipo === 'nota' && porId.get(hover.id) && (
                <div className="grafo-hover">
                  <strong>{porId.get(hover.id)!.t}</strong>
                  <span className="mono">{porId.get(hover.id)!.f || 'raíz'}</span>
                  <p>{porId.get(hover.id)!.ex}</p>
                </div>
              )}
              <p className="grafo-ayuda mono">rueda: zoom · arrastra: mover · clic: abrir</p>
            </div>
          )}

          {datos.datos && vista === 'lista' && (
            <ol className="lista-notas">
              {filtradas.slice(0, limite).map((x) => (
                <li key={x.id}>
                  <a href={rutaVault(resumen.slug, x.id, carpetaReal)} className={x.id === notaId ? 'activa' : ''}>
                    <span className="lista-punto" style={{ background: colorDe(x.f) }} />
                    <span className="lista-texto">
                      <span className="lista-titulo">{x.t}</span>
                      <span className="lista-ruta mono">{x.f || 'raíz'}</span>
                      {x.ex && <span className="lista-extracto">{x.ex}</span>}
                    </span>
                    <span className="lista-fecha mono">{hace(x.m)}</span>
                  </a>
                </li>
              ))}
              {filtradas.length > limite && (
                <li>
                  <button className="boton-secundario" onClick={() => setLimite((l) => l + LIMITE_LISTA)}>
                    Mostrar {Math.min(LIMITE_LISTA, filtradas.length - limite)} más
                  </button>
                </li>
              )}
              {filtradas.length === 0 && <li className="vacio">Ninguna nota coincide.</li>}
            </ol>
          )}
        </section>

        {nota && datos.datos && (
          <LectorNota
            atlas={atlas}
            nota={nota}
            datos={datos.datos}
            porId={porId}
            entrantes={entrantes.get(nota.id) ?? []}
            carpeta={carpetaReal}
            cerrar={() => navegar(rutaVault(resumen.slug, null, carpetaReal))}
          />
        )}
      </div>
    </div>
  );
}
