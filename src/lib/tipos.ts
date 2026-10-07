// Forma de los datos que escribe scripts/generar-datos.mjs (ver docs/DATOS.md).

export interface Carpeta {
  /** nombre */
  n: string;
  /** ruta relativa al vault ('' = raíz) */
  p: string;
  /** notas directas */
  d: number;
  /** notas en todo el subárbol */
  t: number;
  /** adjuntos (imágenes, PDF, bases…) */
  a: number;
  h: Carpeta[];
}

/** Referencia a una nota de cualquier vault (para no cargar el vault entero). */
export interface NotaRef {
  id: string;
  /** vault */
  v: string;
  /** título */
  t: string;
}

export interface ResumenVault {
  nombre: string;
  slug: string;
  /** carpeta del vault en este equipo */
  ruta: string;
  color: string;
  icono: string;
  proposito: string;
  incluye: string[];
  noIncluye: string[];
  inicio: string | null;
  entradas: string[];
  notas: number;
  palabras: number;
  adjuntos: number;
  generados: number;
  ultima: string;
  enlaces: number;
  etiquetas: [string, number][];
  carpetas: Carpeta;
  complementos: string[];
}

export interface Puente {
  de: string;
  a: string;
  n: number;
}

export interface FuentesDetectadas {
  vaults: { nombre: string; ruta: string; notas: number }[];
  skills: { ia: string; ruta: string; paquete: string | null; skills: number }[];
  agentes: { ia: string; ambito: string; ruta: string; agentes: number }[];
  automatizaciones: string[];
}

export interface Atlas {
  version: number;
  generado: string;
  /** slug del vault central (del que nacen los demás) */
  centro: string | null;
  /** IAs con skills en este equipo, en orden */
  ias: string[];
  totales: {
    vaults: number;
    notas: number;
    palabras: number;
    enlaces: number;
    sinResolver: number;
    puentes: number;
    generados: number;
    skills: number;
    instalaciones: number;
    agentes: number;
    automatizaciones: number;
    secretosOcultos: number;
    /** textos descriptivos que aún no tienen traducción al español */
    sinTraducir?: number;
  };
  vaults: ResumenVault[];
  puentes: Puente[];
  sistema: {
    plataforma: string;
    /** hay atlas.config.json (si no, se usó la detección automática) */
    configLocal: boolean;
    /** hay un sistema de memoria tipo .memoria-system */
    memoria: boolean;
    fuentes: FuentesDetectadas;
    contexto: string | null;
    reglas: string | null;
    mapaRutas: string | null;
    multivault: string | null;
    salud: string | null;
    routing: { vault: string; seccion: string; palabras: string[] }[];
    motor: { scripts: { nombre: string; resumen: string }[]; comandos: { comando: string; ayuda: string }[] };
    /** lectura del uso de skills: si está activa, cuántos días cubre y si ya se leyó todo */
    uso?: { activo: boolean; dias: number; fuentes: { ia: string; archivos: number }[]; completo: boolean; leidos: number; total: number };
  };
}

export interface Nota {
  id: string;
  /** vault */
  v: string;
  /** ruta relativa */
  r: string;
  /** título */
  t: string;
  /** carpeta */
  f: string;
  /** etiquetas */
  tg: string[];
  fm: Record<string, unknown>;
  /** encabezados */
  h: { n: number; t: string }[];
  /** extracto */
  ex: string;
  /** palabras */
  w: number;
  /** modificada (ISO) */
  m: string;
  /** enlaces salientes en el mismo vault */
  o: string[];
  /** puentes hacia otros vaults */
  x: string[];
  /** puentes que llegan desde otros vaults */
  xb: string[];
  /** bloque de contenido */
  c: string;
}

export interface NotaExterna {
  v: string;
  t: string;
  f: string;
}

export interface DatosVault {
  notas: Nota[];
  externos: Record<string, NotaExterna>;
}

export interface ArchivoSkill {
  r: string;
  b: number;
  k: 'referencias' | 'scripts' | 'recursos' | 'otros';
  t?: string;
}

