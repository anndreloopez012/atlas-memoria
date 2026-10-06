import { useEffect, useState } from 'react';
import { Marca } from './componentes/BarraSuperior';
import BarraSuperior from './componentes/BarraSuperior';
import Buscador from './componentes/Buscador';
import { cargarAtlas, recargarDatos, useDatos } from './lib/datos';
import { useRuta } from './lib/rutas';
import Agentes from './pantallas/Agentes';
import Sistema from './pantallas/Sistema';
import Skills from './pantallas/Skills';
import Universo from './pantallas/Universo';
import Vault from './pantallas/Vault';

export default function App() {
  const ruta = useRuta();
  const { datos: atlas, error } = useDatos('atlas', cargarAtlas);
  const [buscando, setBuscando] = useState(false);

  // ⌘K / Ctrl+K abre la búsqueda; «/» también, si no se está escribiendo.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const escribiendo = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !escribiendo)) {
        e.preventDefault();
        setBuscando(true);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  // El servidor de desarrollo avisa cuando los vaults cambiaron y el atlas se regeneró.
  useEffect(() => {
    if (!import.meta.hot) return;
    const aviso = () => recargarDatos();
    import.meta.hot.on('atlas:datos', aviso);
    return () => import.meta.hot?.off('atlas:datos', aviso);
  }, []);

  // Al cambiar de página se vuelve arriba (dentro de un vault el desplazamiento es por panel).
  const pagina = ruta.vista === 'skills' ? `s:${ruta.skill}` : ruta.vista === 'agentes' ? `a:${ruta.agente}` : ruta.vista === 'vault' ? 'vault' : ruta.vista;
  useEffect(() => {
    document.querySelector('.contenido')?.scrollTo({ top: 0 });
  }, [pagina]);

  useEffect(() => {
    const titulos: Record<string, string> = { universo: 'Universo', vault: 'Vaults', skills: 'Skills', agentes: 'Agentes', sistema: 'Cómo trabaja' };
    document.title = `${titulos[ruta.vista]} · Atlas de memoria`;
  }, [ruta.vista]);

  return (
    <div className="app">
      <BarraSuperior atlas={atlas} ruta={ruta} abrirBuscador={() => setBuscando(true)} />
      <main className="contenido">
        {error && (
          <div className="pantalla-estado">
            <Marca />
            <h1 className="display">Todavía no hay mapa</h1>
            <p>{error}</p>
            <pre className="mono">npm run instalar</pre>
          </div>
        )}
        {!atlas && !error && (
          <div className="pantalla-estado cargando">
            <Marca />
            <p className="rotulo">Trazando el mapa…</p>
          </div>
        )}
        {atlas && ruta.vista === 'universo' && <Universo atlas={atlas} />}
        {atlas && ruta.vista === 'vault' && atlas.vaults.length > 0 && <Vault key={ruta.slug || 'centro'} atlas={atlas} slug={ruta.slug} notaId={ruta.nota} carpeta={ruta.carpeta} />}
        {atlas && ruta.vista === 'vault' && atlas.vaults.length === 0 && (
          <div className="pantalla-estado">
            <Marca />
            <h1 className="display">Todavía no hay vaults</h1>
            <p>No se encontró ningún vault de Obsidian en este equipo. Pídele a tu IA que agregue uno al atlas, o ejecuta:</p>
            <pre className="mono">npm run instalar -- --vault "/ruta/a/tu/vault"</pre>
          </div>
        )}
        {atlas && ruta.vista === 'skills' && <Skills atlas={atlas} skill={ruta.skill} categoria={ruta.categoria} />}
        {atlas && ruta.vista === 'agentes' && <Agentes atlas={atlas} agente={ruta.agente} />}
        {atlas && ruta.vista === 'sistema' && <Sistema atlas={atlas} />}
      </main>
      {atlas && <Buscador atlas={atlas} abierto={buscando} cerrar={() => setBuscando(false)} />}
    </div>
  );
}
