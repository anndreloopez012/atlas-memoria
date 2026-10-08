import { ArrowUpCircle, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { actualizarAtlas, useActualizacion } from '../lib/datos';
import { abrirCentro } from '../lib/recientes';
import Markdown from './Markdown';

/** Texto especial: abre el centro de mando directo en la actualización. */
export const ABRIR_ACTUALIZAR = '\u0000actualizar';

/** Aviso discreto en la barra cuando hay una versión nueva (o mientras se instala). */
export function AvisoVersion() {
  const { nueva, progreso } = useActualizacion();
  if (!nueva && !progreso) return null;
  return (
    <button type="button" className="aviso-version" onClick={() => abrirCentro(ABRIR_ACTUALIZAR)} title={progreso ?? `Ver qué trae la versión ${nueva?.version}`}>
      <ArrowUpCircle size={14} />
      <span>{progreso ? 'Actualizando…' : `Versión ${nueva!.version}`}</span>
    </button>
  );
}

/** Qué trae la versión nueva y el botón para instalarla, dentro del centro de mando. */
export function VistaActualizacion() {
  const { nueva, progreso } = useActualizacion();
  const [error, setError] = useState<string | null>(null);
  if (!nueva && !progreso) return <p className="vacio">Tienes la última versión del atlas.</p>;
  return (
    <div className="actualizacion" aria-live="polite">
      <p className="rotulo">Versión nueva{nueva ? ` · ${nueva.version}` : ''}</p>
      {progreso ? (
        <p className="respuesta-pensando">
          <span className="respuesta-girando" aria-hidden="true" /> {progreso}
          <span className="mono"> La página se recarga sola cuando termine; tus notas y tu configuración no se tocan.</span>
        </p>
      ) : (
        nueva && (
          <>
            {nueva.notas.trim() && <Markdown texto={nueva.notas} className="actualizacion-notas" />}
            <div className="aprende-acciones">
              {nueva.automatica ? (
                <button
                  type="button"
                  className="boton-primario"
                  onClick={async () => {
                    setError(null);
                    const r = await actualizarAtlas();
                    if (!r.ok) setError(r.error ?? 'No se pudo actualizar');
                  }}
                >
                  <ArrowUpCircle size={16} /> Actualizar ahora
                </button>
              ) : (
                <p className="actualizacion-como">
                  {nueva.git ? (
                    <>
                      Esta copia es un repositorio git: actualízala con <code>git pull</code> y <code>npm install</code>.
                    </>
                  ) : (
                    <>
                      Ábrelo con doble clic para actualizar en un clic, o en la terminal: <code>npm run actualizar</code>.
                    </>
                  )}
                </p>
              )}
              <a className="boton-secundario" href={nueva.url} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Ver en GitHub
              </a>
            </div>
          </>
        )
      )}
      {error && <p className="respuesta-aviso">{error}</p>}
    </div>
  );
}