export interface Skill {
  id: string;
  nombre: string;
  titulo: string;
  /** descripción en español */
  descripcion: string;
  /** descripción tal como está en el SKILL.md (para la búsqueda) */
  descripcionOriginal?: string;
  que: string[];
  cuando: string[];
  noPara: string[];
  activadores: string[];
  categoria: string;
  paquete: string | null;
  origen: 'propia' | 'instalada' | 'sistema' | 'plugin';
  padre: string | null;
  repo: { remoto: string; raiz: string } | null;
  instalaciones: { ia: string; ruta: string; real: string | null }[];
  ias: string[];
  secciones: { n: number; t: string; r: string }[];
  palabras: number;
  archivos: ArchivoSkill[];
  relacionadas: string[];
  extras: Record<string, string>;
  notas: NotaRef[];
  ruta: string;
  archivoDetalle: string;
  agentes: string[];
  /** última modificación y primera instalación (ISO) */
  m?: string | null;
  c?: string | null;
  /** uso real en los historiales locales de las IAs (últimos 180 días), o null */
  uso?: UsoSkill | null;
}

export interface UsoSkill {
  total: number;
  /** último uso (ISO) */
  ultimo: string;
  /** usos por IA */
  ias: Record<string, number>;
}

export interface DatosSkills {
  skills: Skill[];
  paquetes: { nombre: string; descripcion: string; skills: string[] }[];
  categorias: string[];
  ias: string[];
  totalInstalaciones: number;
}

export interface DetalleSkill {
  cuerpo: string;
  /** el manual completo ya está en español */
  traducido?: boolean;
  referencias: Record<string, string>;
}

interface AgenteBase {
  id: string;
  nombre: string;
  ia: string;
  ambito: string;
  descripcion: string;
  ruta: string;
}

export interface AgenteIA extends AgenteBase {
  tipo: 'ia';
  descripcionOriginal?: string;
  que: string[];
  cuando: string[];
  noPara: string[];
  activadores: string[];
  modelo: string;
  herramientas: string[];
  color: string | null;
  skills: string[];
  cuerpo: string;
  notas: NotaRef[];
}

export interface Automatizacion extends AgenteBase {
  tipo: 'automatizacion';
  detalle: string;
  script: string;
  intervalo: number | null;
  /** expresión de cron, si aplica */
  programacion: string | null;
  alIniciar: boolean;
  vigila: string[];
  logs: string[];
  /** comandos para pausar y reactivar */
  pausar: string[];
}

export type Agente = AgenteIA | Automatizacion;

/** Lo que cambió en las últimas semanas (datos/recientes.json). */
export interface Recientes {
  /** días hacia atrás que cubre */
  dias: number;
  /** notas modificadas, de la más reciente a la más antigua; `c` = creada, `g` = la reescribe una herramienta */
  notas: { id: string; v: string; t: string; f: string; m: string; c: string | null; g?: 1 }[];
  skills: { nombre: string; categoria: string; m: string | null; c: string | null }[];
  agentes: { id: string; nombre: string; ia: string; m: string; c: string | null }[];
}

/** Una tarea pendiente de una nota (datos/tareas.json). */
export interface Tarea {
  /** id de la nota */
  id: string;
  /** slug del vault */
  s: string;
  v: string;
  /** título de la nota */
  t: string;
  /** ruta de la nota en el vault */
  r: string;
  f: string;
  /** modificación de la nota */
  m: string;
  /** línea (desde 1) */
  l: number;
  /** texto de la tarea */
  x: string;
  e: 'abierta' | 'en-curso';
  /** fecha (YYYY-MM-DD), si tiene */
  d?: string;
  p?: 'alta' | 'media' | 'baja';
  /** de una nota que reescribe una herramienta */
  g?: 1;
  /** huella de la línea */
  h: string;
}

export interface DatosTareas {
  abiertas: number;
  hechas: number;
  tareas: Tarea[];
}

/** Un proyecto (datos/proyectos.json). */
export interface Proyecto {
  nombre: string;
  /** slug del vault y id de su nota principal */
  s: string;
  id: string;
  familia: string | null;
  rol: string | null;
  estado: string | null;
  /** semáforo del sistema de memoria, si lo hay */
  semaforo?: 'verde' | 'amarillo' | 'rojo' | 'archivado' | null;
  motivos?: string[];
  /** última actividad (bitácora o código), ISO */
  actividad: string | null;
  entradas: { id: string; s: string; t: string; tipo: string | null; fecha: string }[];
  totalEntradas: number;
  /** notas que lo nombran */
  notas: number;
}

export interface DatosProyectos {
  /** hay semáforo de un sistema de memoria */
  semaforo: boolean;
  proyectos: Proyecto[];
}
