// «Cómo trabaja»: los pasos que sigue una skill o un agente, de tu pedido al resultado.
import type { ReactNode } from 'react';

export interface Paso {
  titulo: string;
  detalle: ReactNode;
  cifra?: string;
  apagado?: boolean;
}

export default function Pipeline({ pasos }: { pasos: Paso[] }) {
  return (
    <ol className="pipeline">
      {pasos.map((p, i) => (
        <li key={i} className={p.apagado ? 'apagado' : ''} style={{ animationDelay: `${i * 0.07}s` }}>
          <span className="pipeline-numero mono">{String(i + 1).padStart(2, '0')}</span>
          <div className="pipeline-texto">
            <h4>
              {p.titulo}
              {p.cifra && <span className="pipeline-cifra mono">{p.cifra}</span>}
            </h4>
            <div className="pipeline-detalle">{p.detalle}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
