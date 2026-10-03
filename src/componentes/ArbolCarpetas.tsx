import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { n } from '../lib/formato';
import type { Carpeta } from '../lib/tipos';

interface Props {
  raiz: Carpeta;
  seleccion: string | null;
  onSeleccion: (ruta: string | null) => void;
  nombreVault: string;
}

export default function ArbolCarpetas({ raiz, seleccion, onSeleccion, nombreVault }: Props) {
  // Se abren los ancestros de la carpeta elegida.
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!seleccion) return;
    setAbiertas((a) => {
      const s = new Set(a);
      const partes = seleccion.split('/');
      for (let i = 1; i <= partes.length; i++) s.add(partes.slice(0, i).join('/'));
      return s;
    });
  }, [seleccion]);

  const alternar = (p: string) =>
    setAbiertas((a) => {
      const s = new Set(a);
      if (s.has(p)) s.delete(p);
      else s.add(p);
      return s;
    });

  const fila = (c: Carpeta, nivel: number) => {
    const abierta = abiertas.has(c.p);
    const tieneHijos = c.h.length > 0;
    const activa = seleccion === c.p;
    return (
      <li key={c.p}>
        <div className={`carpeta-fila ${activa ? 'activa' : ''}`} style={{ paddingLeft: 8 + nivel * 14 }}>
          <button className={`carpeta-flecha ${abierta ? 'abierta' : ''}`} onClick={() => alternar(c.p)} disabled={!tieneHijos} aria-label={abierta ? 'Contraer' : 'Expandir'}>
            {tieneHijos && <ChevronRight size={13} />}
          </button>
          <button
            className="carpeta-nombre"
            onClick={() => {
              onSeleccion(activa ? null : c.p);
              if (tieneHijos && !abierta) alternar(c.p);
            }}
            title={c.p}
          >
            {abierta ? <FolderOpen size={14} /> : <Folder size={14} />}
            <span>{c.n}</span>
          </button>
          <span className="carpeta-cuenta mono">{n(c.t)}</span>
        </div>
        {abierta && tieneHijos && <ul>{c.h.map((h) => fila(h, nivel + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="arbol-carpetas">
      <button className={`carpeta-fila raiz ${seleccion === null ? 'activa' : ''}`} onClick={() => onSeleccion(null)}>
        <span className="carpeta-raiz-punto" />
        <span>{nombreVault}</span>
        <span className="carpeta-cuenta mono">{n(raiz.t)}</span>
      </button>
      <ul>{raiz.h.map((c) => fila(c, 0))}</ul>
      {raiz.d > 0 && <p className="arbol-pie mono">{raiz.d} nota(s) en la raíz</p>}
    </div>
  );
}
