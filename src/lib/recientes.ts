// Lo último que abriste (notas, skills, agentes), guardado solo en este navegador.
// Lo usa el centro de mando para que volver a algo sea un clic. Si el navegador no
// deja guardar (ventana privada, almacenamiento bloqueado), simplemente no recuerda.

export interface Reciente {
  tipo: 'nota' | 'skill' | 'agente';
  id: string;
  titulo: string;
  contexto: string;
  destino: string;
  color: string;
}

const CLAVE = 'atlas-recientes';
const MAXIMO = 12;

export function leerRecientes(): Reciente[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function registrarReciente(r: Reciente) {
  try {
    const lista = leerRecientes().filter((x) => !(x.tipo === r.tipo && x.id === r.id));
    localStorage.setItem(CLAVE, JSON.stringify([r, ...lista].slice(0, MAXIMO)));
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
}

/** Abre el centro de mando desde cualquier parte, opcionalmente con un texto escrito. */
export function abrirCentro(texto = '') {
  window.dispatchEvent(new CustomEvent('atlas:centro', { detail: texto }));
}
