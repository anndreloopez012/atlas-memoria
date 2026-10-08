// Centro de mando (⌘K o «Buscar o pedir»): el único lugar para hacer cosas.
// Busca en notas, skills y agentes de todos los vaults; sin texto muestra lo último
// que abriste, a dónde ir y las acciones disponibles. Las funciones nuevas se suman
// aquí como grupos o acciones, no como botones sueltos por la interfaz.
import MiniSearch from 'minisearch';
import { ArrowRight, ArrowUpCircle, Bot, Check, Clock, Compass, ExternalLink, FileText, GraduationCap, Share2, ImageDown, MessageCircleQuestion, Mic, Moon, NotebookPen, RefreshCw, Search, Sparkles, Star, Sun, X, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cargarAgentes, cargarSkills, cargarVault, useActualizacion, useVersionDatos } from '../lib/datos';
import { useFavoritos } from '../lib/favoritos';
import { marcarPaso } from '../lib/aprende';
import { ABRIR_ACTUALIZAR, VistaActualizacion } from './Actualizacion';
import { VistaAvance } from './Avance';
import { ABRIR_APRENDE, usePasosAprende, VistaAprende } from './Aprende';
import Markdown from './Markdown';
import { recomendador } from '../lib/recomendar';
import { interpretarVoz, reconocimientoDeVoz, type ReconocimientoVoz } from '../lib/voz';
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

/** Qué IA respondería las preguntas (null: ninguna; undefined: sin servidor). */
let iaCache: Promise<string | null | undefined> | null = null;
const iaDisponible = () =>
  (iaCache ??= fetch('/__atlas/preguntar')
    .then((r) => (r.ok ? r.json() : { ia: undefined }))
    .then((d: { ia?: string | null }) => d.ia)
    .catch(() => undefined));

/** Dónde quedaría una captura (null: sin servidor). */
let capturaCache: Promise<{ modo: string; destino: string | null } | null> | null = null;
const destinoCaptura = () =>
  (capturaCache ??= fetch('/__atlas/capturar')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null));

interface Captura {
  texto: string;
  guardando: boolean;
  ok?: boolean;
  error?: string;
  duplicada?: boolean;
  vault?: string;
  slug?: string;
  rel?: string;
  id?: string;
  obsidian?: string;
}

const ES_PREGUNTA = /^(qu[eé]|c[oó]mo|cu[aá]ndo|d[oó]nde|por ?qu[eé]|cu[aá]l(es)?|qui[eé]n(es)?|para qu[eé]|cu[aá]nt[oa]s?)\b/i;

interface Fuente {
  id: string;
  s: string;
  v: string;
  t: string;
  f: string;
}

interface Respuesta {
  pregunta: string;
  cargando: boolean;
  ia: string | null;
  texto: string | null;
  error: string | null;
  fuentes: Fuente[];
}

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ICONO: Record<Doc['tipo'], LucideIcon> = { nota: FileText, skill: Sparkles, agente: Bot };
const GRUPO: Record<Doc['tipo'], string> = { skill: 'Skills', agente: 'Agentes', nota: 'Notas' };

