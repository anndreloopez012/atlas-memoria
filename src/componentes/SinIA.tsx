import { ExternalLink } from 'lucide-react';

const IAS = [
  { nombre: 'Claude Code', url: 'https://claude.com/claude-code', nota: 'de Anthropic' },
  { nombre: 'Codex', url: 'https://developers.openai.com/codex', nota: 'de OpenAI' },
  { nombre: 'Antigravity', url: 'https://antigravity.google', nota: 'de Google' },
];

/**
 * Pantalla de Skills o de Agentes cuando este equipo todavía no tiene ninguno:
 * explica de dónde salen y qué instalar, en vez de una lista vacía.
 */
export default function SinIA({ que }: { que: 'skills' | 'agentes' }) {
  return (
    <section className="sin-ia">
      <p className="rotulo">Todavía no hay {que}</p>
      <p>
        {que === 'skills'
          ? 'Las skills llegan con tu IA de programación: cada una trae las suyas y puedes crear las tuyas. Instala una y el atlas las encontrará sola la próxima vez que lo abras.'
          : 'Los agentes viven en las carpetas de tu IA de programación. Instala una y el atlas los encontrará solos; también puedes crear los tuyos.'}
      </p>
      <ul>
        {IAS.map((ia) => (
          <li key={ia.nombre}>
            <a href={ia.url} target="_blank" rel="noreferrer">
              {ia.nombre} <ExternalLink size={12} />
            </a>
            <span>{ia.nota}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
