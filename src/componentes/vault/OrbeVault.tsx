// El vault como un pequeño planeta: esfera con el color del vault, brillo, anillo
// y una luna por cada carpeta principal (su tamaño, según cuántas notas tiene).
// Se usa grande en la portada y chico en el carril de vaults.
import { useId } from 'react';
import { mezclar } from '../../lib/tema';
import type { Carpeta } from '../../lib/tipos';

interface Props {
  color: string;
  tamano: number;
  carpetas?: Carpeta[];
  /** sin lunas ni anillo: para tamaños chicos */
  simple?: boolean;
  activo?: boolean;
}

export default function OrbeVault({ color, tamano, carpetas = [], simple = false, activo = false }: Props) {
  const id = useId().replace(/:/g, '');
  const lunas = simple ? [] : carpetas.slice(0, 8);
  const maxT = Math.max(...lunas.map((l) => l.t), 1);
  const claro = mezclar(color, '#ffffff', 0.42);
  const oscuro = mezclar(color, '#000000', 0.4);
  return (
    <svg className={`orbe-vault ${activo ? 'activo' : ''} ${simple ? 'simple' : ''}`} width={tamano} height={tamano} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`esfera-${id}`} cx="36%" cy="32%" r="72%">
          <stop offset="0%" stopColor={claro} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={oscuro} />
        </radialGradient>
        <radialGradient id={`halo-${id}`} r="50%">
          <stop offset="55%" stopColor={color} stopOpacity="0.38" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`anillo-${id}`} x1="0" x2="1">
          <stop offset="0%" stopColor={claro} stopOpacity="0.05" />
          <stop offset="50%" stopColor={claro} stopOpacity="0.7" />
          <stop offset="100%" stopColor={claro} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="49" fill={`url(#halo-${id})`} className="orbe-halo" />
      {!simple && (
        <g className="orbe-lunas">
          <ellipse cx="50" cy="50" rx="44" ry="44" fill="none" stroke={claro} strokeOpacity="0.16" strokeDasharray="1 4" />
          {lunas.map((l, i) => {
            const a = (i / lunas.length) * Math.PI * 2 - Math.PI / 2;
            const r = 1.6 + 3.4 * Math.sqrt(l.t / maxT);
            return <circle key={l.p} cx={50 + Math.cos(a) * 44} cy={50 + Math.sin(a) * 44} r={r} fill={claro} />;
          })}
        </g>
      )}
      <circle cx="50" cy="50" r={simple ? 30 : 26} fill={`url(#esfera-${id})`} />
      {!simple && <ellipse cx="50" cy="50" rx="38" ry="9" fill="none" stroke={`url(#anillo-${id})`} strokeWidth="1.6" transform="rotate(-18 50 50)" className="orbe-anillo" />}
      <ellipse cx="41" cy="38" rx={simple ? 8 : 7} ry={simple ? 5 : 4.4} fill="#fff" opacity="0.32" transform="rotate(-28 41 38)" />
    </svg>
  );
}
