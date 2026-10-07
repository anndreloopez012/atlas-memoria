// Centro de mando (⌘K o «Buscar o pedir»): el único lugar para hacer cosas.
// Busca en notas, skills y agentes de todos los vaults; sin texto muestra lo último
// que abriste, a dónde ir y las acciones disponibles. Las funciones nuevas se suman
// aquí como grupos o acciones, no como botones sueltos por la interfaz.
import MiniSearch from 'minisearch';
import { ArrowRight, Bot, Clock, Compass, FileText, Moon, RefreshCw, Search, Sparkles, Star, Sun, X, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cargarAgentes, cargarSkills, cargarVault, useVersionDatos } from '../lib/datos';
import { useFavoritos } from '../lib/favoritos';
import { recomendador } from '../lib/recomendar';
import { leerRecientes, registrarReciente, type Reciente } from '../lib/recientes';
import { navegar, rutaAgente, rutaSistema, rutaSkill, rutaVault } from '../lib/rutas';
import { alternarTema, useTema } from '../lib/tema';
import type { Atlas, Skill } from '../lib/tipos';

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

/** Una fila del centro de mando: un resultado, un destino o una acción. */
interface Fila {
  clave: string;
  grupo: string;
  titulo: string;
  contexto?: string;
  icono: LucideIcon;
  color?: string;
  ejecutar: () => void;
}

let indiceCache: { version: number; indice: MiniSearch<Doc>; docs: Map<string, Doc>; skills: Skill[] } | null = null;

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
      texto: `${s.descripcion} ${s.descripcionOriginal ?? ''} ${s.secciones.map((x) => x.t).join(' ')}`,
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
      texto: `${a.descripcion} ${a.tipo === 'ia' ? (a.descripcionOriginal ?? '') : ''}`,
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
    processTerm: (t) => sinAcentos(t),
  });
  indice.addAll(docs);
  indiceCache = { version, indice, docs: new Map(docs.map((d) => [d.id, d])), skills: skills.skills };
  return indiceCache;
}

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ICONO: Record<Doc['tipo'], LucideIcon> = { nota: FileText, skill: Sparkles, agente: Bot };
const GRUPO: Record<Doc['tipo'], string> = { skill: 'Skills', agente: 'Agentes', nota: 'Notas' };

