import { ArrowRight, FolderPlus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { agregarVault, type VaultListo } from '../lib/datos';

// El resultado sobrevive a que la pantalla cambie: al crearse el vault, el Universo
// ya tiene centro, pero sigue mostrando cómo abrirlo en Obsidian.
let ultimo: VaultListo | null = null;
export const vaultRecienAgregado = () => Boolean(ultimo?.ok);

/**
 * Para quien todavía no tiene vaults: crea uno con notas guía en un clic, o agrega
 * la carpeta del que ya tiene. Aparece en el Universo y en Vaults mientras no haya ninguno.
 */
export default function EmpezarVault() {
  const [estado, setEstado] = useState<'listo' | 'trabajando'>('listo');
  const [resultado, setResultado] = useState<VaultListo | null>(ultimo);
  const [ruta, setRuta] = useState('');

  const pedir = async (pedido: { inicial: true } | { ruta: string }) => {
    setEstado('trabajando');
    setResultado(null);
    ultimo = await agregarVault(pedido);
    setResultado(ultimo);
    setEstado('listo');
  };

  if (resultado?.ok) {
    return (
      <div className="empezar" role="status">
        <p className="rotulo">Listo</p>
        <p>
          <strong>{resultado.nombre}</strong> {resultado.creado ? 'quedó creado en' : 'ya está en el atlas desde'} <code>{resultado.ruta}</code>.
        </p>
        <a className="boton-primario" href={resultado.obsidian}>
          Abrir en Obsidian <ArrowRight size={15} />
        </a>
        <p className="empezar-nota">
          ¿No tienes Obsidian? Es gratis:{' '}
          <a href="https://obsidian.md/download" target="_blank" rel="noreferrer">
            obsidian.md/download
          </a>
          . Luego elige «Abrir carpeta como vault».
        </p>
      </div>
    );
  }

  return (
    <div className="empezar">
      <p className="rotulo">Empieza tu memoria</p>
      <p>Un vault es una carpeta de notas. Crea uno con notas guía que te enseñan a usarlo, o suma el que ya tienes.</p>
      <button type="button" className="boton-primario" disabled={estado === 'trabajando'} onClick={() => pedir({ inicial: true })}>
        <Sparkles size={16} /> {estado === 'trabajando' ? 'Preparando tu vault…' : 'Crear mi primer vault'}
      </button>
      <details className="empezar-tengo">
        <summary>Ya tengo un vault</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (ruta.trim()) void pedir({ ruta: ruta.trim() });
          }}
        >
          <input value={ruta} onChange={(e) => setRuta(e.target.value)} placeholder="~/Documents/Mi vault" aria-label="Ruta de la carpeta del vault" spellCheck={false} />
          <button type="submit" className="boton-secundario" disabled={estado === 'trabajando' || !ruta.trim()}>
            <FolderPlus size={14} /> Agregar
          </button>
        </form>
      </details>
      {resultado?.error && <p className="empezar-error">{resultado.error}</p>}
    </div>
  );
}
