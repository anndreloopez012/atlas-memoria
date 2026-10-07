# Plan 2.0 · más funcional sin más botones

Doce funciones nuevas para que el atlas no solo muestre la memoria, sino que ayude a usarla: recordar qué skill sirve para qué, ver lo pendiente, cuidar la salud de los vaults, preguntar y capturar. Cada función va en su propia rama, se fusiona en `dev` y `main` y se sube al terminar.

## Principios de interfaz

1. **Un solo lugar para hacer cosas: el centro de mando.** El botón «Buscar o pedir» (o `⌘K`) abre un panel donde se busca, se piden skills, se pregunta a la memoria, se captura una idea, se habla por voz, se exporta la vista y se repite el recorrido. La barra superior no gana botones.
2. **Cinco secciones, cada una con un propósito:**
   - **Universo**: explorar el mapa.
   - **Hoy**: lo que importa ahora (novedades, tareas, proyectos, favoritos).
   - **Vaults**: leer.
   - **Skills**: encontrar la herramienta justa.
   - **Sistema**: cómo funciona, los agentes y la salud de la memoria (junta lo que antes eran «Agentes» y «Cómo trabaja»).
3. **Cada acción vive junto a lo que afecta.** La estrella de favoritos está en la nota o en la skill; el camino entre notas, en el vecindario de la nota; el uso de una skill, en su tarjeta.
4. **Nada de botones muertos.** Si algo no aplica en un equipo (no hay IA instalada para preguntar, el navegador no tiene voz, no existe un sistema de memoria), simplemente no aparece.
5. **Reutilizable en cualquier equipo.** Todo sale de la detección y de `atlas.config.json`; nada depende de las rutas ni de los nombres de este Mac.
6. **Privado por diseño.** El uso de skills guarda solo conteos y fechas, nunca el contenido de las conversaciones. Lo que se escribe en los vaults (capturas) lo pide la persona y queda dicho dónde.

## Orden de trabajo

| Rama | Punto | Qué entrega | Datos nuevos |
|---|---|---|---|
| `feat/centro-de-mando` | Paso 0 | Navegación de cinco secciones, Sistema con pestañas (Cómo trabaja · Agentes) y el buscador convertido en centro de mando (recientes y acciones) | — |
| `feat/hoy-novedades` | 6 | Pantalla **Hoy** con «desde tu última visita»: notas nuevas y editadas, skills y agentes nuevos | `recientes.json` |
| `feat/tareas` | 2 | Tareas pendientes de todos los vaults, con fechas y prioridad, en Hoy y en su vista completa | `tareas.json` |
| `feat/proyectos` | 4 | Proyectos con su estado, notas y bitácora; usa el semáforo del sistema de memoria si existe | `proyectos.json` |
| `feat/favoritos-recorrido` | 9 | Estrella en notas y skills, favoritos en Hoy y en el centro de mando, y un recorrido guiado la primera vez | — (en el navegador) |
| `feat/skill-para` | 1 | «¿Qué skill uso para…?»: recomendación por tarea en el centro de mando y en Skills, con el pedido listo para copiar; Skills con menos filtros a la vista | — |
| `feat/uso-skills` | 11 | Cuántas veces usan tus IAs cada skill y cuándo fue la última, sin sacar nada del equipo | `uso` en `skills.json` |
| `feat/salud` | 3 | Pestaña **Salud** en Sistema: enlaces rotos, notas sueltas, títulos repetidos, notas olvidadas y skills con problemas | `salud.json` |
| `feat/camino` | 8 | Cómo se conectan dos notas, aunque estén en vaults distintos | — |
| `feat/preguntar` | 5 | Preguntar a la memoria en lenguaje natural: responde la IA instalada con sus fuentes; sin IA, muestra las notas que responden | endpoint `/__atlas/preguntar` |
| `feat/capturar` | 7 | Capturar una idea desde el centro de mando; se guarda en el vault y la carpeta correctos | endpoint `/__atlas/capturar` |
| `feat/voz` | 10 | Comandos por voz dentro del centro de mando («abre Programación», «busca Stripe») | — |
| `feat/exportar` | 12 | Exportar la vista actual como imagen PNG | — |

## Cómo se trabaja cada rama

1. Rama nueva desde `dev`.
2. Implementación + datos nuevos en `npm run verificar` (prueba en un equipo falso).
3. `npm run build` sin errores y revisión en el navegador (escritorio, teléfono y tema claro).
4. README, `docs/ARQUITECTURA.md`, `docs/DATOS.md` y CHANGELOG al día.
5. Commit con el formato `feat(<pantalla>): <explicación>`, sin atribuciones.
6. Fusión con `--no-ff` en `dev` y en `main`, y subida de las tres ramas.

## Estado

Se marca cada punto al fusionarlo.

- [x] Paso 0 · centro de mando y navegación
- [x] 6 · novedades (Hoy)
- [x] 2 · tareas
- [x] 4 · proyectos
- [x] 9 · favoritos y recorrido
- [x] 1 · ¿qué skill uso para…?
- [x] 11 · uso real de skills
- [x] 3 · salud de la memoria
- [x] 8 · camino entre notas
- [x] 5 · preguntar a la memoria
- [ ] 7 · capturar
- [ ] 10 · voz
- [ ] 12 · exportar
