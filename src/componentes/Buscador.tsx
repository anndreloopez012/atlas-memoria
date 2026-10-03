// Búsqueda global (⌘K): notas de los 6 vaults, skills y agentes en un solo lugar.
import MiniSearch from 'minisearch';
import { Bot, FileText, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cargarAgentes, cargarSkills, cargarVault, useVersionDatos } from '../lib/datos';
import { navegar, rutaAgente, rutaSkill, rutaVault } from '../lib/rutas';
import type { Atlas } from '../lib/tipos';

interface Doc {
  id: string;
  tipo: 'nota' | 'skill' | 'agente';
  titulo: string;
  ruta: string;
  texto: string;
  etiquetas: string;
  destino: string;
  color: string;
  contexto: string;
}

let indiceCache: { version: number; indice: MiniSearch<Doc>; docs: Map<string, Doc> } | null = null;

async function construirIndice(atlas: Atlas, version: number) {
  if (indiceCache?.version === version) return indiceCache;
  const docs: Doc[] = [];
  const [skills, agentes, ...vaults] = await Promise.all([cargarSkills(), cargarAgentes(), ...atlas.vaults.map((v) => cargarVault(v.slug))]);
  atlas.vaults.forEach((v, i) => {
    for (const n of vaults[i].notas) {
      docs.push({
        id: `n:${n.id}`,
        tipo: 'nota',
        titulo: n.t,
        ruta: n.f,
        texto: `${n.h.map((h) => h.t).join(' ')} ${n.ex}`,
        etiquetas: n.tg.join(' '),
        destino: rutaVault(v.slug, n.id),
        color: v.color,
        contexto: `${v.nombre}${n.f ? ` / ${n.f}` : ''}`,
      });
    }
  });
  for (const s of skills.skills) {
    docs.push({
      id: `s:${s.id}`,
      tipo: 'skill',
      titulo: s.nombre,
      ruta: s.titulo,
      texto: `${s.descripcion} ${s.secciones.map((x) => x.t).join(' ')}`,
      etiquetas: `${s.categoria} ${s.paquete ?? ''} ${s.ias.join(' ')}`,
      destino: rutaSkill(s.nombre),
      color: '#dcb56c',
      contexto: `${s.categoria} · ${s.ias.join(', ')}`,
    });
  }
  for (const a of agentes.agentes) {
    docs.push({
      id: `a:${a.id}`,
      tipo: 'agente',
      titulo: a.nombre,
      ruta: a.ambito,
      texto: a.descripcion,
      etiquetas: a.ia,
      destino: rutaAgente(a.id),
      color: '#86efac',
      contexto: `${a.ia} · ${a.ambito}`,
    });
  }
  const indice = new MiniSearch<Doc>({
    fields: ['titulo', 'ruta', 'etiquetas', 'texto'],
    storeFields: ['id'],
    searchOptions: { boost: { titulo: 4, etiquetas: 2, ruta: 1.5 }, prefix: true, fuzzy: 0.18 },
    processTerm: (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(),
  });
  indice.addAll(docs);
  indiceCache = { version, indice, docs: new Map(docs.map((d) => [d.id, d])) };
  return indiceCache;
}

const ICONO = { nota: FileText, skill: Sparkles, agente: Bot };
const GRUPO = { skill: 'Skills', agente: 'Agentes', nota: 'Notas' };

export default function Buscador({ atlas, abierto, cerrar }: { atlas: Atlas; abierto: boolean; cerrar: () => void }) {
  const version = useVersionDatos();
  const [consulta, setConsulta] = useState('');
  const [listo, setListo] = useState<typeof indiceCache>(null);
  const [activo, setActivo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    setActivo(0);
    requestAnimationFrame(() => entrada.current?.select());
    construirIndice(atlas, version).then(setListo);
  }, [abierto, atlas, version]);

  const resultados = useMemo(() => {
    if (!listo || consulta.trim().length < 2) return [];
    const crudos = listo.indice.search(consulta).slice(0, 60);
    const docs = crudos.map((r) => listo.docs.get(r.id as string)!).filter(Boolean);
    // Skills y agentes primero (son pocos y suelen ser lo que se busca), luego notas.
    const orden = ['skill', 'agente', 'nota'] as const;
    return orden.flatMap((t) => docs.filter((d) => d.tipo === t).slice(0, t === 'nota' ? 30 : 8));
  }, [listo, consulta]);

  if (!abierto) return null;

  const ir = (d: Doc) => {
    navegar(d.destino);
    cerrar();
    setConsulta('');
  };

  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && resultados[activo]) ir(resultados[activo]);
  };

  let grupoAnterior = '';
  return (
    <div className="buscador-velo" onMouseDown={cerrar}>
      <div className="buscador" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Buscar en el atlas">
        <div className="buscador-entrada">
          <Search size={18} />
          <input
            ref={entrada}
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              setActivo(0);
            }}
            onKeyDown={tecla}
            placeholder={listo ? `Busca entre ${listo.docs.size.toLocaleString('es-GT')} notas, skills y agentes…` : 'Preparando el índice…'}
            aria-label="Buscar"
          />
          <button className="icono-boton" onClick={cerrar} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="buscador-resultados">
          {consulta.trim().length >= 2 && resultados.length === 0 && listo && <p className="vacio">Nada coincide con «{consulta}».</p>}
          {consulta.trim().length < 2 && (
            <div className="buscador-ayuda">
              <p className="rotulo">Prueba con</p>
              {['contexto para ia', 'web-inmersiva', 'stripe', 'bitacora kinvo', 'remotion', 'reglas de clasificacion'].map((s) => (
                <button key={s} className="chip" onClick={() => setConsulta(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {resultados.map((d, i) => {
            const Icono = ICONO[d.tipo];
            const cabecera = d.tipo !== grupoAnterior ? GRUPO[d.tipo] : null;
            grupoAnterior = d.tipo;
            return (
              <div key={d.id}>
                {cabecera && <p className="rotulo buscador-grupo">{cabecera}</p>}
                <button className={`resultado ${i === activo ? 'activo' : ''}`} onMouseEnter={() => setActivo(i)} onClick={() => ir(d)}>
                  <span className="resultado-icono" style={{ color: d.color }}>
                    <Icono size={15} />
                  </span>
                  <span className="resultado-texto">
                    <span className="resultado-titulo">{d.titulo}</span>
                    <span className="resultado-contexto">{d.contexto}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="buscador-pie mono">
          <span>↑↓ moverse</span>
          <span>↵ abrir</span>
          <span>esc cerrar</span>
        </div>
      </div>
    </div>
  );
}
