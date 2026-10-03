// Carril para saltar entre vaults. CORE va primero y separado: es la raíz de la
// que nacen los demás (la línea dibuja esa rama).
import { navegar, rutaVault } from '../lib/rutas';
import { tono, useTema } from '../lib/tema';
import type { Atlas } from '../lib/tipos';

export default function SelectorVaults({ atlas, actual }: { atlas: Atlas; actual: string }) {
  const tema = useTema();
  const core = atlas.vaults.find((v) => v.nombre === 'CORE') ?? atlas.vaults[0];
  const hijos = atlas.vaults.filter((v) => v !== core);
  const boton = (v: typeof core) => (
    <button
      key={v.slug}
      className={`vault-pastilla ${v.slug === actual ? 'activa' : ''} ${v === core ? 'raiz' : ''}`}
      style={{ ['--vault' as string]: v.color, ['--vault-texto' as string]: tono(v.color, tema) }}
      onClick={() => navegar(rutaVault(v.slug))}
      aria-current={v.slug === actual ? 'page' : undefined}
    >
      <span className="vault-pastilla-punto" />
      {v.nombre}
      <span className="mono">{v.notas.toLocaleString('es-GT')}</span>
    </button>
  );
  return (
    <nav className="selector-vaults" aria-label="Vaults">
      {boton(core)}
      <svg className="selector-rama" viewBox="0 0 40 24" aria-hidden="true">
        <path d="M0 12 H18 M18 12 C26 12 26 4 40 4 M18 12 C26 12 26 20 40 20" fill="none" stroke="currentColor" />
      </svg>
      <div className="selector-hijos">{hijos.map(boton)}</div>
    </nav>
  );
}
