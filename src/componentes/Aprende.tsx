import { ArrowRight, Check, Circle, Copy, GraduationCap, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { marcarPaso, ocultarRuta, pasosAprende, useMarcasAprende, type Paso } from '../lib/aprende';
import { useVersionDatos } from '../lib/datos';
import { abrirCentro } from '../lib/recientes';
import { navegar } from '../lib/rutas';
import type { Atlas } from '../lib/tipos';
import Markdown from './Markdown';

/** Los pasos de la ruta, al día con los datos y con lo marcado en la página. */
export function usePasosAprende(atlas: Atlas) {
  const version = useVersionDatos();
  const marcas = useMarcasAprende();
  const [pasos, setPasos] = useState<Paso[] | null>(null);
  useEffect(() => {
    let vigente = true;
    pasosAprende(atlas).then((p) => vigente && setPasos(p));
    return () => {
      vigente = false;
    };
  }, [atlas, version, marcas]);
  return pasos;
}

function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="boton-secundario"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1600);
        } catch {
          /* sin portapapeles */
        }
      }}
    >
      {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? 'Copiado' : etiqueta}
    </button>
  );
}

/** La ruta completa, dentro del centro de mando. */
export function VistaAprende({ atlas, cerrar, setConsulta }: { atlas: Atlas; cerrar: () => void; setConsulta: (t: string) => void }) {
  const pasos = usePasosAprende(atlas);
  const [abierto, setAbierto] = useState<string | null>(null);
  const actual = abierto ?? pasos?.find((p) => !p.hecho)?.id ?? null;
  if (!pasos) return <p className="vacio">Revisando tu avance…</p>;
  const hechos = pasos.filter((p) => p.hecho).length;

  const ir = (p: Paso) => {
    if (!p.ir) return;
    if (p.ir.hash) {
      navegar(p.ir.hash);
      cerrar();
    } else if (p.ir.centro !== undefined) setConsulta(p.ir.centro);
  };

  return (
    <div className="aprende">
      <p className="rotulo">Aprende · tu ruta para empezar</p>
      <div className="aprende-avance" role="progressbar" aria-valuemin={0} aria-valuemax={pasos.length} aria-valuenow={hechos} aria-label="Pasos hechos">
        <span style={{ width: `${(hechos / pasos.length) * 100}%` }} />
      </div>
      <p className="mono aprende-cuenta">
        {hechos === pasos.length ? '¡Ruta completa! Ya sabes usar tu memoria de punta a punta.' : `${hechos} de ${pasos.length} pasos`}
      </p>
      <ol className="aprende-pasos">
        {pasos.map((p, i) => {
          const abiertoAqui = actual === p.id;
          return (
            <li key={p.id} className={`${p.hecho ? 'hecho' : ''} ${abiertoAqui ? 'abierto' : ''}`}>
              <button type="button" className="aprende-paso" aria-expanded={abiertoAqui} onClick={() => setAbierto(abiertoAqui ? '' : p.id)}>
                <span className="aprende-marca" aria-hidden="true">
                  {p.hecho ? <Check size={13} /> : <Circle size={13} />}
                </span>
                <span className="aprende-titulo">
                  <span className="mono">{i + 1}.</span> {p.titulo}
                </span>
                <span className="sr">{p.hecho ? 'hecho' : 'pendiente'}</span>
              </button>
              {abiertoAqui && (
                <div className="aprende-detalle">
                  <p className="aprende-porque">{p.porque}</p>
                  <Markdown texto={p.como} className="aprende-como" />
                  {p.plantilla && (
                    <details className="aprende-plantilla">
                      <summary>
                        Ver la plantilla · <span className="mono">{p.plantilla.donde}</span>
                      </summary>
                      <pre>{p.plantilla.texto}</pre>
                    </details>
                  )}
                  <div className="aprende-acciones">
                    {p.ir && (
                      <button type="button" className="boton-secundario" onClick={() => ir(p)}>
                        <ArrowRight size={14} /> {p.ir.texto}
                      </button>
                    )}
                    {p.plantilla && <Copiar texto={p.plantilla.texto} etiqueta="Copiar plantilla" />}
                    {p.pedido && <Copiar texto={p.pedido} etiqueta="Copiar pedido para tu IA" />}
                    {!p.visto && (
                      <button type="button" className="boton-texto" onClick={() => marcarPaso(p.id, !p.hecho)}>
                        {p.hecho ? 'Desmarcar' : 'Ya lo hice'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Tarjeta en Hoy mientras falten varios pasos: el siguiente y el avance. */
export function TarjetaAprende({ atlas }: { atlas: Atlas }) {
  const pasos = usePasosAprende(atlas);
  const marcas = useMarcasAprende();
  if (!pasos || marcas.oculto) return null;
  const pendientes = pasos.filter((p) => !p.hecho);
  if (pendientes.length < 3) return null;
  const hechos = pasos.length - pendientes.length;
  return (
    <article className="hoy-tarjeta tarjeta-aprende">
      <header>
        <GraduationCap size={16} />
        <h2>Tu ruta</h2>
        <span className="mono">
          {hechos} de {pasos.length}
        </span>
        <button type="button" className="icono-boton tarjeta-aprende-cerrar" onClick={() => ocultarRuta()} aria-label="Ocultar la ruta (sigue en el centro de mando)" title="Ocultar (sigue en el centro de mando, «Aprende»)">
          <X size={14} />
        </button>
      </header>
      <div className="aprende-avance" aria-hidden="true">
        <span style={{ width: `${(hechos / pasos.length) * 100}%` }} />
      </div>
      <p className="tarjeta-aprende-siguiente">
        Sigue: <strong>{pendientes[0].titulo}</strong>
        <span>{pendientes[0].porque}</span>
      </p>
      <button type="button" className="boton-texto" onClick={() => abrirCentro(ABRIR_APRENDE)}>
        Continuar la ruta →
      </button>
    </article>
  );
}

/** Texto especial: abre el centro de mando directo en la ruta. */
export const ABRIR_APRENDE = '\u0000aprende';
