// Avisos breves en una esquina (p. ej. «Imagen guardada»). Cualquier parte de la
// página puede avisar; el componente Avisos los muestra y los quita solos.
export function avisar(texto: string) {
  window.dispatchEvent(new CustomEvent('atlas:aviso', { detail: texto }));
}