export default function CentroMando({ atlas, vista, inicial, cerrar }: { atlas: Atlas; vista: string; inicial: string; cerrar: () => void }) {
  const version = useVersionDatos();
  const tema = useTema();
  const [aprende, setAprende] = useState(inicial === ABRIR_APRENDE);
  const [verVersion, setVerVersion] = useState(inicial === ABRIR_ACTUALIZAR);
  const [verAvance, setVerAvance] = useState(false);
  const [consulta, setConsulta] = useState(inicial === ABRIR_APRENDE || inicial === ABRIR_ACTUALIZAR ? '' : inicial);
  const { nueva } = useActualizacion();
  const pasos = usePasosAprende(atlas);
  const [listo, setListo] = useState<typeof indiceCache>(null);
  const [activo, setActivo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const [recientes] = useState<Reciente[]>(leerRecientes);
  const favoritos = useFavoritos();
  const [ia, setIa] = useState<string | null | undefined>(undefined);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [destino, setDestino] = useState<{ modo: string; destino: string | null } | null>(null);
  const [captura, setCaptura] = useState<Captura | null>(null);

  useEffect(() => {
    iaDisponible().then(setIa);
    destinoCaptura().then(setDestino);
  }, []);

  // Voz: el micrófono aparece solo si el navegador sabe reconocer voz.
  const Reconocimiento = reconocimientoDeVoz();
  const [escuchando, setEscuchando] = useState(false);
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null);
  const reco = useRef<ReconocimientoVoz | null>(null);
  useEffect(() => () => reco.current?.abort(), []);

  const escuchar = () => {
    if (!Reconocimiento) return;
    if (escuchando) {
      reco.current?.stop();
      return;
    }
    const r = new Reconocimiento();
    r.lang = navigator.language?.startsWith('es') ? navigator.language : 'es-ES';
    r.interimResults = true;
    r.continuous = false;
    let final = '';
    r.onresult = (e) => {
      const partes = Array.from(e.results);
      final = partes.map((x) => x[0].transcript).join(' ');
      setConsulta(final);
      setActivo(0);
    };
    r.onerror = (e) => {
      setAvisoVoz(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Permite el micrófono en el navegador para usar la voz.'
          : e.error === 'no-speech'
            ? 'No escuché nada. Toca el micrófono e intenta de nuevo.'
            : e.error === 'network'
              ? 'El reconocimiento de voz de este navegador necesita internet.'
              : null,
      );
    };
    r.onend = () => {
      setEscuchando(false);
      const dicho = final.trim();
      if (!dicho) return;
      const orden = interpretarVoz(dicho, atlas);
      if (orden.tipo === 'ir') {
        navegar(orden.hash);
        cerrar();
      } else if (orden.tipo === 'capturar') setConsulta(`+ ${orden.texto}`);
      else if (orden.tipo === 'preguntar' && ia !== undefined) {
        setConsulta(orden.texto);
        preguntar(orden.texto);
      } else setConsulta(orden.texto);
    };
    reco.current = r;
    setAvisoVoz(null);
    setRespuesta(null);
    setCaptura(null);
    setEscuchando(true);
    r.start();
  };

  const guardar = async (texto: string) => {
    setCaptura({ texto, guardando: true });
    try {
      const r = await fetch('/__atlas/capturar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) });
      const d = await r.json();
      if (d.ok) marcarPaso('capturar');
      setCaptura({ texto, guardando: false, ...d });
    } catch {
      setCaptura({ texto, guardando: false, ok: false, error: 'El servidor no responde' });
    }
  };

  const preguntar = async (pregunta: string) => {
    setRespuesta({ pregunta, cargando: true, ia: ia ?? null, texto: null, error: null, fuentes: [] });
    try {
      const r = await fetch('/__atlas/preguntar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pregunta }) });
      const d = await r.json();
      if (d.ok && (d.respuesta || d.fuentes?.length)) marcarPaso('preguntar');
      setRespuesta({ pregunta, cargando: false, ia: d.ia ?? null, texto: d.respuesta ?? null, error: d.ok ? (d.error ?? null) : (d.error ?? 'No se pudo preguntar'), fuentes: d.fuentes ?? [] });
    } catch {
      setRespuesta({ pregunta, cargando: false, ia: null, texto: null, error: 'El servidor no responde', fuentes: [] });
    }
  };

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
        clave: 'accion:exportar',
        grupo: 'Acciones',
        titulo: 'Exportar esta vista como imagen',
        contexto: 'un PNG para compartir o guardar',
        icono: ImageDown,
        ejecutar: () => {
          cerrar();
          // Se espera a que se cierre el centro de mando para que no salga en la imagen.
          setTimeout(() => import('../lib/exportar').then((m) => m.exportarVista(vista)), 250);
        },
      },
      {
        clave: 'accion:avance',
        grupo: 'Acciones',
        titulo: 'Compartir mi avance',
        contexto: 'un resumen para tu mentor, sin el contenido de tus notas',
        icono: Share2,
        ejecutar: () => setVerAvance(true),
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
    [tema, cerrar, vista],
  );

  // Ruta «Aprende»: arriba mientras falten varios pasos; si no, al final, a mano.
  const pendientes = pasos?.filter((p) => !p.hecho) ?? [];
  const filaAprende: Fila = {
    clave: 'aprende',
    grupo: 'Aprende',
    titulo: 'Aprende: tu ruta para empezar',
    contexto: pasos ? (pendientes.length ? `${pasos.length - pendientes.length} de ${pasos.length} pasos · sigue: ${pendientes[0].titulo.toLowerCase()}` : 'ruta completa: repásala cuando quieras') : 'de tu primer vault a tu primer agente',
    icono: GraduationCap,
    color: 'var(--laton)',
    ejecutar: () => setAprende(true),
  };
  const aprendeArriba = pendientes.length >= 3;
  const filaVersion: Fila[] = nueva
    ? [
        {
          clave: 'version',
          grupo: 'Actualización',
          titulo: `Actualizar el atlas a la versión ${nueva.version}`,
          contexto: 'qué trae y cómo instalarla',
          icono: ArrowUpCircle,
          color: 'var(--hud)',
          ejecutar: () => setVerVersion(true),
        },
      ]
    : [];

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
      return aprendeArriba ? [...filaVersion, ...fijos, filaAprende, ...ultimos, ...destinos, ...acciones] : [...filaVersion, ...fijos, ...ultimos, ...destinos, ...acciones, filaAprende];
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
    // Preguntar a la memoria: primero si el texto es una pregunta; si no, al final.
    const esPregunta = ES_PREGUNTA.test(q) || q.includes('?');
    const filaPregunta: Fila[] =
      ia !== undefined && (esPregunta || q.split(/\s+/).length >= 3)
        ? [
            {
              clave: 'preguntar',
              grupo: 'Preguntar a tu memoria',
              titulo: `«${q}»`,
              contexto: ia ? `responde ${ia} solo con tus notas, y las cita${ia.startsWith('Ollama') ? ' (en tu equipo)' : ''}` : 'muestra las notas que lo responden',
              icono: MessageCircleQuestion,
              color: 'var(--laton)',
              ejecutar: () => preguntar(q),
            },
          ]
        : [];
    // Capturar: con «+» al principio va primero; con tres palabras o más, al final.
    const conMas = q.startsWith('+');
    const textoCaptura = conMas ? q.slice(1).trim() : q;
    const filaCaptura: Fila[] =
      destino && textoCaptura.length >= 2 && (conMas || q.split(/\s+/).length >= 3)
        ? [
            {
              clave: 'capturar',
              grupo: 'Capturar',
              titulo: `Guardar «${textoCaptura.length > 70 ? `${textoCaptura.slice(0, 68)}…` : textoCaptura}» como nota nueva`,
              contexto: destino.destino ? `se guarda en ${destino.destino}` : 'se guarda en tu vault',
              icono: NotebookPen,
              color: 'var(--exito)',
              ejecutar: () => guardar(textoCaptura),
            },
          ]
        : [];
    if (conMas) return filaCaptura;
    return esPregunta
      ? [...filaPregunta, ...encontrados, ...destinos.filter(coincide), ...acciones.filter(coincide), ...[filaAprende, ...filaVersion].filter(coincide), ...filaCaptura]
      : [...encontrados, ...destinos.filter(coincide), ...acciones.filter(coincide), ...[filaAprende, ...filaVersion].filter(coincide), ...filaPregunta, ...filaCaptura];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta, listo, recientes, favoritos, destinos, acciones, ia, destino, pasos, nueva]);

  // La fila activa siempre a la vista al moverse con el teclado.
  useEffect(() => {
    lista.current?.querySelector('.resultado.activo')?.scrollIntoView({ block: 'nearest' });
  }, [activo]);

  const tecla = (e: React.KeyboardEvent) => {
    // En la ruta Aprende: Esc vuelve a los resultados.
    if (aprende || verVersion || verAvance) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAprende(false);
        setVerVersion(false);
        setVerAvance(false);
      }
      return;
    }
    // Con una captura a la vista: Esc (o Enter) vuelve a los resultados.
    if (captura) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        setCaptura(null);
        if (captura.ok) setConsulta('');
      }
      return;
    }
    // Con una respuesta a la vista: Esc vuelve a los resultados y Enter pregunta de nuevo.
    if (respuesta) {
      if (e.key === 'Escape') setRespuesta(null);
      else if (e.key === 'Enter' && consulta.trim().length >= 3) preguntar(consulta.trim());
      return;
    }
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
              setAprende(false);
              setVerVersion(false);
              setVerAvance(false);
              setConsulta(e.target.value);
              setActivo(0);
            }}
            onKeyDown={tecla}
            placeholder={escuchando ? 'Te escucho… di «abre Programación» o «busca Stripe»' : 'Busca o pide algo: una nota, una skill, «qué uso para hacer un video»…'}
            aria-label="Buscar o pedir"
            aria-controls="centro-filas"
          />
          {Reconocimiento && (
            <button
              className={`icono-boton microfono ${escuchando ? 'escuchando' : ''}`}
              onClick={escuchar}
              aria-pressed={escuchando}
              aria-label={escuchando ? 'Dejar de escuchar' : 'Hablar'}
              title="Hablar: «abre Programación», «busca Stripe», «pregúntale…», «anota…». El navegador procesa el audio."
            >
              <Mic size={16} />
            </button>
          )}
          <button className="icono-boton" onClick={cerrar} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        {avisoVoz && <p className="aviso-voz">{avisoVoz}</p>}
        {respuesta && !captura && (
          <div className="buscador-resultados respuesta" aria-live="polite">
            <p className="rotulo">Pregunta</p>
            <h3 className="respuesta-pregunta">{respuesta.pregunta}</h3>
            {respuesta.cargando && (
              <p className="respuesta-pensando">
                <span className="respuesta-girando" aria-hidden="true" />
                Buscando en tus notas{respuesta.ia ? ` y preguntando a ${respuesta.ia}` : ''}…
                {respuesta.ia && <span className="mono">{respuesta.ia.startsWith('Ollama') ? ' Responde un modelo en tu equipo: nada sale de él (puede tardar un poco).' : ` Se envían tu pregunta y las notas que la responden a ${respuesta.ia}.`}</span>}
              </p>
            )}
            {respuesta.texto && <Markdown texto={respuesta.texto} className="respuesta-texto" />}
            {!respuesta.cargando && !respuesta.texto && (
              <p className="respuesta-aviso">
                {respuesta.error
                  ? `${/sesión iniciada/.test(respuesta.error) ? respuesta.error : `${respuesta.ia ?? 'La IA'} no pudo responder: ${respuesta.error}`}. `
                  : respuesta.fuentes.length && !respuesta.ia
                    ? 'No hay una IA instalada en este equipo para redactar la respuesta. '
                    : ''}
                {respuesta.fuentes.length ? 'Estas son las notas que hablan de eso:' : 'No encontré notas que hablen de eso.'}
              </p>
            )}
            {respuesta.fuentes.length > 0 && (
              <ol className="respuesta-fuentes">
                {respuesta.fuentes.map((f, i) => (
                  <li key={f.id}>
                    <button
                      onClick={() => {
                        navegar(rutaVault(f.s, f.id));
                        cerrar();
                      }}
                    >
                      <span className="mono">[{i + 1}]</span> {f.t}
                      <span className="resultado-contexto">
                        {f.v}
                        {f.f ? ` / ${f.f}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {!respuesta.cargando && !respuesta.texto && (!respuesta.ia || /sesión iniciada/.test(respuesta.error ?? '')) && (
              <Markdown
                className="respuesta-gratis"
                texto={
                  'Para que te responda **gratis**: instala [Ollama](https://ollama.com) y un modelo (`ollama pull llama3.2`), que corre en tu equipo sin cuenta ni internet; o [Gemini CLI](https://github.com/google-gemini/gemini-cli) e inicia sesión con tu cuenta de Google. El atlas los encuentra solo.'
                }
              />
            )}
          </div>
        )}
        {captura && (
          <div className="buscador-resultados respuesta captura" aria-live="polite">
            <p className="rotulo">Captura</p>
            <p className="captura-texto">{captura.texto}</p>
            {captura.guardando && (
              <p className="respuesta-pensando">
                <span className="respuesta-girando" aria-hidden="true" /> Guardando…
              </p>
            )}
            {captura.ok && (
              <>
                <p className="captura-ok">
                  <Check size={16} /> {captura.duplicada ? 'Ya estaba capturada' : 'Guardada'} en <span className="mono">{captura.vault ? `${captura.vault} / ` : ''}{captura.rel}</span>
                </p>
                <p className="mono captura-nota">Aparece en el atlas en unos segundos.</p>
                <div className="captura-acciones">
                  {captura.obsidian && (
                    <a className="boton-secundario" href={captura.obsidian}>
                      <ExternalLink size={14} /> Abrir en Obsidian
                    </a>
                  )}
                  <button
                    className="boton-texto"
                    onClick={() => {
                      setCaptura(null);
                      setConsulta('');
                      requestAnimationFrame(() => entrada.current?.focus());
                    }}
                  >
                    Capturar otra
                  </button>
                </div>
              </>
            )}
            {captura.ok === false && <p className="respuesta-aviso">No se pudo guardar: {captura.error}</p>}
          </div>
        )}
        {verAvance && !respuesta && !captura && (
          <div className="buscador-resultados respuesta">
            <VistaAvance atlas={atlas} />
          </div>
        )}
        {verVersion && !verAvance && !respuesta && !captura && (
          <div className="buscador-resultados respuesta">
            <VistaActualizacion />
          </div>
        )}
        {aprende && !verVersion && !verAvance && !respuesta && !captura && (
          <div className="buscador-resultados respuesta">
            <VistaAprende
              atlas={atlas}
              cerrar={cerrar}
              setConsulta={(t) => {
                setAprende(false);
                setConsulta(t);
                setActivo(0);
                requestAnimationFrame(() => entrada.current?.focus());
              }}
            />
          </div>
        )}
        <div className="buscador-resultados" ref={lista} id="centro-filas" role="listbox" hidden={Boolean(respuesta || captura || aprende || verVersion || verAvance)}>
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
          {captura || aprende || verVersion || verAvance ? (
            <span>esc volver</span>
          ) : respuesta ? (
            <>
              <span>↵ preguntar de nuevo</span>
              <span>esc volver</span>
            </>
          ) : (
            <>
              <span>↑↓ moverse</span>
              <span>↵ abrir</span>
              <span>esc cerrar</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
