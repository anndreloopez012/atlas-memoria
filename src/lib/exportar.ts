// Exportar la vista actual como imagen PNG (para compartir o guardar). Se carga solo
// cuando se usa. Toma lo principal de cada pantalla: el Universo completo, el vault
// con su vista actual o la página entera; las tipografías y el grafo van incluidos.
import { avisar } from './avisos';

const ELEMENTO: Record<string, string> = {
  universo: '.cielo',
  vault: '.vault',
};

// La librería copia los estilos de los elementos HTML pero no los de los dibujos SVG
// (rellenos y trazos que vienen de clases CSS): se fijan en cada elemento mientras
// dura la exportación y después se devuelven como estaban.
const PROPIEDADES_SVG = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-anchor',
  'paint-order',
  'visibility',
  'display',
];

function fijarEstilosSvg(raiz: HTMLElement): () => void {
  const previos: [Element, string | null][] = [];
  raiz.querySelectorAll('svg *').forEach((el) => {
    const calculado = getComputedStyle(el);
    const previo = el.getAttribute('style');
    previos.push([el, previo]);
    el.setAttribute('style', `${previo ? `${previo};` : ''}${PROPIEDADES_SVG.map((p) => `${p}:${calculado.getPropertyValue(p)}`).join(';')}`);
  });
  return () => previos.forEach(([el, previo]) => (previo === null ? el.removeAttribute('style') : el.setAttribute('style', previo)));
}

export async function exportarVista(vista: string) {
  const el = (document.querySelector(ELEMENTO[vista] ?? '') ?? document.querySelector('.contenido > *')) as HTMLElement | null;
  if (!el) return avisar('No hay nada que exportar en esta pantalla.');
  avisar('Preparando la imagen…');
  // Sin animaciones mientras se copia: todo sale en su estado final (las de entrada
  // empiezan invisibles y la copia las tomaría en su primer cuadro).
  document.documentElement.classList.add('exportando');
  await new Promise((r) => setTimeout(r, 60));
  const restaurar = fijarEstilosSvg(el);
  try {
    const { toPng } = await import('html-to-image');
    const fondo = getComputedStyle(document.body).backgroundColor || '#08090e';
    // Las páginas muy largas se exportan a menor resolución para no pesar demasiado.
    const escala = el.scrollHeight > 6000 ? 1 : 2;
    const datos = await toPng(el, {
      pixelRatio: escala,
      backgroundColor: fondo,
      cacheBust: true,
      // Sin controles flotantes ni el recorrido.
      filter: (n) => !(n instanceof HTMLElement && n.matches('.tip, .grafo-hover, .recorrido, .buscador-velo')),
    });
    const a = document.createElement('a');
    a.href = datos;
    a.download = `atlas-${vista}-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    avisar('Imagen guardada en tus descargas.');
  } catch (error) {
    avisar(`No se pudo exportar: ${(error as Error).message || error}`);
  } finally {
    restaurar();
    document.documentElement.classList.remove('exportando');
  }
}
