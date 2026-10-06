// El vault como un cerebro pequeño. En la portada lleva sus neuronas, lóbulos e
// impulsos dentro de una retícula holográfica; en el carril de vaults (tamaños
// chicos) queda solo la silueta con sus surcos.
import { useId } from 'react';
import { neuronasPara } from '../../lib/neuronas';
import { tono, useTema } from '../../lib/tema';
import type { Carpeta } from '../../lib/tipos';
import CerebroNeuronal from '../CerebroNeuronal';

interface Props {
  color: string;
  tamano: number;
  /** identifica al vault: el mismo vault dibuja siempre el mismo cerebro */
  semilla: string;
  notas?: number;
  carpetas?: Carpeta[];
  /** solo la silueta: para tamaños chicos */
  simple?: boolean;
  activo?: boolean;
}

export default function OrbeVault({ color, tamano, semilla, notas = 0, carpetas = [], simple = false, activo = false }: Props) {
  const id = useId().replace(/:/g, '');
  const tema = useTema();
  const c = tono(color, tema);
  const lobulos = simple
    ? []
    : carpetas
        .filter((h) => h.t > 0)
        .slice(0, 8)
        .map((h) => ({ nombre: h.n, ruta: h.p, notas: h.t }));
  return (
    <svg className={`orbe-vault ${activo ? 'activo' : ''} ${simple ? 'simple' : ''}`} width={tamano} height={tamano} viewBox="0 0 100 100" aria-hidden="true" style={{ ['--c' as string]: c }}>
      <defs>
        <radialGradient id={`halo-${id}`} r="50%">
          <stop offset="20%" stopColor={c} stopOpacity={tema === 'oscuro' ? 0.34 : 0.18} />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#halo-${id})`} className="orbe-halo" />
      {!simple && (
        <g className="orbe-reticula">
          <circle cx="50" cy="50" r="47" className="orbe-reticula-circulo" />
          <path d="M6 16 V6 H16 M84 6 H94 V16 M94 84 V94 H84 M16 94 H6 V84" className="orbe-reticula-esquinas" />
        </g>
      )}
      <CerebroNeuronal
        semilla={semilla}
        color={c}
        cantidad={Math.min(150, neuronasPara(notas))}
        x={50}
        y={48}
        ancho={simple ? 47 : 39}
        lobulos={lobulos}
        icono={simple}
        grosor={simple ? 2.4 : 0.6}
        retraso={0.1}
      />
    </svg>
  );
}
