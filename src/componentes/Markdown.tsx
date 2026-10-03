import { useMemo, type MouseEvent } from 'react';
import { renderizarMarkdown } from '../lib/markdown';

interface Props {
  texto: string;
  /** Clic en un enlace a otra nota del atlas */
  onNota?: (id: string) => void;
  /** Clic en un enlace relativo (p. ej. references/archivo.md dentro de una skill) */
  onRuta?: (ruta: string) => void;
  className?: string;
}

export default function Markdown({ texto, onNota, onRuta, className }: Props) {
  const html = useMemo(() => renderizarMarkdown(texto), [texto]);

  const clic = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    if (a.dataset.nota) {
      e.preventDefault();
      onNota?.(a.dataset.nota);
    } else if (a.dataset.ruta) {
      e.preventDefault();
      onRuta?.(a.dataset.ruta);
    } else if (a.getAttribute('href')?.startsWith('#') && a.getAttribute('href')!.length > 1) {
      // Ancla interna a un encabezado.
      e.preventDefault();
      const destino = a.closest('.md')?.querySelector(`[id="${a.getAttribute('href')!.slice(1)}"]`);
      destino?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return <div className={`md ${className ?? ''}`} onClick={clic} dangerouslySetInnerHTML={{ __html: html }} />;
}