export default function CentroMando({ atlas, inicial, cerrar }: { atlas: Atlas; inicial: string; cerrar: () => void }) {
  const version = useVersionDatos();
  const tema = useTema();
  const [consulta, setConsulta] = useState(inicial);
  const [listo, setListo] = useState<typeof indiceCache>(null);
  const [activo, setActivo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const [recientes] = useState<Reciente[]>(leerRecientes);
  const favoritos = useFavoritos();

  useEffect(() => {
    requestAnimationFrame(() => entrada.current?.select());
    construirIndice(atlas, version).then(setListo);
  }, [atlas, version]);

  const abrir = (r: Reciente) => {
    registrarReciente(r);
    navegar(r.destino);
    cerrar();
  };

  // Destinos y acciones: siempre a mano, y filtrables escribiendo.
  const destinos: Fila[] = useMemo(() => {
    const central = atlas.vaults.find((v) => v.slug === atlas.centro);
    const ir = (titulo: string, contexto: string, hash: string): Fila => ({
      clave: `ir:${hash}`,
      grupo: 'Ir a',
      titulo,
      contexto,
      icono: ArrowRight,
      ejecutar: () => {
        navegar(hash);
        cerrar();
      },
    });
    return [
      ir('Universo', 'el mapa de todo', '#/'),
      ir('Hoy', 'lo nuevo desde tu última visita', '#/hoy'),
      ...(central ? [ir('Vaults', `empezar por ${central.nombre}`, rutaVault(central.slug))] : []),
      ir('Skills', `${atlas.totales.skills} skills de tus IAs`, '#/skills'),
      ir('Sistema', 'cómo trabaja tu memoria', rutaSistema('como')),
      ir('Agentes', 'especialistas y automatizaciones', rutaSistema('agentes')),
    ];
  }, [atlas, cerrar]);

  const acciones: Fila[] = useMemo(
    () => [
      {
        clave: 'accion:tema',
        grupo: 'Acciones',
        titulo: tema === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
        icono: tema === 'oscuro' ? Sun : Moon,
        ejecutar: () => {
          alternarTema();
          cerrar();
        },
      },
      {
        clave: 'accion:recorrido',
        grupo: 'Acciones',
        titulo: 'Ver el recorrido',
        contexto: 'una guía corta de cómo usar el atlas',
        icono: Compass,
        ejecutar: () => {
          cerrar();
          window.dispatchEvent(new CustomEvent('atlas:recorrido'));
        },
      },
      {
        clave: 'accion:actualizar',
        grupo: 'Acciones',
        titulo: 'Actualizar los datos ahora',
        contexto: 'vuelve a leer vaults, skills y agentes',
        icono: RefreshCw,
        ejecutar: () => {
          window.dispatchEvent(new CustomEvent('atlas:actualizar'));
          cerrar();
        },
      },
    ],
    [tema, cerrar],
  );

  const filas: Fila[] = useMemo(() => {
    const q = consulta.trim();
    if (q.length < 2) {
      const icono = (tipo: Reciente['tipo']) => (tipo === 'nota' ? FileText : tipo === 'skill' ? Sparkles : Bot);
      const fijos: Fila[] = favoritos.slice(0, 6).map((r) => ({
        clave: `fav:${r.tipo}:${r.id}`,
        grupo: 'Favoritos',
        titulo: r.titulo,
        contexto: r.contexto,
        icono: icono(r.tipo),
        color: r.color,
        ejecutar: () => abrir(r),
      }));
      const ultimos: Fila[] = recientes
        .filter((r) => !favoritos.some((f) => f.tipo === r.tipo && f.id === r.id))
        .slice(0, 5)
        .map((r) => ({
        clave: `rec:${r.tipo}:${r.id}`,
        grupo: 'Recientes',
        titulo: r.titulo,
        contexto: r.contexto,
        icono: icono(r.tipo),
        color: r.color,
        ejecutar: () => abrir(r),
      }));
      return [...fijos, ...ultimos, ...destinos, ...acciones];
    }
    const encontrados: Fila[] = [];
    // «¿Qué skill uso para…?»: si el texto describe una tarea, primero las skills que
    // mejor encajan, con el motivo.
    const recomendadas = listo && (q.split(/\s+/).length >= 2 || q.length >= 4) ? recomendador(listo.skills)(q, 3) : [];
    for (const { skill, razon } of recomendadas) {
      encontrados.push({
        clave: `rec:${skill.id}`,
        grupo: 'Skills para eso',
        titulo: skill.nombre,
        contexto: razon,
        icono: Sparkles,
        color: '#dcb56c',
        ejecutar: () => abrir({ tipo: 'skill', id: skill.id, titulo: skill.nombre, contexto: `skill · ${skill.categoria}`, destino: rutaSkill(skill.nombre), color: '#dcb56c' }),
      });
    }
    const yaRecomendadas = new Set(recomendadas.map((r) => `s:${r.skill.id}`));
    if (listo) {
      const docs = listo.indice
        .search(q)
        .slice(0, 60)
        .map((r) => listo.docs.get(r.id as string)!)
        .filter(Boolean);
      // Skills y agentes primero (son pocos y suelen ser lo que se busca), luego notas.
      for (const tipo of ['skill', 'agente', 'nota'] as const) {
        for (const d of docs.filter((x) => x.tipo === tipo && !yaRecomendadas.has(x.id)).slice(0, tipo === 'nota' ? 30 : 8)) {
          encontrados.push({
            clave: d.id,
            grupo: GRUPO[tipo],
            titulo: d.titulo,
            contexto: d.contexto,
            icono: ICONO[tipo],
            color: d.color,
            ejecutar: () => abrir({ tipo, id: d.id.slice(2), titulo: d.titulo, contexto: d.contexto, destino: d.destino, color: d.color }),
          });
        }
      }
    }
    const coincide = (f: Fila) => sinAcentos(`${f.titulo} ${f.contexto ?? ''}`).includes(sinAcentos(q));
    return [...encontrados, ...destinos.filter(coincide), ...acciones.filter(coincide)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta, listo, recientes, favoritos, destinos, acciones]);

  // La fila activa siempre a la vista al moverse con el teclado.
  useEffect(() => {
    lista.current?.querySelector('.resultado.activo')?.scrollIntoView({ block: 'nearest' });
  }, [activo]);

  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, filas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filas[activo]) filas[activo].ejecutar();
  };

  const q = consulta.trim();
  let grupoAnterior = '';
  return (
    <div className="buscador-velo" onMouseDown={cerrar}>
      <div className="buscador" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Centro de mando">
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
            placeholder="Busca o pide algo: una nota, una skill, «qué uso para hacer un video»…"
            aria-label="Buscar o pedir"
            aria-controls="centro-filas"
          />
          <button className="icono-boton" onClick={cerrar} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="buscador-resultados" ref={lista} id="centro-filas" role="listbox">
          {q.length >= 2 && !listo && <p className="vacio">Preparando el índice de {atlas.totales.notas.toLocaleString('es-GT')} notas…</p>}
          {q.length >= 2 && listo && filas.length === 0 && <p className="vacio">Nada coincide con «{consulta}».</p>}
          {filas.map((f, i) => {
            const Icono = f.icono;
            const cabecera = f.grupo !== grupoAnterior ? f.grupo : null;
            grupoAnterior = f.grupo;
            return (
              <div key={f.clave}>
                {cabecera && (
                  <p className="rotulo buscador-grupo">
                    {cabecera === 'Recientes' && <Clock size={11} />}
                    {cabecera === 'Favoritos' && <Star size={11} />} {cabecera}
                  </p>
                )}
                <button className={`resultado ${i === activo ? 'activo' : ''}`} role="option" aria-selected={i === activo} onMouseEnter={() => setActivo(i)} onClick={f.ejecutar}>
                  <span className="resultado-icono" style={{ color: f.color }}>
                    <Icono size={15} />
                  </span>
                  <span className="resultado-texto">
                    <span className="resultado-titulo">{f.titulo}</span>
                    {f.contexto && <span className="resultado-contexto">{f.contexto}</span>}
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
