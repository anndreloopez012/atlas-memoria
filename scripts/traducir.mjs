#!/usr/bin/env node
// Completa las traducciones al español que el generador dejó pendientes.
//
//   npm run traducir                      traduce lo pendiente con Claude Code (`claude -p`)
//   npm run traducir -- --importar <dir>  incorpora archivos resultado-*.json ({ clave: traducción })
//   npm run traducir -- --lotes <dir>     solo parte lo pendiente en lote-NN.json (para traducir aparte)
//
// Las traducciones quedan en traducciones/es.json (versionado) y al final se
// regeneran los datos. `claude -p` no puede correr dentro de otra sesión de
// Claude Code: ejecútalo desde una terminal normal.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONFIG, RAIZ } from './lib/config.mjs';
import { ARCHIVO_TRADUCCIONES } from './lib/traduccion.mjs';

const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] ?? true : null;
};
const ARCHIVO_PENDIENTES = path.join(CONFIG.salida, 'pendientes-traduccion.json');
const TAMANO_LOTE = Number(opcion('--tamano')) || 14_000;
const PARALELO = Number(opcion('--paralelo')) || 3;
const MODELO = opcion('--modelo') || 'sonnet';

const INSTRUCCIONES = `Eres traductor técnico inglés → español.
Recibes un objeto JSON { "<clave>": { "tipo", "texto" } } y respondes SOLO con un objeto JSON { "<clave>": "<traducción>" } con las mismas claves.
- Español neutro latinoamericano, profesional y natural, con tuteo.
- No traduzcas nombres de skills, agentes, vaults, productos, marcas, librerías, herramientas, comandos, código entre comillas invertidas, rutas, archivos, URLs, flags ni variables.
- tipo "titulo": título corto con mayúscula solo al inicio. tipo "activador": frase natural que diría un usuario. tipo "documento": markdown; traduce solo la prosa y deja intactos encabezados, listas, tablas, bloques de código y enlaces.
- Si ya está en español, devuélvelo igual.`;

function leerJSON(archivo, porDefecto) {
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf8'));
  } catch {
    return porDefecto;
  }
}

function guardarTraducciones(nuevas) {
  const actuales = leerJSON(ARCHIVO_TRADUCCIONES, {});
  let agregadas = 0;
  // El directorio personal se guarda como ~: el diccionario se sube a git.
  const home = os.homedir();
  for (const [clave, original] of Object.entries(nuevas)) {
    if (typeof original !== 'string' || !original.trim()) continue;
    const valor = original.split(home).join('~');
    if (actuales[clave] !== valor) agregadas += 1;
    actuales[clave] = valor;
  }
  // Claves ordenadas: los cambios en git quedan legibles.
  const ordenadas = Object.fromEntries(Object.entries(actuales).sort(([a], [b]) => a.localeCompare(b)));
  fs.mkdirSync(path.dirname(ARCHIVO_TRADUCCIONES), { recursive: true });
  fs.writeFileSync(ARCHIVO_TRADUCCIONES, `${JSON.stringify(ordenadas, null, 1)}\n`);
  return agregadas;
}

function regenerar() {
  execFileSync(process.execPath, [path.join(RAIZ, 'scripts/generar-datos.mjs')], { stdio: 'inherit', cwd: RAIZ });
}

function partirEnLotes(pendientes) {
  const lotes = [];
  let actual = [];
  let tamano = 0;
  for (const p of pendientes) {
    if (actual.length && tamano + p.texto.length > TAMANO_LOTE) {
      lotes.push(actual);
      actual = [];
      tamano = 0;
    }
    actual.push(p);
    tamano += p.texto.length;
  }
  if (actual.length) lotes.push(actual);
  return lotes;
}

function extraerJSON(texto) {
  const limpio = texto.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '');
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

function traducirLote(lote) {
  const entrada = Object.fromEntries(lote.map((p) => [p.clave, { tipo: p.tipo, texto: p.texto }]));
  return new Promise((resolve, reject) => {
    const proceso = spawn(
      'claude',
      ['-p', '--model', MODELO, '--output-format', 'json', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--system-prompt', INSTRUCCIONES],
      { cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let salida = '';
    let errores = '';
    proceso.stdout.on('data', (d) => (salida += d));
    proceso.stderr.on('data', (d) => (errores += d));
    proceso.on('error', reject);
    proceso.on('close', (codigo) => {
      if (codigo !== 0) return reject(new Error(errores.trim() || `claude terminó con código ${codigo}`));
      try {
        const respuesta = JSON.parse(salida);
        const traducciones = extraerJSON(respuesta.result || '');
        const faltan = lote.filter((p) => typeof traducciones[p.clave] !== 'string');
        if (faltan.length) console.warn(`  ${faltan.length} claves sin respuesta en este lote (quedan pendientes)`);
        resolve(traducciones);
      } catch (error) {
        reject(new Error(`respuesta ilegible: ${error.message}`));
      }
    });
    proceso.stdin.end(JSON.stringify(entrada));
  });
}

async function main() {
  const importar = opcion('--importar');
  if (importar) {
    const carpeta = path.resolve(String(importar));
    const archivos = fs.readdirSync(carpeta).filter((f) => /^resultado-.*\.json$/.test(f));
    let total = 0;
    for (const f of archivos) total += guardarTraducciones(leerJSON(path.join(carpeta, f), {}));
    console.log(`Importadas ${total} traducciones de ${archivos.length} archivos.`);
    regenerar();
    return;
  }

  if (!fs.existsSync(ARCHIVO_PENDIENTES)) regenerar();
  const pendientes = leerJSON(ARCHIVO_PENDIENTES, []);
  if (!pendientes.length) {
    console.log('No hay nada pendiente: todo el texto descriptivo ya está en español.');
    return;
  }
  const lotes = partirEnLotes(pendientes);

  const destinoLotes = opcion('--lotes');
  if (destinoLotes) {
    const carpeta = path.resolve(String(destinoLotes));
    fs.mkdirSync(carpeta, { recursive: true });
    lotes.forEach((l, i) => fs.writeFileSync(path.join(carpeta, `lote-${String(i + 1).padStart(2, '0')}.json`), JSON.stringify(l, null, 1)));
    console.log(`${pendientes.length} textos en ${lotes.length} lotes → ${carpeta}`);
    return;
  }

  if (process.env.CLAUDECODE) {
    console.error('Estás dentro de una sesión de Claude Code y `claude -p` no puede abrirse aquí.\nEjecuta `npm run traducir` desde una terminal normal, o usa --lotes / --importar.');
    process.exit(1);
  }

  console.log(`Traduciendo ${pendientes.length} textos en ${lotes.length} lotes (modelo ${MODELO}, ${PARALELO} a la vez)…`);
  let siguiente = 0;
  let hechos = 0;
  const trabajador = async () => {
    while (siguiente < lotes.length) {
      const i = siguiente++;
      try {
        const traducciones = await traducirLote(lotes[i]);
        guardarTraducciones(traducciones);
        hechos += 1;
        console.log(`  lote ${i + 1}/${lotes.length} listo`);
      } catch (error) {
        console.warn(`  lote ${i + 1} falló: ${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALELO, lotes.length) }, trabajador));
  console.log(`${hechos} de ${lotes.length} lotes traducidos.`);
  regenerar();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
