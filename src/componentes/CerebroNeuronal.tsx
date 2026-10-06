// Un vault dibujado como cerebro: silueta y surcos, sinapsis, dendritas, neuronas
// que se encienden desde el centro, chispas al azar e impulsos que recorren las
// conexiones. Las neuronas grandes son las carpetas principales (lóbulos).
//
// Se dibuja dentro de un <svg> ajeno: `x`, `y` y `ancho` están en las unidades de
// ese svg, y los grosores se convierten para que no dependan de la escala.
import { useMemo, type MouseEvent } from 'react';
import { CONTORNO, generarCerebro, SURCOS_D } from '../lib/neuronas';

export interface Lobulo {
  nombre: string;
  ruta: string;
  notas: number;
}

interface Props {
  semilla: string;
  /** color del vault, ya ajustado al tema */
  color: string;
  cantidad: number;
  x: number;
  y: number;
  /** media anchura del cerebro, en unidades del svg */
  ancho: number;
  /** mirar hacia la derecha (la frente apunta al centro del mapa) */
  espejo?: boolean;
  lobulos?: Lobulo[];
  /** solo silueta y surcos: para íconos chicos */
  icono?: boolean;
  /** segundos antes de empezar a encenderse */
  retraso?: number;
  /** multiplica todos los grosores */
  grosor?: number;
  onLobulo?: (l: Lobulo | null, e: MouseEvent) => void;
  onLobuloClic?: (l: Lobulo) => void;
}

export default function CerebroNeuronal({ semilla, color, cantidad, x, y, ancho, espejo = false, lobulos = [], icono = false, retraso = 0, grosor = 1, onLobulo, onLobuloClic }: Props) {
  const cerebro = useMemo(() => (icono ? null : generarCerebro(semilla, cantidad, lobulos.length)), [semilla, cantidad, lobulos.length, icono]);
  // Grosor en unidades del svg → unidades normalizadas del cerebro.
  const u = (v: number) => (v * grosor) / ancho;
  const maxNotas = Math.max(...lobulos.map((l) => l.notas), 1);
  const s = (v: number) => `${(retraso + v).toFixed(2)}s`;

  return (
    <g
      className={`cerebro ${icono ? 'icono' : ''}`}
      transform={`translate(${x} ${y}) scale(${espejo ? -ancho : ancho} ${ancho})`}
      style={{ ['--c' as string]: color, ['--entrada' as string]: `${retraso}s` }}
    >
      <path d={CONTORNO} className="cerebro-tejido" />
      {!icono && <path d={CONTORNO} className="cerebro-brillo" strokeWidth={u(5)} />}
      <path d={SURCOS_D} className="cerebro-surcos" strokeWidth={u(icono ? 1.4 : 0.9)} />
      {cerebro && (
        <>
          <path d={cerebro.fibras} className="cerebro-fibras" strokeWidth={u(0.8)} />
          <path d={cerebro.sinapsis} className="cerebro-sinapsis" strokeWidth={u(0.55)} />
          <path d={cerebro.dendritas} className="cerebro-dendritas" strokeWidth={u(0.5)} />
          <g className="cerebro-neuronas">
            {cerebro.neuronas.map((nn, i) =>
              nn.lobulo < 0 ? <circle key={i} cx={nn.x} cy={nn.y} r={u(0.85 + nn.peso * 2.1)} style={{ animationDelay: s(0.15 + nn.centro * 0.9) }} /> : null,
            )}
          </g>
          <g className="cerebro-chispas">
            {cerebro.neuronas.map((nn, i) =>
              nn.chispa ? (
                <circle key={i} cx={nn.x} cy={nn.y} r={u(4.5 + nn.peso * 3)} style={{ animationDelay: s(1.6 + nn.chispa[0]), animationDuration: `${nn.chispa[1]}s` }} />
              ) : null,
            )}
          </g>
          <g className="cerebro-impulsos">
            {cerebro.impulsos.map((im, i) => (
              <path key={i} d={im.d} pathLength={100} strokeWidth={u(1.7)} style={{ animationDelay: s(1.4 + im.retraso), animationDuration: `${im.duracion}s` }} />
            ))}
          </g>
          {cerebro.neuronas.map((nn, i) => {
            const l = nn.lobulo >= 0 ? lobulos[nn.lobulo] : null;
            if (!l) return null;
            // Del tamaño de una neurona grande (no del cerebro), según sus notas.
            const r = u(2 + 1.8 * Math.sqrt(l.notas / maxNotas));
            return (
              <g
                key={`l${i}`}
                className="cerebro-lobulo"
                style={{ animationDelay: s(0.5 + nn.centro * 0.7) }}
                onMouseMove={onLobulo ? (e) => onLobulo(l, e) : undefined}
                onMouseLeave={onLobulo ? (e) => onLobulo(null, e) : undefined}
                onClick={
                  onLobuloClic
                    ? (e) => {
                        e.stopPropagation();
                        onLobuloClic(l);
                      }
                    : undefined
                }
              >
                <circle cx={nn.x} cy={nn.y} r={r * 2.3} className="cerebro-lobulo-halo" />
                <circle cx={nn.x} cy={nn.y} r={r * 1.6} className="cerebro-lobulo-anillo" strokeWidth={u(0.7)} />
                <circle cx={nn.x} cy={nn.y} r={r} className="cerebro-lobulo-soma" />
                <circle cx={nn.x} cy={nn.y} r={r * 1.8} className="cerebro-lobulo-zona" />
              </g>
            );
          })}
        </>
      )}
      <path d={CONTORNO} className="cerebro-contorno" strokeWidth={u(icono ? 1.6 : 1.1)} pathLength={1} />
    </g>
  );
}
