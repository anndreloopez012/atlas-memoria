import { carpetaDeLaApp } from '../lib/datos';
import Markdown from './Markdown';

const SISTEMA = /Windows/i.test(navigator.userAgent) ? 'windows' : /Mac/i.test(navigator.userAgent) ? 'mac' : 'linux';

/** Cómo quitar el atlas, dentro del centro de mando (no se desinstala desde la página). */
export function VistaDesinstalar() {
  const carpeta = carpetaDeLaApp();
  const como = {
    mac: 'Cierra esta pestaña y haz doble clic en **Desinstalar en Mac.command**, que está en la carpeta de la app (o en la descarga).',
    windows: 'Cierra esta pestaña y abre **Desinstalar Atlas de memoria** en el menú Inicio (o haz doble clic en **Desinstalar en Windows.cmd**, en la carpeta de la app).',
    linux: 'Cierra esta pestaña y haz clic derecho en el ícono de «Atlas de memoria» › **Desinstalar** (o ejecuta **Desinstalar en Linux.sh**, en la carpeta de la app).',
  }[SISTEMA];
  return (
    <div className="actualizacion">
      <p className="rotulo">Desinstalar el atlas</p>
      <Markdown
        className="actualizacion-notas"
        texto={`${como}\n\nAntes de borrar nada te muestra qué va a quitar y te pide confirmar. Se van la app y sus accesos de doble clic; **tus vaults y tus notas no se tocan** (tampoco «Mi memoria»).${carpeta ? `\n\nCarpeta de la app: \`${carpeta}\`` : ''}\n\nDesde la terminal: \`npm run desinstalar\`.`}
      />
    </div>
  );
}
