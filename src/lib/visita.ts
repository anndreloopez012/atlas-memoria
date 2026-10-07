// «Desde tu última visita»: el navegador recuerda cuándo usaste el atlas por última
// vez. Una visita termina tras 30 minutos sin usarlo; recargar la página no cuenta
// como visita nueva. Si no se puede guardar (ventana privada), no hay visita previa
// y Hoy muestra los últimos días.

const CLAVE_SESION = 'atlas-sesion';
const CLAVE_PREVIA = 'atlas-visita-previa';
const PAUSA = 30 * 60_000;

function leer<T>(clave: string): T | null {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento */
  }
}

const ahora = Date.now();
const sesion = leer<{ inicio: number; ultima: number }>(CLAVE_SESION);
let previa: number | null;
if (sesion && ahora - sesion.ultima < PAUSA) {
  // Misma visita (p. ej. una recarga): se conserva la anterior.
  previa = leer<number>(CLAVE_PREVIA);
} else {
  previa = sesion?.ultima ?? null;
  guardar(CLAVE_PREVIA, previa);
  guardar(CLAVE_SESION, { inicio: ahora, ultima: ahora });
}

const marcar = () => {
  const actual = leer<{ inicio: number; ultima: number }>(CLAVE_SESION);
  guardar(CLAVE_SESION, { inicio: actual?.inicio ?? ahora, ultima: Date.now() });
};
setInterval(marcar, 60_000);
window.addEventListener('pagehide', marcar);

/** Momento de la visita anterior (ms) o null si es la primera o no se pudo guardar. */
export const visitaAnterior = previa;

/** Desde cuándo contar novedades: la visita anterior, o `dias` atrás si no la hay. */
export function desdeNovedades(dias = 7): number {
  return visitaAnterior ?? Date.now() - dias * 86_400_000;
}
