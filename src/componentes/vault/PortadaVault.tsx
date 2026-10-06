// Portada de un vault: carril para saltar a otros vaults, el vault como planeta,
// su propósito, cifras, pulso de actividad, puentes con otros vaults, etiquetas
// principales y notas de entrada.
import { ArrowUpRight, ChevronDown, Info } from 'lucide-react';
import { useMemo } from 'react';
import { pulsoSemanal, recientes } from '../../lib/actividad';
import { vaultCentral } from '../../lib/atlas';
import { hace, n } from '../../lib/formato';
import { rutaVault } from '../../lib/rutas';
import { tono, useTema } from '../../lib/tema';
import type { Atlas, Carpeta, Nota, ResumenVault } from '../../lib/tipos';
import SelectorVaults from '../SelectorVaults';
import OrbeVault from './OrbeVault';

const compacto = new Intl.NumberFormat('es-GT', { notation: 'compact', maximumFractionDigits: 1 });

const contarCarpetas = (c: Carpeta): number => c.h.reduce((t, h) => t + 1 + contarCarpetas(h), 0);

interface Props {
  atlas: Atlas;
  vault: ResumenVault;
  notas: Nota[] | null;
  porId: Map<string, Nota>;
  onEtiqueta: (etiqueta: string) => void;
}

export default function PortadaVault({ atlas, vault, notas, porId, onEtiqueta }: Props) {
  const tema = useTema();
  const centro = vaultCentral(atlas);
  const indice = atlas.vaults.indexOf(vault);
  const pulso = useMemo(() => (notas ? pulsoSemanal(notas) : null), [notas]);
  const ultimoMes = useMemo(() => (notas ? recientes(notas, 30) : null), [notas]);
  const maxPulso = Math.max(...(pulso ?? [1]), 1);

  // Puentes con otros vaults (sumando ambos sentidos), del más fuerte al más débil.
  const puentes = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of atlas.puentes) {
      if (p.de === vault.nombre) m.set(p.a, (m.get(p.a) ?? 0) + p.n);
      if (p.a === vault.nombre) m.set(p.de, (m.get(p.de) ?? 0) + p.n);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [atlas.puentes, vault.nombre]);
  const totalPuentes = puentes.reduce((t, [, c]) => t + c, 0);

  return (
    <header className="portada-vault">
      <SelectorVaults atlas={atlas} actual={vault.slug} />

      <div className="portada-principal">
        <div className="portada-orbe">
          <OrbeVault color={vault.color} tamano={112} carpetas={vault.carpetas.h} />
        </div>

        <div className="portada-texto">
          <p className="rotulo">
            Vault {String(indice + 1).padStart(2, '0')} / {String(atlas.vaults.length).padStart(2, '0')} · {vault === centro ? 'centro: de aquí nacen los demás' : `nace de ${centro?.nombre ?? 'el centro'}`}
          </p>
          <h1 className="display portada-nombre">{vault.nombre}</h1>
          {vault.proposito && <p className="portada-proposito">{vault.proposito}</p>}
          <div className="portada-chips">
            {vault.entradas.slice(0, 4).map((id) => (
              <a key={id} className="chip entrada" href={rutaVault(vault.slug, id)}>
                <ArrowUpRight size={12} /> {porId.get(id)?.t ?? 'Entrada'}
              </a>
            ))}
            {vault.etiquetas.slice(0, 6).map(([etiqueta, veces]) => (
              <button key={etiqueta} className="chip etiqueta-chip" onClick={() => onEtiqueta(`#${etiqueta}`)} title={`${veces} notas con #${etiqueta}`}>
                #{etiqueta}
              </button>
            ))}
            {(vault.incluye.length > 0 || vault.noIncluye.length > 0 || vault.complementos.length > 0) && (
              <details className="portada-mas">
                <summary className="chip">
                  <Info size={12} /> Qué guarda <ChevronDown size={12} />
                </summary>
                <div className="portada-mas-cuerpo">
                  {vault.incluye.length > 0 && (
                    <div>
                      <h3 className="rotulo">Incluye</h3>
                      <ul>{vault.incluye.map((i) => <li key={i}>{i}</li>)}</ul>
                    </div>
                  )}
                  {vault.noIncluye.length > 0 && (
                    <div>
                      <h3 className="rotulo">No incluye</h3>
                      <ul>{vault.noIncluye.map((i) => <li key={i}>{i}</li>)}</ul>
                    </div>
                  )}
                  {vault.complementos.length > 0 && (
                    <div>
                      <h3 className="rotulo">Complementos de Obsidian</h3>
                      <p className="mono">{vault.complementos.join(' · ')}</p>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>

        <div className="portada-tablero">
          <dl className="tablero-cifras">
            <div>
              <dt>notas</dt>
              <dd>{n(vault.notas)}</dd>
            </div>
            <div>
              <dt>carpetas</dt>
              <dd>{n(contarCarpetas(vault.carpetas))}</dd>
            </div>
            <div>
              <dt>enlaces</dt>
              <dd>{compacto.format(vault.enlaces)}</dd>
            </div>
            <div>
              <dt>palabras</dt>
              <dd>{compacto.format(vault.palabras)}</dd>
            </div>
          </dl>

          <div className="tablero-pulso" aria-label="Notas tocadas por semana en los últimos seis meses">
            <div className="pulso-barras">
              {(pulso ?? new Array(26).fill(0)).map((c, i) => (
                <span key={i} style={{ height: `${pulso ? 8 + (c / maxPulso) * 92 : 8}%`, opacity: pulso ? 0.35 + (c / maxPulso) * 0.65 : 0.2 }} title={`${c} notas`} />
              ))}
            </div>
            <p className="mono">
              {ultimoMes === null ? 'midiendo actividad…' : `${n(ultimoMes)} notas tocadas en 30 días · última ${hace(vault.ultima)}`}
            </p>
          </div>

          {puentes.length > 0 && (
            <div className="tablero-puentes">
              <span className="rotulo">Puentes · {n(totalPuentes)}</span>
              <div className="puentes-barra" role="list">
                {puentes.map(([nombre, cuenta]) => {
                  const otro = atlas.vaults.find((v) => v.nombre === nombre);
                  return (
                    <a
                      key={nombre}
                      role="listitem"
                      href={otro ? rutaVault(otro.slug) : undefined}
                      style={{ flexGrow: cuenta, background: otro ? tono(otro.color, tema) : 'var(--tinta-3)' }}
                      title={`${nombre}: ${cuenta} enlaces entre ambos vaults`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
