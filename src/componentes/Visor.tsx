// Ventana para leer un archivo de referencia (o el SKILL.md completo) sin perder el sitio.
import { X } from 'lucide-react';
import { useEffect } from 'react';
import Markdown from './Markdown';

interface Props {
  titulo: string;
  subtitulo?: string;
  texto: string;
  cerrar: () => void;
  onRuta?: (ruta: string) => void;
}

export default function Visor({ titulo, subtitulo, texto, cerrar, onRuta }: Props) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [cerrar]);

  const esMarkdown = /\.md$/i.test(titulo) || !/\.[a-z0-9]+$/i.test(titulo);
  return (
    <div className="visor-velo" onMouseDown={cerrar}>
      <div className="visor" role="dialog" aria-label={titulo} onMouseDown={(e) => e.stopPropagation()}>
        <header className="visor-cabecera">
          <div>
            <p className="rotulo">{subtitulo}</p>
            <h2 className="mono">{titulo}</h2>
          </div>
          <button className="icono-boton" onClick={cerrar} aria-label="Cerrar">
            <X size={16} />
          </button>
        </header>
        <div className="visor-cuerpo">
          {esMarkdown ? (
            <Markdown texto={texto.replace(/^---\n[\s\S]*?\n---\n/, '')} onRuta={onRuta} />
          ) : (
            <pre className="visor-texto mono">{texto}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
