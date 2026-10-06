// Vecindario de una nota: un mapa chico con la nota al centro, las que la citan a
// la izquierda, a las que enlaza a la derecha y sus puentes con otros vaults abajo.
// Cada punto se puede tocar para saltar a esa nota.
import { tono, useTema } from '../../lib/tema';
import type { Atlas, DatosVault, Nota } from '../../lib/tipos';

interface Props {
  atlas: Atlas;
  nota: Nota;
  datos: DatosVault;
  porId: Map<string, Nota>;
  entrantes: string[];
  color: string;
  onNota: (id: string) => void;
}

const ANCHO = 380;
const ALTO = 230;
const CX = ANCHO / 2;
const CY = 92;
const MAX_POR_LADO = 9;

interface Punto {
  id: string;
  titulo: string;
  color: string;
  x: number;
  y: number;
  lado: 'izq' | 'der' | 'abajo';
}

export default function Vecindario({ atlas, nota, datos, porId, entrantes, color, onNota }: Props) {
  const tema = useTema();
  const salientes = nota.o.filter((id) => !entrantes.includes(id));
  const mutuos = nota.o.filter((id) => entrantes.includes(id));
  const izquierda = [...mutuos, ...entrantes.filter((id) => !mutuos.includes(id))];
  const puentes = [...new Set([...nota.x, ...nota.xb])];
  if (!izquierda.length && !salientes.length && !puentes.length) return null;

  const titulo = (id: string) => porId.get(id)?.t ?? datos.externos[id]?.t ?? id;
  const colorDe = (id: string) => {
    const ext = datos.externos[id];
    const v = ext ? atlas.vaults.find((x) => x.nombre === ext.v) : null;
    return tono(v?.color ?? color, tema);
  };

  const repartir = (ids: string[], desde: number, hasta: number, radio: number, lado: Punto['lado']): Punto[] => {
    const lista = ids.slice(0, MAX_POR_LADO);
    return lista.map((id, i) => {
      const a = ((lista.length === 1 ? (desde + hasta) / 2 : desde + ((hasta - desde) * i) / (lista.length - 1)) * Math.PI) / 180;
      return { id, titulo: titulo(id), color: colorDe(id), x: CX + Math.cos(a) * radio, y: CY + Math.sin(a) * radio * 0.78, lado };
    });
  };

  const puntos = [
    ...repartir(izquierda, 205, 155, 100, 'izq'),
    ...repartir(salientes, -25, 25, 100, 'der'),
    ...repartir(puentes, 62, 118, 118, 'abajo'),
  ];
  const corto = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);
  const conEtiqueta = (lado: Punto['lado']) => puntos.filter((p) => p.lado === lado).length <= 5;

  return (
    <figure className="vecindario" style={{ ['--c' as string]: tono(color, tema) }}>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={`Vecindario de ${nota.t}`}>
        {puntos.map((p) => (
          <path
            key={`l-${p.lado}-${p.id}`}
            d={`M${CX},${CY} Q${(CX + p.x) / 2},${p.lado === 'abajo' ? CY + 30 : (CY + p.y) / 2 - 18} ${p.x},${p.y}`}
            className={`vecindario-linea ${p.lado}`}
            style={{ stroke: p.color }}
          />
        ))}
        {puntos.map((p) => (
          <g key={`p-${p.lado}-${p.id}`} className="vecindario-punto" onClick={() => onNota(p.id)} role="link" aria-label={p.titulo} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onNota(p.id)}>
            <circle cx={p.x} cy={p.y} r={5.5} style={{ fill: p.color }} />
            <circle cx={p.x} cy={p.y} r={12} className="vecindario-zona" />
            {conEtiqueta(p.lado) && (
              <text x={p.x + (p.lado === 'izq' ? -9 : p.lado === 'der' ? 9 : 0)} y={p.lado === 'abajo' ? p.y + 17 : p.y + 3.5} textAnchor={p.lado === 'izq' ? 'end' : p.lado === 'der' ? 'start' : 'middle'}>
                {corto(p.titulo, p.lado === 'abajo' ? 16 : 15)}
              </text>
            )}
            <title>{p.titulo}</title>
          </g>
        ))}
        <circle cx={CX} cy={CY} r={13} className="vecindario-centro" />
        <circle cx={CX} cy={CY} r={20} className="vecindario-aura" />
      </svg>
      <figcaption className="mono">
        <span>← la citan {izquierda.length}</span>
        {puentes.length > 0 && <span>↓ puentes {puentes.length}</span>}
        <span>enlaza a {salientes.length + mutuos.length} →</span>
      </figcaption>
    </figure>
  );
}
