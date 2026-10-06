# Atlas de memoria · Claude Code

Las instrucciones de este repositorio (instalación, comandos y reglas) están en AGENTS.md y se cargan aquí:

@AGENTS.md

## Solo para Claude Code

- Dentro de una sesión de Claude Code no se puede abrir otra con `claude -p` (se bloquea por sesión anidada). Para traducir usa `npm run traducir -- --lotes <carpeta>`, traduce los lotes tú mismo o con subagentes, y luego `npm run traducir -- --importar <carpeta>`.
- La skill `/instalar-atlas` (en `.claude/skills/`) resume la instalación paso a paso.
- Para dejar el atlas abierto usa `bash iniciar.sh` como proceso en segundo plano.
