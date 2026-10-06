# Flujo de trabajo con Git

Repositorio: `anndreloopez012/atlas-memoria` (privado; para compartirlo se agregan colaboradores). Ramas permanentes: `main` y `dev`, **siempre con el mismo contenido**.

## Reglas

1. Un cambio = una rama: `feat/<tema>` para algo nuevo, `fix/<tema>` para un arreglo.
2. Commits con el formato `feat(<pantalla>): <explicación>` o `fix(<pantalla>): <explicación>`. La pantalla es la parte afectada: `universo`, `vaults`, `skills`, `agentes`, `sistema`, `datos`, `docs`, `proyecto`.
3. Los commits solo llevan al autor del repositorio (sin líneas de coautoría).
4. Al terminar: `npm run verificar` y `npm run build` deben pasar; subir la rama, fusionarla con `--no-ff` en `dev` y en `main`, y subir ambas. No queda trabajo sin subir.
5. Todo cambio mantiene el proyecto reutilizable: nada fijo de un equipo, compatible con Claude Code, Codex y Antigravity, y la documentación (README, `INSTALAR.md`, `AGENTS.md`, CHANGELOG) al día.

## Paso a paso

Poner al día `dev` y `main`:

```bash
git fetch origin
```

```bash
git checkout dev && git merge --ff-only origin/dev
```

```bash
git checkout main && git merge --ff-only origin/main
```

Crear la rama desde el punto común de ambas:

```bash
git checkout -b feat/mi-cambio "$(git merge-base dev main)"
```

Trabajar, comprobar y hacer commit:

```bash
npm run verificar
```

```bash
npm run build
```

```bash
git add -A && git commit -m "feat(vaults): explicación del cambio"
```

Subir la rama:

```bash
git push -u origin feat/mi-cambio
```

Fusionar en `dev` y en `main` y subir ambas:

```bash
git checkout dev && git merge --no-ff feat/mi-cambio && git push origin dev
```

```bash
git checkout main && git merge --no-ff feat/mi-cambio && git push origin main
```

Comprobar que quedaron iguales (no debe imprimir nada):

```bash
git diff dev main --stat
```

## Notas

- `datos/` y `atlas.config.json` no se versionan (contenido y rutas de cada equipo; se regeneran con `npm run instalar`).
- El sistema de memoria crea un enlace `graphify-out` en cada proyecto de PROYECTOS: está ignorado sin barra final porque es un enlace, no una carpeta.
- En zsh, al usar un SHA en una referencia, escribir `"${sha}:refs/heads/…"` (con llaves), porque `$sha:r` es un modificador de zsh.
