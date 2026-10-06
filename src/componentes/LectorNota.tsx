// Lector de una nota: contenido, metadatos y todas sus relaciones (salientes,
// entrantes y puentes a otros vaults).
import { ArrowDownLeft, ArrowUpRight, Check, Copy, ExternalLink, GitFork, ListTree, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { rutaEnDisco, vaultCentral } from '../lib/atlas';
import { cargarBloque, useDatos } from '../lib/datos';
import { formatoFecha, hace, minutosLectura, n } from '../lib/formato';
import { slugTitulo } from '../lib/markdown';
import { navegar, rutaVault } from '../lib/rutas';
import { tono, useTema } from '../lib/tema';
import type { Atlas, DatosVault, Nota } from '../lib/tipos';
import Markdown from './Markdown';
import Vecindario from './vault/Vecindario';

interface Props {
  atlas: Atlas;
  nota: Nota;
  datos: DatosVault;
  porId: Map<string, Nota>;
  entrantes: string[];
  carpeta: string | null;
  cerrar: () => void;
}

export default function LectorNota({ atlas, nota, datos, porId, entrantes, carpeta, cerrar }: Props) {
  const tema = useTema();
  const contenido = useDatos(`bloque:${nota.c}`, () => cargarBloque(nota.c));
  const [copiado, setCopiado] = useState(false);
  const [indice, setIndice] = useState(false);
  const cuerpo = useRef<HTMLDivElement>(null);
  const [progreso, setProgreso] = useState(0);
  const vault = atlas.vaults.find((v) => v.nombre === nota.v)!;
  const centro = vaultCentral(atlas);
  const vaultDe = (nombre: string) => atlas.vaults.find((v) => v.nombre === nombre);

  useEffect(() => {
    cuerpo.current?.scrollTo({ top: 0 });
    setProgreso(0);
  }, [nota.id]);

  // Cuánto se ha leído (barra fina arriba del lector).
  const alDesplazar = () => {
    const el = cuerpo.current;
    if (!el) return;
    const total = el.scrollHeight - el.clientHeight;
    setProgreso(total > 0 ? el.scrollTop / total : 0);
  };

  const irA = (id: string) => {
    const local = porId.get(id);
    if (local) return navegar(rutaVault(vault.slug, id, carpeta));
    const externo = datos.externos[id];
    if (externo) {
      const v = vaultDe(externo.v);
      if (v) navegar(rutaVault(v.slug, id));
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(rutaEnDisco(vault, nota.r));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1400);
    } catch {
      /* portapapeles bloqueado */
    }
  };

  const enlaceObsidian = `obsidian://open?vault=${encodeURIComponent(nota.v)}&file=${encodeURIComponent(nota.r.replace(/\.md$/, ''))}`;
  const migas = nota.f ? nota.f.split('/') : [];
  const fm = Object.entries(nota.fm).filter(([k]) => !['tags', 'cssclasses'].includes(k));
  // Muchas notas repiten su título como «# Título» en la primera línea: ya se muestra arriba.
  const crudo = contenido.datos?.[nota.id];
  const texto = crudo?.replace(/^\s*#\s+(.+)\n/, (linea, titulo: string) => (titulo.trim().toLowerCase() === nota.t.trim().toLowerCase() ? '' : linea));

  const Relacion = ({ ids, externos }: { ids: string[]; externos?: boolean }) => (
    <ul className="relaciones-lista">
      {ids.slice(0, 60).map((id) => {
        const local = porId.get(id);
        const ext = datos.externos[id];
        const titulo = local?.t ?? ext?.t ?? id;
        const v = local ? vault : ext ? vaultDe(ext.v) : null;
        return (
          <li key={id}>
            <button onClick={() => irA(id)} style={{ ['--vault' as string]: v?.color ?? 'var(--tinta-3)' }}>
              <span className="relacion-punto" />
              <span className="relacion-titulo">{titulo}</span>
              {externos && v && (
                <span className="relacion-vault mono" style={{ color: tono(v.color, tema) }}>
                  {v.nombre}
                </span>
              )}
            </button>
          </li>
        );
      })}
      {ids.length > 60 && <li className="mono relaciones-mas">y {ids.length - 60} más</li>}
    </ul>
  );

  return (
    <article className="lector" aria-label={nota.t}>
      <div className="lector-progreso" style={{ transform: `scaleX(${progreso})` }} aria-hidden="true" />
      <div className="lector-barra">
        <nav className="migas mono" aria-label="Ubicación">
          {centro && centro.slug !== vault.slug && (
            <>
              <a href={rutaVault(centro.slug)}>{centro.nombre}</a>
              <span>›</span>
            </>
          )}
          <a href={rutaVault(vault.slug)} style={{ color: tono(vault.color, tema) }}>
            {vault.nombre}
          </a>
          {migas.map((m, i) => (
            <span key={i} className="miga">
              <span>›</span>
              <a href={rutaVault(vault.slug, null, migas.slice(0, i + 1).join('/'))}>{m}</a>
            </span>
          ))}
        </nav>
        <div className="lector-acciones">
          {nota.h.length > 2 && (
            <button className={`icono-boton ${indice ? 'activo' : ''}`} onClick={() => setIndice((x) => !x)} title="Índice de la nota">
              <ListTree size={15} />
            </button>
          )}
          <button className="icono-boton" onClick={copiar} title="Copiar ruta del archivo">
            {copiado ? <Check size={15} /> : <Copy size={15} />}
          </button>
          <a className="icono-boton" href={enlaceObsidian} title="Abrir en Obsidian">
            <ExternalLink size={15} />
          </a>
          <button className="icono-boton" onClick={cerrar} aria-label="Cerrar nota">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="lector-cuerpo" ref={cuerpo} onScroll={alDesplazar}>
        <header className="lector-cabecera">
          <div className="lector-banda" aria-hidden="true" />
          <h1 className="display">{nota.t}</h1>
          <p className="lector-meta mono">
            <span>{formatoFecha(nota.m)}</span>
            <span>·</span>
            <span>{hace(nota.m)}</span>
            <span>·</span>
            <span>{n(nota.w)} palabras</span>
            <span>·</span>
            <span>{minutosLectura(nota.w)} min</span>
          </p>
          {nota.tg.length > 0 && (
            <div className="etiquetas">
              {nota.tg.map((t) => (
                <span key={t} className="etiqueta">
                  #{t}
                </span>
              ))}
            </div>
          )}
          {fm.length > 0 && (
            <details className="propiedades">
              <summary className="rotulo">Propiedades · {fm.length}</summary>
              <dl>
                {fm.map(([k, v]) => (
                  <div key={k}>
                    <dt className="mono">{k}</dt>
                    <dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {indice && (
            <ol className="indice-nota">
              {nota.h.map((h, i) => (
                <li key={i} style={{ paddingLeft: (h.n - 1) * 12 }}>
                  <button
                    onClick={() => {
                      const destino = cuerpo.current?.querySelector(`[id="${slugTitulo(h.t)}"]`);
                      destino?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    {h.t}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </header>

        {contenido.cargando && <div className="esqueleto" aria-label="Cargando nota" />}
        {contenido.error && <p className="vacio">{contenido.error}</p>}
        {texto !== undefined && (texto.trim() ? <Markdown texto={texto} onNota={irA} /> : <p className="vacio">Esta nota está vacía.</p>)}

        <footer className="relaciones">
          <Vecindario atlas={atlas} nota={nota} datos={datos} porId={porId} entrantes={entrantes} color={vault.color} onNota={irA} />
          <section>
            <h2 className="rotulo">
              <ArrowUpRight size={13} /> Enlaza a · {nota.o.length}
            </h2>
            {nota.o.length ? <Relacion ids={nota.o} /> : <p className="vacio">No enlaza a otras notas.</p>}
          </section>
          <section>
            <h2 className="rotulo">
              <ArrowDownLeft size={13} /> La citan · {entrantes.length}
            </h2>
            {entrantes.length ? <Relacion ids={entrantes} /> : <p className="vacio">Ninguna nota de este vault la cita.</p>}
          </section>
          {(nota.x.length > 0 || nota.xb.length > 0) && (
            <section className="relaciones-puentes">
              <h2 className="rotulo">
                <GitFork size={13} /> Puentes con otros vaults · {nota.x.length + nota.xb.length}
              </h2>
              <Relacion ids={[...new Set([...nota.x, ...nota.xb])]} externos />
            </section>
          )}
        </footer>
      </div>
    </article>
  );
}
