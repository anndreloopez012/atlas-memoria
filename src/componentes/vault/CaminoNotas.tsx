// «¿Cómo se conecta con otra nota?»: eliges una nota de cualquier vault y aparece
// el camino más corto de enlaces entre las dos, paso a paso. Vive bajo el vecindario
// de la nota: cerrado es solo un enlace discreto.
import { ArrowRight, Route, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useVersionDatos } from '../../lib/datos';
import { buscarNotas, camino, cargarGrafoNotas, type GrafoNotas, type NotaMin } from '../../lib/grafoNotas';
import { navegar, rutaVault } from '../../lib/rutas';
import type { Atlas, Nota } from '../../lib/tipos';

export default function CaminoNotas({ atlas, nota }: { atlas: Atlas; nota: Nota }) {
  const version = useVersionDatos();
  const [abierto, setAbierto] = useState(false);
  const [grafo, setGrafo] = useState<GrafoNotas | null>(null);
  const [q, setQ] = useState('');
  const [destino, setDestino] = useState<NotaMin | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (abierto) cargarGrafoNotas(atlas, version).then(setGrafo);
  }, [abierto, atlas, version]);

  // Al cambiar de nota se empieza de nuevo.
  useEffect(() => {
    setDestino(null);
    setQ('');
  }, [nota.id]);

  if (!abierto)
    return (
      <button
        className="camino-abrir"
        onClick={() => {
          setAbierto(true);
          requestAnimationFrame(() => entrada.current?.focus());
        }}
      >
        <Route size={14} /> ¿Cómo se conecta con otra nota?
      </button>
    );

  const sugerencias = grafo && !destino ? buscarNotas(grafo, q, 6, nota.id) : [];
  const ruta = grafo && destino ? camino(grafo, nota.id, destino.id) : null;
  const pasos = ruta?.map((id) => grafo!.notas.get(id)!).filter(Boolean) ?? [];

  return (
    <section className="camino" aria-label="Camino entre notas">
      <header>
        <Route size={14} />
        <span>Camino hasta otra nota</span>
        <button
          className="icono-boton"
          onClick={() => {
            setAbierto(false);
            setDestino(null);
            setQ('');
          }}
          aria-label="Cerrar el camino"
        >
          <X size={14} />
        </button>
      </header>

      {!destino && (
        <>
          <input ref={entrada} className="camino-entrada" value={q} onChange={(e) => setQ(e.target.value)} placeholder={grafo ? 'Escribe el título de la otra nota…' : 'Cargando las notas de todos los vaults…'} disabled={!grafo} aria-label="Título de la otra nota" />
          {sugerencias.length > 0 && (
            <ul className="camino-sugerencias">
              {sugerencias.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setDestino(s)}>
                    <span className="chip-punto" style={{ background: s.color }} />
                    <span className="camino-titulo">{s.t}</span>
                    <span className="mono">
                      {s.v}
                      {s.f ? ` / ${s.f}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {destino && (
        <div className="camino-resultado">
          {ruta ? (
            <>
              <p className="mono camino-resumen">
                {pasos.length - 1 === 1 ? 'Enlace directo' : `${pasos.length - 1} pasos`} hasta «{destino.t}»
              </p>
              <ol className="camino-pasos">
                {pasos.map((p, i) => (
                  <li key={p.id}>
                    {i > 0 && <ArrowRight size={13} className="camino-flecha" />}
                    <button className={`camino-paso ${i === 0 ? 'origen' : ''}`} style={{ ['--c' as string]: p.color }} onClick={() => i > 0 && navegar(rutaVault(p.s, p.id))} disabled={i === 0} title={`${p.v}${p.f ? ` / ${p.f}` : ''}`}>
                      <span className="chip-punto" />
                      {p.t}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="camino-resumen">No hay un camino de enlaces entre estas notas (hasta 10 pasos). Enlazarlas las conectaría.</p>
          )}
          <button className="boton-texto" onClick={() => setDestino(null)}>
            Elegir otra nota
          </button>
        </div>
      )}
    </section>
  );
}
