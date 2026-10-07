// Recorrido guiado: cinco pasos que explican cómo usar el atlas. Aparece solo la
// primera vez (lo recuerda el navegador) y se repite desde el centro de mando
// («Ver el recorrido»). Cada paso ilumina una parte de la pantalla; si esa parte no
// está a la vista, la tarjeta se muestra al centro.
import { useEffect, useLayoutEffect, useState } from 'react';
import { navegar } from '../lib/rutas';

interface Paso {
  titulo: string;
  texto: string;
  /** selector de la parte a iluminar */
  foco?: string;
  /** a dónde ir antes de mostrar el paso */
  ir?: string;
}

const PASOS: Paso[] = [
  { titulo: 'Tu memoria, una sola mente', texto: 'El atlas lee tus vaults de Obsidian, tus skills y tus agentes, y los dibuja para que encuentres todo sin acordarte de dónde está.', ir: '#/' },
  { titulo: 'Cada cerebro es un vault', texto: 'Crece con sus notas. Toca uno para entrar; las neuronas grandes son sus carpetas y llevan directo a ellas.', foco: '.cielo-lienzo svg', ir: '#/' },
  { titulo: 'Hoy', texto: 'Lo nuevo desde tu última visita, tus pendientes, tus proyectos y tus favoritos, en una sola página.', foco: '.navegacion a[href="#/hoy"]' },
  { titulo: 'Todo lo demás, aquí', texto: 'Buscar o pedir (⌘K) es el centro de mando: busca en todo, abre lo último que viste y reúne las acciones. Así la pantalla no se llena de botones.', foco: '.buscar-boton' },
  { titulo: 'Guarda lo que usas seguido', texto: 'La estrella ☆ en una nota, skill o agente la guarda en favoritos: aparece en Hoy y arriba del centro de mando.' },
];

const CLAVE = 'atlas-recorrido-visto';

function yaVisto() {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return true; // sin almacenamiento no se insiste en cada visita
  }
}

export default function Recorrido({ listo }: { listo: boolean }) {
  const [paso, setPaso] = useState<number | null>(null);
  const [caja, setCaja] = useState<DOMRect | null>(null);

  // Primera visita: arranca solo, cuando ya hay datos en pantalla.
  useEffect(() => {
    if (!listo || yaVisto()) return;
    const t = setTimeout(() => setPaso(0), 1200);
    return () => clearTimeout(t);
  }, [listo]);

  useEffect(() => {
    const repetir = () => setPaso(0);
    window.addEventListener('atlas:recorrido', repetir);
    return () => window.removeEventListener('atlas:recorrido', repetir);
  }, []);

  const actual = paso === null ? null : PASOS[paso];

  // Ubica la parte a iluminar (y la sigue si cambia el tamaño de la ventana).
  useLayoutEffect(() => {
    if (!actual) return;
    if (actual.ir) navegar(actual.ir);
    let cuadro = 0;
    const medir = () => {
      const el = actual.foco ? document.querySelector(actual.foco) : null;
      const r = el?.getBoundingClientRect();
      setCaja(r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight ? r : null);
    };
    cuadro = requestAnimationFrame(medir);
    const t = setTimeout(medir, 350);
    window.addEventListener('resize', medir);
    return () => {
      cancelAnimationFrame(cuadro);
      clearTimeout(t);
      window.removeEventListener('resize', medir);
    };
  }, [actual]);

  const terminar = () => {
    try {
      localStorage.setItem(CLAVE, '1');
    } catch {
      /* sin almacenamiento */
    }
    setPaso(null);
  };
  const siguiente = () => (paso !== null && paso < PASOS.length - 1 ? setPaso(paso + 1) : terminar());

  useEffect(() => {
    if (paso === null) return;
    const tecla = (e: KeyboardEvent) => {
      // Enter sobre un botón ya lo resuelve el propio botón.
      const enBoton = (e.target as HTMLElement)?.closest('button');
      if (e.key === 'Escape') terminar();
      else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !enBoton)) siguiente();
      else if (e.key === 'ArrowLeft' && paso > 0) setPaso(paso - 1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  if (!actual || paso === null) return null;

  const margen = 8;
  const foco = caja ? { top: caja.top - margen, left: caja.left - margen, width: caja.width + margen * 2, height: caja.height + margen * 2 } : null;
  // La tarjeta va debajo de lo iluminado (o arriba si no cabe); sin foco, al centro.
  const debajo = foco && foco.top + foco.height + 220 < window.innerHeight;
  const tarjeta = foco
    ? {
        top: debajo ? foco.top + foco.height + 14 : Math.max(16, foco.top - 14 - 200),
        left: Math.min(Math.max(16, foco.left + foco.width / 2 - 170), window.innerWidth - 356),
      }
    : null;

  return (
    <div className="recorrido" role="dialog" aria-modal="true" aria-label={`Recorrido, paso ${paso + 1} de ${PASOS.length}: ${actual.titulo}`}>
      {foco ? <div className="recorrido-foco" style={foco} /> : <div className="recorrido-velo" />}
      <div className={`recorrido-tarjeta ${tarjeta ? '' : 'centro'}`} style={tarjeta ?? undefined}>
        <p className="rotulo">
          Paso {paso + 1} de {PASOS.length}
        </p>
        <h2 className="display">{actual.titulo}</h2>
        <p>{actual.texto}</p>
        <div className="recorrido-acciones">
          <button className="boton-texto" onClick={terminar}>
            Saltar
          </button>
          <span className="recorrido-puntos" aria-hidden="true">
            {PASOS.map((_, i) => (
              <span key={i} className={i === paso ? 'activo' : ''} />
            ))}
          </span>
          <button className="boton-primario" onClick={siguiente} autoFocus>
            {paso === PASOS.length - 1 ? 'Empezar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
