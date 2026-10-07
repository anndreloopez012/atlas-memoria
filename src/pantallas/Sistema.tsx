// Sistema: cómo trabaja todo y quién lo hace, en pestañas.
// «Cómo trabaja»: de dónde entra el conocimiento, quién lo procesa, dónde queda y
// quién lo consulta. Se adapta a cada equipo: si hay un sistema de memoria
// (.memoria-system) muestra su motor, enrutado y comandos; si no, explica cómo el
// atlas lee los vaults, las skills y los agentes que encontró.
// «Agentes»: los especialistas de IA y las automatizaciones (ver Agentes.tsx).
import { ArrowRight, Terminal } from 'lucide-react';
import { vaultCentral } from '../lib/atlas';
import { cargarAgentes, useDatos } from '../lib/datos';
import { colorIA, intervalo, n } from '../lib/formato';
import { rutaAgente, rutaSistema, rutaVault, type PestanaSistema } from '../lib/rutas';
import { mezclar, tono, useTema } from '../lib/tema';
import type { Atlas, Automatizacion } from '../lib/tipos';
import Agentes from './Agentes';

const ANCHO = 1200;
const ALTO = 540;

interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
  titulo: string;
  texto: string;
  href?: string;
}

const COMANDOS_ATLAS = [
  { comando: 'npm run dev', ayuda: 'Abre el atlas y lo mantiene sincronizado con tus vaults' },
  { comando: 'npm run detectar', ayuda: 'Vuelve a buscar vaults, skills y agentes nuevos' },
  { comando: 'npm run instalar -- --vault "<ruta>"', ayuda: 'Agrega un vault que no se detectó solo' },
  { comando: 'npm run datos', ayuda: 'Regenera los datos ahora' },
  { comando: 'npm run traducir', ayuda: 'Traduce al español los textos nuevos' },
  { comando: 'npm run verificar', ayuda: 'Prueba que todo funcione en este equipo' },
];

// «com.persona.respaldo» → «respaldo»: el prefijo de dominio inverso no aporta.
const nombreCorto = (etiqueta: string) => etiqueta.replace(/^([a-z0-9-]+\.){2}/i, '');

const PESTANAS: { id: PestanaSistema; etiqueta: string; ayuda: string }[] = [
  { id: 'como', etiqueta: 'Cómo trabaja', ayuda: 'El flujo de tu memoria y lo que el atlas encontró en este equipo' },
  { id: 'agentes', etiqueta: 'Agentes', ayuda: 'Especialistas de IA y automatizaciones que trabajan por ti' },
];

export default function Sistema({ atlas, pestana }: { atlas: Atlas; pestana: PestanaSistema }) {
  return (
    <>
      <nav className="subpestanas" aria-label="Secciones de Sistema">
        <div className="conmutador">
          {PESTANAS.map((p) => (
            <a key={p.id} href={rutaSistema(p.id)} className={pestana === p.id ? 'activo' : ''} aria-current={pestana === p.id ? 'page' : undefined} title={p.ayuda}>
              {p.etiqueta}
            </a>
          ))}
        </div>
      </nav>
      {pestana === 'agentes' ? <Agentes atlas={atlas} agente={null} /> : <ComoTrabaja atlas={atlas} />}
    </>
  );
}

