// Salud de la memoria: chequeos que ayudan a mantener en orden los vaults y las
// skills. Cada uno es una tarjeta: en verde si está bien; si hay algo, con su
// explicación y la lista plegada para revisarlo nota por nota.
import { AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cargarSalud, useDatos } from '../lib/datos';
import { hace, n } from '../lib/formato';
import { rutaSkill, rutaVault } from '../lib/rutas';
import type { Atlas, NotaSalud } from '../lib/tipos';

const VISIBLES = 40;

function Chequeo({ titulo, explicacion, total, children, accion }: { titulo: string; explicacion: string; total: number; children?: ReactNode; accion?: ReactNode }) {
  const bien = total === 0;
  return (
    <article className={`chequeo ${bien ? 'bien' : 'revisar'}`}>
      <header>
        {bien ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
        <h2>{titulo}</h2>
        <span className="mono chequeo-total">{bien ? 'todo bien' : n(total)}</span>
      </header>
      <p>{explicacion}</p>
      {accion}
      {!bien && children && (
        <details>
          <summary>
            <ChevronDown size={14} /> Ver {total > VISIBLES ? `los primeros ${VISIBLES}` : total === 1 ? 'cuál' : `los ${n(total)}`}
          </summary>
          {children}
        </details>
      )}
    </article>
  );
}

function ListaNotas({ notas, total, conDestinos = false }: { notas: NotaSalud[]; total: number; conDestinos?: boolean }) {
  return (
    <ul className="chequeo-lista">
      {notas.slice(0, VISIBLES).map((x) => (
        <li key={x.id}>
          <a href={rutaVault(x.s, x.id)}>{x.t}</a>
          <span className="mono">
            {x.v}
            {x.f ? ` / ${x.f}` : ''} · {hace(x.m)}
          </span>
          {conDestinos && x.destinos && <span className="mono chequeo-destinos">→ {x.destinos.join(' · ')}{x.n && x.n > x.destinos.length ? ` · y ${x.n - x.destinos.length} más` : ''}</span>}
        </li>
      ))}
      {total > VISIBLES && <li className="mono chequeo-mas">y {n(total - VISIBLES)} más</li>}
    </ul>
  );
}

export default function Salud({ atlas }: { atlas: Atlas }) {
  const datos = useDatos('salud', cargarSalud);
  const d = datos.datos;
  const sinTraducir = atlas.totales.sinTraducir ?? 0;
  const pendientes = d ? [d.rotos.total, d.adjuntos.total, d.repetidos.total, d.vacias.total, d.skillsVersiones.total, d.skillsSinDescripcion.total, sinTraducir].filter((x) => x > 0).length : 0;

  return (
    <div className="pagina salud">
      <header className="pagina-cabecera">
        <p className="rotulo">Sistema · salud</p>
        <h1 className="display">
          Salud de tu <em>memoria</em>
        </h1>
        <p className="pagina-bajada">
          {d
            ? `Revisé ${n(d.notasRevisadas)} notas escritas por ti y ${n(atlas.totales.skills)} skills. ${pendientes ? `Hay ${pendientes} ${pendientes === 1 ? 'cosa' : 'cosas'} para revisar.` : 'Todo en orden.'} Las notas que mantienen tus herramientas no se revisan: las cuida cada herramienta.`
            : 'Revisando…'}
        </p>
      </header>

      {datos.error && <p className="vacio">{datos.error}</p>}

      {d && (
        <div className="rejilla-chequeos">
          <Chequeo titulo="Enlaces rotos" explicacion="Enlaces a notas que no existen (o que cambiaron de nombre)." total={d.rotos.total}>
            <ListaNotas notas={d.rotos.items} total={d.rotos.total} conDestinos />
          </Chequeo>
          <Chequeo titulo="Adjuntos que faltan" explicacion="Imágenes o archivos citados en una nota que no están en el vault." total={d.adjuntos.total}>
            <ListaNotas notas={d.adjuntos.items} total={d.adjuntos.total} conDestinos />
          </Chequeo>
          <Chequeo titulo="Títulos repetidos" explicacion="Notas con el mismo título: un enlace por nombre puede llevar a la equivocada." total={d.repetidos.total}>
            <ul className="chequeo-lista">
              {d.repetidos.items.slice(0, VISIBLES).map((g) => (
                <li key={g.t}>
                  <strong>{g.t}</strong>
                  {g.notas.map((x) => (
                    <a key={x.id} href={rutaVault(x.s, x.id)} className="mono">
                      {x.v}
                      {x.f ? ` / ${x.f}` : ''}
                    </a>
                  ))}
                </li>
              ))}
            </ul>
          </Chequeo>
          <Chequeo titulo="Notas vacías" explicacion="Menos de cinco palabras y sin enlaces: quizá quedaron a medio escribir." total={d.vacias.total}>
            <ListaNotas notas={d.vacias.items} total={d.vacias.total} />
          </Chequeo>
          <Chequeo titulo="Notas sueltas" explicacion="Ninguna nota las enlaza y ellas no enlazan a otras. Conectarlas ayuda a encontrarlas." total={d.sueltas.total}>
            <ListaNotas notas={d.sueltas.items} total={d.sueltas.total} />
          </Chequeo>
          <Chequeo titulo="Notas olvidadas" explicacion="Más de un año sin cambios y nadie las cita: revisa si siguen vigentes." total={d.olvidadas.total}>
            <ListaNotas notas={d.olvidadas.items} total={d.olvidadas.total} />
          </Chequeo>
          <Chequeo titulo="Skills con versiones distintas" explicacion="La misma skill está instalada en varias IAs con contenido diferente: alguna quedó desactualizada." total={d.skillsVersiones.total}>
            <ul className="chequeo-lista">
              {d.skillsVersiones.items.map((x) => (
                <li key={x.nombre}>
                  <a href={rutaSkill(x.nombre)} className="mono">
                    {x.nombre}
                  </a>
                  <span className="mono">
                    {x.versiones} versiones en {x.ias.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </Chequeo>
          <Chequeo titulo="Skills sin descripción" explicacion="Sin descripción la IA no sabe cuándo usarlas." total={d.skillsSinDescripcion.total}>
            <ul className="chequeo-lista">
              {d.skillsSinDescripcion.items.map((x) => (
                <li key={x.nombre}>
                  <a href={rutaSkill(x.nombre)} className="mono">
                    {x.nombre}
                  </a>
                </li>
              ))}
            </ul>
          </Chequeo>
          {atlas.sistema.uso?.activo && (
            <Chequeo
              titulo="Skills sin uso"
              explicacion={`Ninguna IA las usó en los últimos ${atlas.sistema.uso.dias} días. No es un error: sirve para decidir cuáles conservar.`}
              total={d.skillsSinUso}
              accion={
                d.skillsSinUso > 0 && (
                  <a className="chequeo-accion mono" href="#/skills?uso=nunca">
                    Verlas en Skills →
                  </a>
                )
              }
            />
          )}
          <Chequeo
            titulo="Textos sin traducir"
            explicacion="Descripciones de skills y agentes que todavía no están en español."
            total={sinTraducir}
            accion={sinTraducir > 0 && <code className="chequeo-accion">npm run traducir</code>}
          />
        </div>
      )}
    </div>
  );
}
