// Salud de la memoria: chequeos que ayudan a mantener los vaults y las skills en
// orden. Las notas que reescribe una herramienta no se revisan (las mantiene ella).
const MAX = 300;

// Títulos genéricos a propósito (segmentos numerados, índices, «Léeme»…): no cuentan como repetidos.
const GENERICO = /^(\d+( .*)?|(parte|part|seccion|section|capitulo|chapter|segmento|anexo|paso|step|dia|day) \d+|readme|leeme|index|indice|inicio|home|notas?|resumen|summary|todo|pendientes|sin titulo|untitled( \d+)?)$/;

const normalizar = (t) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * @param {Array} todas notas de todos los vaults
 * @param {Array} skills skills ya armadas (con `versiones`, `descripcion`, `uso`)
 * @param {(nombre: string) => string} slug
 * @param {(nota: object) => boolean} esGenerada
 */
export function revisarSalud(todas, skills, slug, esGenerada) {
  const propias = todas.filter((n) => !esGenerada(n));
  const ref = (n, extra = {}) => ({ id: n.id, s: slug(n.v), v: n.v, t: n.t, f: n.f, m: n.m, ...extra });

  // Quién cita a quién (dentro del vault y entre vaults).
  const entrantes = new Map();
  for (const n of todas) for (const d of [...n.o, ...n.x]) entrantes.set(d, (entrantes.get(d) || 0) + 1);

  const rotos = propias.filter((n) => n._rotos?.length).sort((a, b) => b._rotos.length - a._rotos.length);
  const adjuntos = propias.filter((n) => n._adjuntosFaltan?.length).sort((a, b) => b._adjuntosFaltan.length - a._adjuntosFaltan.length);
  const sueltas = propias.filter((n) => !n.o.length && !n.x.length && !entrantes.get(n.id)).sort((a, b) => b.m.localeCompare(a.m));
  const vacias = propias.filter((n) => n.w < 5 && !n.o.length && !n.x.length).sort((a, b) => a.t.localeCompare(b.t, 'es'));
  const haceUnAno = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const olvidadas = propias.filter((n) => n.m < haceUnAno && !entrantes.get(n.id)).sort((a, b) => a.m.localeCompare(b.m));

  // Títulos repetidos (sin importar mayúsculas ni acentos), en cualquier vault.
  const porTitulo = new Map();
  for (const n of propias) {
    const clave = normalizar(n.t);
    if (clave.length < 3 || GENERICO.test(clave)) continue;
    if (!porTitulo.has(clave)) porTitulo.set(clave, []);
    porTitulo.get(clave).push(n);
  }
  const repetidos = [...porTitulo.values()].filter((l) => l.length > 1).sort((a, b) => b.length - a.length);

  const cortar = (lista, mapa) => ({ total: lista.length, items: lista.slice(0, MAX).map(mapa) });
  return {
    notasRevisadas: propias.length,
    rotos: cortar(rotos, (n) => ref(n, { destinos: n._rotos.slice(0, 6), n: n._rotos.length })),
    adjuntos: cortar(adjuntos, (n) => ref(n, { destinos: n._adjuntosFaltan.slice(0, 6), n: n._adjuntosFaltan.length })),
    sueltas: cortar(sueltas, (n) => ref(n)),
    vacias: cortar(vacias, (n) => ref(n)),
    olvidadas: cortar(olvidadas, (n) => ref(n)),
    repetidos: cortar(repetidos, (l) => ({ t: l[0].t, notas: l.slice(0, 8).map((n) => ref(n)) })),
    skillsVersiones: cortar(
      skills.filter((s) => s.versiones > 1),
      (s) => ({ nombre: s.nombre, versiones: s.versiones, ias: s.ias }),
    ),
    skillsSinDescripcion: cortar(
      skills.filter((s) => !s.descripcion?.trim()),
      (s) => ({ nombre: s.nombre, ias: s.ias }),
    ),
    skillsSinUso: skills.filter((s) => s.uso === null).length,
  };
}