function ComoTrabaja({ atlas }: { atlas: Atlas }) {
  const tema = useTema();
  const agentes = useDatos('agentes', cargarAgentes);
  const autos = (agentes.datos?.agentes ?? []).filter((a): a is Automatizacion => a.tipo === 'automatizacion');
  const refresco = autos.find((a) => /refresh|refresco/i.test(a.nombre));
  const respaldo = autos.find((a) => /backup|respaldo/i.test(a.nombre));
  const core = vaultCentral(atlas);
  const hijos = atlas.vaults.filter((v) => v !== core);
  const t = atlas.totales;
  const { memoria, fuentes: detectadas } = atlas.sistema;
  const iasReales = atlas.ias.filter((x) => x !== 'Compartidas' && x !== 'Extra');
  const skillsDeIAs = `Skills de ${iasReales.length === 1 ? iasReales[0] : `${iasReales.length} IAs`}`;

  // Cajas del diagrama: con sistema de memoria se dibuja su flujo; sin él, el del atlas.
  const fuentes: Caja[] = memoria
    ? [
        { x: 30, y: 46, w: 230, h: 76, titulo: 'Tus proyectos', texto: 'repositorios y su bitácora' },
        { x: 30, y: 152, w: 230, h: 76, titulo: 'Memoria de agentes', texto: 'lo que recuerdan tus IAs' },
        { x: 30, y: 258, w: 230, h: 76, titulo: skillsDeIAs, texto: `${n(t.instalaciones)} instalaciones`, href: '#/skills' },
        { x: 30, y: 364, w: 230, h: 76, titulo: 'Capturas', texto: 'lo nuevo entra por la bandeja' },
      ]
    : [
        { x: 30, y: 46, w: 230, h: 76, titulo: 'Vaults de Obsidian', texto: `${n(t.vaults)} vaults · ${n(t.notas)} notas`, href: core ? rutaVault(core.slug) : undefined },
        { x: 30, y: 152, w: 230, h: 76, titulo: skillsDeIAs, texto: `${n(t.skills)} skills · ${n(t.instalaciones)} instalaciones`, href: '#/skills' },
        { x: 30, y: 258, w: 230, h: 76, titulo: 'Agentes', texto: `${n(t.agentes)} subagentes de IA`, href: '#/agentes' },
        { x: 30, y: 364, w: 230, h: 76, titulo: 'Automatizaciones', texto: t.automatizaciones ? `${n(t.automatizaciones)} sobre tus vaults` : 'ninguna detectada', href: '#/agentes' },
      ];
  const motor: Caja = memoria
    ? { x: 320, y: 168, w: 262, h: 156, titulo: 'Motor .memoria-system', texto: refresco ? `refresco ${intervalo(refresco.intervalo)}` : 'scripts en bin/' }
    : { x: 320, y: 168, w: 262, h: 156, titulo: 'Generador del atlas', texto: 'npm run datos · vigía en vivo' };
  const centro = { x: 735, y: 246 };
  const salidas: Caja[] = memoria
    ? [
        { x: 950, y: 46, w: 220, h: 76, titulo: 'Grafo de conocimiento', texto: `${n(t.enlaces)} enlaces · ${n(t.puentes)} puentes` },
        { x: 950, y: 152, w: 220, h: 76, titulo: 'Contexto para IA', texto: 'lo primero que leen los agentes', href: core && atlas.sistema.contexto ? rutaVault(core.slug, atlas.sistema.contexto) : undefined },
        { x: 950, y: 258, w: 220, h: 76, titulo: 'Respaldo', texto: respaldo ? `${intervalo(respaldo.intervalo)} · ${nombreCorto(respaldo.nombre)}` : 'según tu configuración', href: respaldo ? rutaAgente(respaldo.id) : undefined },
        { x: 950, y: 364, w: 220, h: 76, titulo: 'Este atlas', texto: 'lee todo y lo dibuja', href: '#/' },
      ]
    : [
        { x: 950, y: 46, w: 220, h: 76, titulo: 'Universo', texto: 'el mapa de todo', href: '#/' },
        { x: 950, y: 152, w: 220, h: 76, titulo: 'Lector de notas', texto: `${n(t.enlaces)} enlaces navegables`, href: core ? rutaVault(core.slug) : undefined },
        { x: 950, y: 258, w: 220, h: 76, titulo: 'Fichas de skills', texto: 'qué hace cada una', href: '#/skills' },
        { x: 950, y: 364, w: 220, h: 76, titulo: 'Búsqueda', texto: '⌘K en cualquier pantalla' },
      ];

  const curva = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
  const colorCentro = core?.color ?? '#1d24f7';
  const textoCentro = mezclar(colorCentro, '#ffffff', 0.75);

  const cajaSvg = (c: Caja, clase: string) => {
    const contenido = (
      <g className={`caja ${clase}`}>
        <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="12" />
        <text x={c.x + 18} y={c.y + 32} className="caja-titulo">
          {c.titulo}
        </text>
        <text x={c.x + 18} y={c.y + 54} className="caja-texto">
          {c.texto}
        </text>
      </g>
    );
    return c.href ? (
      <a key={c.titulo} href={c.href}>
        {contenido}
      </a>
    ) : (
      <g key={c.titulo}>{contenido}</g>
    );
  };

  const deplugins = detectadas.skills.filter((s) => s.paquete);
  const carpetasSkills = detectadas.skills.filter((s) => !s.paquete);

  return (
    <div className="pagina sistema">
      <header className="pagina-cabecera">
        <p className="rotulo">Mecánica</p>
        <h1 className="display">
          Cómo trabaja <em>tu memoria</em>
        </h1>
        <p className="pagina-bajada">
          {memoria
            ? `El conocimiento entra por tus proyectos, tus conversaciones con agentes y tus capturas; el motor lo clasifica en el vault que le toca, ${core?.nombre ?? 'el centro'} lo resume para las IAs y todo queda respaldado y graficado.`
            : 'El atlas lee tus vaults de Obsidian, las skills de cada IA y tus agentes directamente de este equipo, los relaciona entre sí y los dibuja. No sube nada a internet.'}
        </p>
      </header>

      <figure className="diagrama">
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Flujo: fuentes, procesamiento, vaults y salidas">
          {['Entra', 'Se procesa', 'Vive', 'Sale'].map((e, i) => (
            <text key={e} x={[145, 451, 735, 1060][i]} y={22} className="diagrama-etapa">
              {e}
            </text>
          ))}
          {fuentes.map((f) => (
            <path key={`p-${f.titulo}`} d={curva(f.x + f.w, f.y + f.h / 2, motor.x, motor.y + motor.h / 2)} className="flujo-linea" />
          ))}
          <path d={curva(motor.x + motor.w, motor.y + motor.h / 2, centro.x - 44, centro.y)} className="flujo-linea fuerte" />
          {salidas.map((s) => (
            <path key={`s-${s.titulo}`} d={curva(centro.x + 44, centro.y, s.x, s.y + s.h / 2)} className="flujo-linea" />
          ))}
          {fuentes.map((f) => cajaSvg(f, 'fuente'))}
          {cajaSvg(motor, 'motor')}
          {autos.slice(0, 2).map((a, i) => (
            <a key={a.id} href={rutaAgente(a.id)}>
              <g className="motor-auto">
                <circle cx={motor.x + 26} cy={motor.y + 92 + i * 26} r="5" />
                <text x={motor.x + 40} y={motor.y + 96 + i * 26}>
                  {nombreCorto(a.nombre)} · {a.programacion ? 'cron' : intervalo(a.intervalo)}
                </text>
              </g>
            </a>
          ))}

          {hijos.slice(0, 8).map((v, i) => {
            // Arriba y abajo del centro: los lados quedan libres para las líneas que entran y salen.
            const angulos = [-138, -90, -42, 55, 125, -114, -66, 90];
            const ang = ((angulos[i] ?? 0) * Math.PI) / 180;
            const x = centro.x + Math.cos(ang) * 132;
            const y = centro.y + Math.sin(ang) * 132;
            const r = Math.min(22, 9 + Math.sqrt(v.notas) / 6);
            const arriba = Math.sin(ang) < 0;
            return (
              <a key={v.slug} href={rutaVault(v.slug)}>
                <g className="mini-vault">
                  <line x1={centro.x} y1={centro.y} x2={x} y2={y} stroke={v.color} />
                  <circle cx={x} cy={y} r={r} fill={v.color} />
                  <text x={x} y={arriba ? y - r - 9 : y + r + 18} style={{ fill: tono(v.color, tema) }}>
                    {v.nombre}
                  </text>
                </g>
              </a>
            );
          })}
          <a href={core ? rutaVault(core.slug, core.inicio) : '#/skills'}>
            <g className="mini-core">
              <circle cx={centro.x} cy={centro.y} r="46" fill={colorCentro} />
              <circle cx={centro.x} cy={centro.y} r="58" className="mini-core-anillo" />
              <text x={centro.x} y={centro.y + 7} style={{ fill: textoCentro, fontSize: (core?.nombre.length ?? 5) > 7 ? '15px' : undefined }}>
                {core?.nombre ?? 'Skills'}
              </text>
            </g>
          </a>
          {salidas.map((s) => cajaSvg(s, 'salida'))}
        </svg>
      </figure>

      {memoria && (
        <div className="etapas">
          <section className="etapa">
            <p className="rotulo">01 · Entra</p>
            <h2 className="display">Dónde va cada cosa</h2>
            <p>El motor decide el vault y la sección por palabras clave. Si dudas, {core?.nombre ?? 'el centro'} lo recibe en la Bandeja de Entrada.</p>
            <ul className="enrutado">
              {atlas.sistema.routing.map((r) => {
                const v = atlas.vaults.find((x) => x.nombre === r.vault);
                return (
                  <li key={`${r.vault}${r.seccion}`} style={{ ['--vault' as string]: v?.color ?? 'var(--tinta-3)' }}>
                    <span className="enrutado-destino">
                      <span className="relacion-punto" />
                      {r.vault} <ArrowRight size={11} /> {r.seccion}
                    </span>
                    <span className="enrutado-palabras mono">{r.palabras.slice(0, 8).join(' · ')}</span>
                  </li>
                );
              })}
            </ul>
            {core && atlas.sistema.reglas && (
              <a className="boton-secundario" href={rutaVault(core.slug, atlas.sistema.reglas)}>
                Reglas de clasificación completas
              </a>
            )}
          </section>

          <section className="etapa">
            <p className="rotulo">02 · Se procesa</p>
            <h2 className="display">El motor</h2>
            <p>
              Scripts que generan fichas, contexto para IA, grafos y reportes. Los ejecutan las automatizaciones o tú con el comando <code>memoria</code>.
            </p>
            <ul className="motor-scripts">
              {atlas.sistema.motor.scripts
                .filter((s) => s.resumen)
                .map((s) => (
                  <li key={s.nombre}>
                    <span className="mono">{s.nombre}</span>
                    <span>{s.resumen}</span>
                  </li>
                ))}
            </ul>
            {core && atlas.sistema.multivault && (
              <a className="boton-secundario" href={rutaVault(core.slug, atlas.sistema.multivault)}>
                Runbook del sistema multi-vault
              </a>
            )}
          </section>

          <section className="etapa">
            <p className="rotulo">03 · Se consulta</p>
            <h2 className="display">Comandos</h2>
            <p>Desde la terminal puedes preguntar, registrar y revisar la salud de todo.</p>
            <ul className="comandos">
              {atlas.sistema.motor.comandos.map((c) => (
                <li key={c.comando}>
                  <code>
                    <Terminal size={11} /> {c.comando}
                  </code>
                  <span>{c.ayuda}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <section className="fuentes-detectadas">
        <header>
          <p className="rotulo">{memoria ? '04' : '01'} · Lo que encontró en este equipo</p>
          <h2 className="display">Fuentes del atlas</h2>
          <p>
            {atlas.sistema.configLocal
              ? 'Salen de atlas.config.json, que el instalador armó al detectar este equipo.'
              : 'Salen de la detección automática (todavía no hay atlas.config.json).'}{' '}
            Si falta algo, pídele a tu IA «agrega mi vault de … al atlas» o ejecuta <code>npm run detectar</code>.
          </p>
        </header>
        <div className="fuentes-columnas">
          <div>
            <h3 className="rotulo">Vaults · {detectadas.vaults.length}</h3>
            <ul className="fuentes-lista">
              {detectadas.vaults.map((v) => {
                const vault = atlas.vaults.find((x) => x.nombre === v.nombre);
                return (
                  <li key={v.ruta} style={{ ['--vault' as string]: vault?.color ?? 'var(--tinta-3)' }}>
                    <span className="fuente-nombre">
                      <span className="relacion-punto" />
                      {vault ? <a href={rutaVault(vault.slug)}>{v.nombre}</a> : v.nombre}
                      <span className="mono">{n(v.notas)}</span>
                    </span>
                    <span className="mono ruta">{v.ruta}</span>
                  </li>
                );
              })}
              {!detectadas.vaults.length && <li className="vacio">No se encontraron vaults de Obsidian.</li>}
            </ul>
          </div>
          <div>
            <h3 className="rotulo">Skills · {carpetasSkills.length + deplugins.length} carpetas</h3>
            <ul className="fuentes-lista">
              {carpetasSkills.map((s) => (
                <li key={s.ruta} style={{ ['--vault' as string]: colorIA(s.ia) }}>
                  <span className="fuente-nombre">
                    <span className="relacion-punto" />
                    {s.ia}
                    <span className="mono">{n(s.skills)}</span>
                  </span>
                  <span className="mono ruta">{s.ruta}</span>
                </li>
              ))}
              {deplugins.length > 0 && (
                <li style={{ ['--vault' as string]: 'var(--tinta-3)' }}>
                  <span className="fuente-nombre">
                    <span className="relacion-punto" />
                    Plugins activos
                    <span className="mono">{n(deplugins.reduce((total, s) => total + s.skills, 0))}</span>
                  </span>
                  <span className="mono ruta">{deplugins.map((s) => `${s.paquete} (${s.ia})`).join(' · ')}</span>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="rotulo">Agentes · {detectadas.agentes.length} carpetas</h3>
            <ul className="fuentes-lista">
              {detectadas.agentes.map((a) => (
                <li key={a.ruta} style={{ ['--vault' as string]: colorIA(a.ia) }}>
                  <span className="fuente-nombre">
                    <span className="relacion-punto" />
                    {a.ia} · {a.ambito}
                    <span className="mono">{n(a.agentes)}</span>
                  </span>
                  <span className="mono ruta">{a.ruta}</span>
                </li>
              ))}
              {!detectadas.agentes.length && <li className="vacio">Sin carpetas de agentes.</li>}
            </ul>
            {detectadas.automatizaciones.length > 0 && (
              <>
                <h3 className="rotulo separada">Automatizaciones</h3>
                <p className="mono ruta">{detectadas.automatizaciones.join(' · ')}</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="sincronia">
        <div>
          <p className="rotulo">Este atlas</p>
          <h2 className="display">Siempre sincronizado</h2>
        </div>
        <ul>
          <li>Mientras corre <code>npm run dev</code>, cualquier cambio en un vault regenera el atlas en segundos y la página se actualiza sola.</li>
          <li>
            Lee {n(t.notas)} notas{t.generados > 0 ? ` y omite ${n(t.generados)} notas generadas por herramientas` : ''}.{' '}
            {t.secretosOcultos > 0 && `Ocultó ${n(t.secretosOcultos)} valores con forma de contraseña o token antes de mostrarlos.`}
          </li>
          <li>
            Todo texto descriptivo se muestra en español; solo los nombres de vaults, skills y agentes quedan como están.{' '}
            {t.sinTraducir ? (
              <>
                Hay {n(t.sinTraducir)} textos nuevos esperando traducción: <code>npm run traducir</code>.
              </>
            ) : (
              'No hay textos pendientes de traducir.'
            )}
          </li>
        </ul>
        <ul className="comandos comandos-atlas">
          {COMANDOS_ATLAS.map((c) => (
            <li key={c.comando}>
              <code>
                <Terminal size={11} /> {c.comando}
              </code>
              <span>{c.ayuda}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
