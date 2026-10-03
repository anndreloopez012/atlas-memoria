// Cómo trabaja el sistema completo: de dónde entra el conocimiento, quién lo
// procesa, dónde queda y quién lo consulta.
import { ArrowRight, Terminal } from 'lucide-react';
import { cargarAgentes, useDatos } from '../lib/datos';
import { intervalo, n } from '../lib/formato';
import { rutaAgente, rutaVault } from '../lib/rutas';
import { mezclar, tono, useTema } from '../lib/tema';
import type { Atlas, Automatizacion } from '../lib/tipos';

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

export default function Sistema({ atlas }: { atlas: Atlas }) {
  const tema = useTema();
  const agentes = useDatos('agentes', cargarAgentes);
  const autos = (agentes.datos?.agentes ?? []).filter((a): a is Automatizacion => a.tipo === 'automatizacion');
  const refresco = autos.find((a) => /refresh|refresco/i.test(a.nombre));
  const respaldo = autos.find((a) => /backup|respaldo/i.test(a.nombre));
  const core = atlas.vaults.find((v) => v.nombre === 'CORE') ?? atlas.vaults[0];
  const hijos = atlas.vaults.filter((v) => v !== core);
  const t = atlas.totales;

  const fuentes: Caja[] = [
    { x: 30, y: 46, w: 230, h: 76, titulo: 'Tus proyectos', texto: 'repositorios en PROYECTOS', href: rutaVault('programacion') },
    { x: 30, y: 152, w: 230, h: 76, titulo: 'Memoria de agentes', texto: '~/.claude/projects/*/memory' },
    { x: 30, y: 258, w: 230, h: 76, titulo: 'Skills de 3 IAs', texto: `${n(t.instalaciones)} instalaciones`, href: '#/skills' },
    { x: 30, y: 364, w: 230, h: 76, titulo: 'Capturas', texto: 'memoria capturar → Bandeja' },
  ];
  const motor: Caja = { x: 320, y: 168, w: 262, h: 156, titulo: 'Motor .memoria-system', texto: refresco ? `refresco ${intervalo(refresco.intervalo)}` : 'scripts en bin/' };
  const centro = { x: 735, y: 246 };
  const salidas: Caja[] = [
    { x: 950, y: 46, w: 220, h: 76, titulo: 'Grafo Graphify', texto: `${n(t.enlaces)} enlaces · ${n(t.puentes)} puentes` },
    { x: 950, y: 152, w: 220, h: 76, titulo: 'Contexto para IA', texto: 'lo primero que leen los agentes', href: atlas.sistema.contexto ? rutaVault(core.slug, atlas.sistema.contexto) : undefined },
    { x: 950, y: 258, w: 220, h: 76, titulo: 'Respaldo en GitHub', texto: respaldo ? `${intervalo(respaldo.intervalo)} · obsidian-vault` : 'obsidian-vault (privado)', href: respaldo ? rutaAgente(respaldo.id) : undefined },
    { x: 950, y: 364, w: 220, h: 76, titulo: 'Este atlas', texto: 'lee todo y lo dibuja', href: '#/' },
  ];

  const curva = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
  const coreColor = mezclar(core.color, '#ffffff', 0.75);

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

  return (
    <div className="pagina sistema">
      <header className="pagina-cabecera">
        <p className="rotulo">Mecánica</p>
        <h1 className="display">
          Cómo trabaja <em>tu memoria</em>
        </h1>
        <p className="pagina-bajada">
          El conocimiento entra por tus proyectos, tus conversaciones con agentes y tus capturas; el motor lo clasifica en el vault que le toca, CORE lo resume para las IAs y todo queda respaldado y graficado.
        </p>
      </header>

      <figure className="diagrama">
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Flujo: fuentes, motor, vaults y salidas">
          {['Entra', 'Se procesa', 'Vive', 'Sale'].map((e, i) => (
            <text key={e} x={[145, 445, 735, 1060][i]} y={22} className="diagrama-etapa">
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
          {autos.map((a, i) => (
            <a key={a.id} href={rutaAgente(a.id)}>
              <g className="motor-auto">
                <circle cx={motor.x + 26} cy={motor.y + 92 + i * 26} r="5" />
                <text x={motor.x + 40} y={motor.y + 96 + i * 26}>
                  {a.nombre.replace(/^com\.(anndre|codex)\./, '')} · {intervalo(a.intervalo)}
                </text>
              </g>
            </a>
          ))}

          {hijos.map((v, i) => {
            // Arriba y abajo de CORE: los lados quedan libres para las líneas que entran y salen.
            const angulos = [-138, -90, -42, 55, 125];
            const ang = ((angulos[i % angulos.length] ?? 0) * Math.PI) / 180;
            const x = centro.x + Math.cos(ang) * 132;
            const y = centro.y + Math.sin(ang) * 132;
            const r = 9 + Math.sqrt(v.notas) / 6;
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
          <a href={rutaVault(core.slug, core.inicio)}>
            <g className="mini-core">
              <circle cx={centro.x} cy={centro.y} r="46" fill={core.color} />
              <circle cx={centro.x} cy={centro.y} r="58" className="mini-core-anillo" />
              <text x={centro.x} y={centro.y + 7} style={{ fill: coreColor }}>
                CORE
              </text>
            </g>
          </a>
          {salidas.map((s) => cajaSvg(s, 'salida'))}
        </svg>
      </figure>

      <div className="etapas">
        <section className="etapa">
          <p className="rotulo">01 · Entra</p>
          <h2 className="display">Dónde va cada cosa</h2>
          <p>El motor decide el vault y la sección por palabras clave. Si dudas, CORE lo recibe en la Bandeja de Entrada.</p>
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
          {atlas.sistema.reglas && (
            <a className="boton-secundario" href={rutaVault(core.slug, atlas.sistema.reglas)}>
              Reglas de clasificación completas
            </a>
          )}
        </section>

        <section className="etapa">
          <p className="rotulo">02 · Se procesa</p>
          <h2 className="display">El motor</h2>
          <p>Scripts en Python que generan fichas, contexto para IA, grafos y reportes. Los ejecutan las automatizaciones o tú con el comando <code>memoria</code>.</p>
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
          {atlas.sistema.multivault && (
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

      <section className="sincronia">
        <div>
          <p className="rotulo">Este atlas</p>
          <h2 className="display">Siempre sincronizado</h2>
        </div>
        <ul>
          <li>Mientras corre <code>npm run dev</code>, cualquier cambio en un vault regenera el atlas en segundos y la página se actualiza sola.</li>
          <li>El botón de la barra superior vuelve a leer todo bajo pedido; desde la terminal, <code>npm run datos</code>.</li>
          <li>
            Lee {n(t.notas)} notas y omite {n(t.generados)} notas generadas por Graphify. {t.secretosOcultos > 0 && `Ocultó ${t.secretosOcultos} valores con forma de contraseña o token antes de mostrarlos.`}
          </li>
        </ul>
      </section>
    </div>
  );
}
