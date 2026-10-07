import { lazy, Suspense, useEffect, useState } from 'react';
import { Marca } from './componentes/BarraSuperior';
import BarraSuperior from './componentes/BarraSuperior';
import CentroMando from './componentes/CentroMando';
import { cargarAtlas, recargarDatos, useDatos } from './lib/datos';
import { useRuta } from './lib/rutas';
import Universo from './pantallas/Universo';

// Las demás pantallas se cargan al abrirlas: la portada aparece antes.
const Hoy = lazy(() => import('./pantallas/Hoy'));
const Vault = lazy(() => import('./pantallas/Vault'));
const Skills = lazy(() => import('./pantallas/Skills'));
const Agentes = lazy(() => import('./pantallas/Agentes'));
const Sistema = lazy(() => import('./pantallas/Sistema'));

export default function App() {
  const ruta = useRuta();
  const { datos: atlas, error } = useDatos('atlas', cargarAtlas);
  // Centro de mando: null = cerrado; un texto = abierto con eso escrito.
  const [centro, setCentro] = useState<string | null>(null);

  // ⌘K / Ctrl+K abre el centro de mando; «/» también, si no se está escribiendo.
  // Cualquier pantalla puede abrirlo con abrirCentro() (lib/recientes).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const escribiendo = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !escribiendo)) {
        e.preventDefault();
        setCentro('');
      }
    };
    const pedido = (e: Event) => setCentro((e as CustomEvent<string>).detail ?? '');
    window.addEventListener('keydown', tecla);
    window.addEventListener('atlas:centro', pedido);
    return () => {
      window.removeEventListener('keydown', tecla);
      window.removeEventListener('atlas:centro', pedido);
    };
  }, []);

  // El servidor de desarrollo avisa cuando los vaults cambiaron y el atlas se regeneró.
  useEffect(() => {
    if (!import.meta.hot) return;
    const aviso = () => recargarDatos();
    import.meta.hot.on('atlas:datos', aviso);
    return () => import.meta.hot?.off('atlas:datos', aviso);
  }, []);

  // Al cambiar de página se vuelve arriba (dentro de un vault el desplazamiento es por panel).
  const pagina = ruta.vista === 'hoy' ? `h:${ruta.seccion}` : ruta.vista === 'skills' ? `s:${ruta.skill}` : ruta.vista === 'agentes' ? `a:${ruta.agente}` : ruta.vista === 'vault' ? 'vault' : ruta.vista;
  useEffect(() => {
    document.querySelector('.contenido')?.scrollTo({ top: 0 });
  }, [pagina]);

  useEffect(() => {
    const titulos: Record<string, string> = { universo: 'Universo', hoy: 'Hoy', vault: 'Vaults', skills: 'Skills', agentes: 'Agentes', sistema: 'Sistema' };
    document.title = `${titulos[ruta.vista]} · Atlas de memoria`;
  }, [ruta.vista]);

  return (
    <div className="app">
      <BarraSuperior atlas={atlas} ruta={ruta} abrirBuscador={() => setCentro('')} />
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
        <Suspense
          fallback={
            <div className="pantalla-estado cargando">
              <Marca />
            </div>
          }
        >
        {atlas && ruta.vista === 'hoy' && <Hoy atlas={atlas} seccion={ruta.seccion} />}
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
        {atlas && ruta.vista === 'sistema' && <Sistema atlas={atlas} pestana={ruta.pestana} />}
        </Suspense>
      </main>
      {atlas && centro !== null && <CentroMando atlas={atlas} inicial={centro} cerrar={() => setCentro(null)} />}
    </div>
  );
}
