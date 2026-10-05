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

export interface ResumenVault {
  nombre: string;
  slug: string;
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

export interface Atlas {
  version: number;
  generado: string;
  origen: string;
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
    contexto: string | null;
    reglas: string | null;
    mapaRutas: string | null;
    multivault: string | null;
    salud: string | null;
    routing: { vault: string; seccion: string; palabras: string[] }[];
    motor: { scripts: { nombre: string; resumen: string }[]; comandos: { comando: string; ayuda: string }[] };
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
  origen: 'propia' | 'instalada' | 'sistema';
  padre: string | null;
  repo: { remoto: string; raiz: string } | null;
  instalaciones: { ia: string; ruta: string; real: string | null }[];
  ias: string[];
  secciones: { n: number; t: string; r: string }[];
  palabras: number;
  archivos: ArchivoSkill[];
  relacionadas: string[];
  extras: Record<string, string>;
  notas: string[];
  ruta: string;
  archivoDetalle: string;
  agentes: string[];
}

export interface DatosSkills {
  skills: Skill[];
  paquetes: { nombre: string; descripcion: string; skills: string[] }[];
  categorias: string[];
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
  notas: string[];
}

export interface Automatizacion extends AgenteBase {
  tipo: 'automatizacion';
  detalle: string;
  script: string;
  intervalo: number | null;
  alIniciar: boolean;
  vigila: string[];
  logs: string[];
}

export type Agente = AgenteIA | Automatizacion;
