import { Moon, RefreshCw, Search, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cargarRecientes, recargarDatos, regenerarEnServidor, useDatos } from '../lib/datos';
import { hace } from '../lib/formato';
import { rutaVault, type Ruta } from '../lib/rutas';
import { alternarTema, useTema } from '../lib/tema';
import type { Atlas } from '../lib/tipos';
import { desdeNovedades } from '../lib/visita';

// Cinco secciones como máximo: cada una con un propósito claro. Lo demás se hace
// desde el centro de mando (⌘K), así la barra no se llena de botones.
const secciones = (atlas: Atlas | null): { vistas: Ruta['vista'][]; hash: string; etiqueta: string }[] => [
  { vistas: ['universo'], hash: '#/', etiqueta: 'Universo' },
  { vistas: ['hoy'], hash: '#/hoy', etiqueta: 'Hoy' },
  { vistas: ['vault'], hash: rutaVault(atlas?.centro ?? ''), etiqueta: 'Vaults' },
  { vistas: ['skills'], hash: '#/skills', etiqueta: 'Skills' },
  { vistas: ['sistema', 'agentes'], hash: '#/sistema', etiqueta: 'Sistema' },
];

export function Marca() {
  return (
    <svg className="marca-icono" viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="16" rx="13" ry="8.5" fill="none" stroke="currentColor" strokeOpacity=".45" transform="rotate(-24 16 16)" />
      <circle cx="16" cy="16" r="4.4" fill="#1d24f7" />
      <circle cx="16" cy="16" r="4.4" fill="none" stroke="#8d92ff" strokeOpacity=".8" />
      <circle cx="27.2" cy="10.3" r="1.9" fill="var(--laton)" />
      <circle cx="5.6" cy="21.4" r="1.3" fill="currentColor" fillOpacity=".7" />
    </svg>
  );
}

export default function BarraSuperior({ atlas, ruta, abrirBuscador }: { atlas: Atlas | null; ruta: Ruta; abrirBuscador: () => void }) {
  const tema = useTema();
  const [regenerando, setRegenerando] = useState(false);
  // Un punto discreto en «Hoy» cuando hay notas tuyas nuevas desde la última visita.
  const recientes = useDatos('recientes', cargarRecientes);
  const hayNovedades = (recientes.datos?.notas ?? []).some((x) => !x.g && Date.parse(x.m) > desdeNovedades(7));
  const [aviso, setAviso] = useState<string | null>(null);

  // El centro de mando también puede pedir una actualización.
  useEffect(() => {
    const pedido = () => void actualizar();
    window.addEventListener('atlas:actualizar', pedido);
    return () => window.removeEventListener('atlas:actualizar', pedido);
  });

  const actualizar = async () => {
    setRegenerando(true);
    setAviso(null);
    try {
      const r = await regenerarEnServidor();
      if (!r.ok) setAviso(r.salida.split('\n')[0] || 'No se pudo regenerar');
      recargarDatos();
    } catch {
      setAviso('El servidor no responde');
    } finally {
      setRegenerando(false);
    }
  };

  return (
    <header className="barra">
      <a className="marca" href="#/" aria-label="Atlas de memoria · inicio">
        <Marca />
        <span className="marca-texto">
          <span className="display">Atlas</span>
          <span className="rotulo">de memoria</span>
        </span>
      </a>

      <nav className="navegacion" aria-label="Secciones">
        {secciones(atlas).map((s) => {
          const activa = s.vistas.includes(ruta.vista);
          return (
            <a key={s.etiqueta} href={s.hash} className={activa ? 'activa' : ''} aria-current={activa ? 'page' : undefined}>
              {s.etiqueta}
              {s.vistas.includes('hoy') && hayNovedades && !activa && <span className="punto-novedad" aria-label="hay novedades" />}
            </a>
          );
        })}
      </nav>

      <div className="barra-acciones">
        <button className="buscar-boton" onClick={abrirBuscador} aria-label="Buscar o pedir algo (⌘K)">
          <Search size={15} />
          <span>Buscar o pedir</span>
          <kbd>⌘K</kbd>
        </button>
        <button className="icono-boton estado-datos" onClick={actualizar} disabled={regenerando} title={aviso ?? 'Volver a leer vaults, skills y agentes'}>
          <RefreshCw size={15} className={regenerando ? 'girando' : ''} />
          <span className="mono">{regenerando ? 'leyendo…' : atlas ? hace(atlas.generado) : '—'}</span>
        </button>
        <button className="icono-boton boton-tema" onClick={alternarTema} aria-label={tema === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
          {tema === 'oscuro' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
