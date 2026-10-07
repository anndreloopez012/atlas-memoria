// Comandos por voz del centro de mando. El reconocimiento lo hace el navegador
// (Web Speech API: en Chrome el audio pasa por el servicio de Google; en Safari, por
// el de Apple). Aquí solo se interpreta el texto reconocido.
import { rutaSistema, rutaVault } from './rutas';
import type { Atlas } from './tipos';

export type OrdenVoz = { tipo: 'ir'; hash: string; destino: string } | { tipo: 'buscar' | 'preguntar' | 'capturar'; texto: string };

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const SECCIONES: [RegExp, string, string][] = [
  [/^(el )?universo|inicio|mapa$/, '#/', 'Universo'],
  [/^hoy$/, '#/hoy', 'Hoy'],
  [/^(las )?tareas|pendientes$/, '#/hoy/tareas', 'Tareas'],
  [/^(los )?proyectos$/, '#/hoy/proyectos', 'Proyectos'],
  [/^(las )?skills?$/, '#/skills', 'Skills'],
  [/^(el )?sistema|como trabaja$/, rutaSistema('como'), 'Sistema'],
  [/^(los )?agentes$/, rutaSistema('agentes'), 'Agentes'],
  [/^(la )?salud$/, rutaSistema('salud'), 'Salud'],
];

/** Convierte lo que se dijo en una orden: ir a algún lado, buscar, preguntar o capturar. */
export function interpretarVoz(dicho: string, atlas: Atlas): OrdenVoz {
  const texto = dicho.trim();
  const n = normalizar(texto);
  const resto = (re: RegExp) => texto.replace(re, '').trim();

  const ir = n.match(/^(abre|abrir|ir a|ve a|vamos a|llevame a|muestrame|mostrar|muestra)( el| la| los| las)? (.+)$/);
  if (ir) {
    const destino = ir[3].replace(/^vault /, '');
    const vault = atlas.vaults.find((v) => normalizar(v.nombre) === destino || normalizar(v.nombre).startsWith(destino) || v.slug === destino.replace(/ /g, '-'));
    if (vault) return { tipo: 'ir', hash: rutaVault(vault.slug), destino: vault.nombre };
    const seccion = SECCIONES.find(([re]) => re.test(destino));
    if (seccion) return { tipo: 'ir', hash: seccion[1], destino: seccion[2] };
    return { tipo: 'buscar', texto: resto(/^\s*(abre|abrir|ir a|ve a|vamos a|llévame a|llevame a|muéstrame|muestrame|mostrar|muestra)\s+/i) };
  }
  if (/^(busca|buscar|encuentra)\b/.test(n)) return { tipo: 'buscar', texto: resto(/^\s*(busca|buscar|encuentra)\s+/i) };
  if (/^(anota|anotar|captura|capturar|guarda|guardar|apunta|apuntar)\b/.test(n)) return { tipo: 'capturar', texto: resto(/^\s*(anota|anotar|captura|capturar|guarda|guardar|apunta|apuntar)( que)?\s+/i) };
  // «¿Qué skill uso para…?» va a las recomendaciones de skills, no a preguntar.
  if (/^(que|cual|cuales) skills?\b/.test(n)) return { tipo: 'buscar', texto: resto(/^\s*¿?\s*(qu[eé]|cu[aá]les?) skills? (uso |usar |sirve |sirven |me sirve )?(para )?/i).replace(/\?$/, '') };
  if (/^(pregunta|preguntale|preguntar)\b/.test(n)) return { tipo: 'preguntar', texto: resto(/^\s*(pregunta|pregúntale|preguntale|preguntar)\s+/i) };
  if (/^(que|como|cuando|donde|por que|cual|cuales|quien|cuanto|cuantos|cuantas)\b/.test(n) && n.split(' ').length >= 3) return { tipo: 'preguntar', texto };
  return { tipo: 'buscar', texto };
}

/** El reconocimiento de voz del navegador, si existe. */
export function reconocimientoDeVoz(): (new () => ReconocimientoVoz) | null {
  const w = window as unknown as { SpeechRecognition?: new () => ReconocimientoVoz; webkitSpeechRecognition?: new () => ReconocimientoVoz };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface ReconocimientoVoz {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
