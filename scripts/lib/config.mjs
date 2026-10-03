// Rutas de origen del atlas. Todo se puede cambiar con variables de entorno
// (ver README → "Configuración") sin tocar el código.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = os.homedir();
export const RAIZ = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

const lista = (valor) => (valor ? valor.split(path.delimiter).filter(Boolean) : null);

export const CONFIG = {
  obsidian: process.env.ATLAS_OBSIDIAN || path.join(HOME, 'Documents/OBSIDIAN'),
  salida: process.env.ATLAS_SALIDA || path.join(RAIZ, 'datos'),

  // Cada IA guarda sus skills en una carpeta distinta. Una misma skill puede estar
  // instalada en varias; el atlas las agrupa por nombre.
  fuentesSkills: [
    { ia: 'Claude', dir: path.join(HOME, '.claude/skills') },
    { ia: 'Codex', dir: path.join(HOME, '.codex/skills') },
    { ia: 'Antigravity', dir: path.join(HOME, '.gemini/config/skills') },
    ...(lista(process.env.ATLAS_SKILLS_EXTRA) || []).map((dir) => ({ ia: 'Extra', dir })),
  ],

  fuentesAgentes: [
    { ia: 'Claude', ambito: 'Usuario (~/.claude)', dir: path.join(HOME, '.claude/agents') },
    { ia: 'Claude', ambito: 'Proyecto CLAUDE', dir: path.join(HOME, 'Documents/CLAUDE/.claude/agents') },
    { ia: 'Codex', ambito: 'Usuario (~/.codex)', dir: path.join(HOME, '.codex/agents') },
  ],

  launchAgents: path.join(HOME, 'Library/LaunchAgents'),
  prefijosLaunch: (process.env.ATLAS_LAUNCH_PREFIJOS || 'com.anndre.,com.codex.').split(','),

  // Carpetas de cada vault que no se cargan: estado de Obsidian, índices y los
  // grafos de código que Graphify exporta por proyecto (decenas de miles de notas
  // generadas que ya están resumidas en el resto del vault).
  ignorar: new Set(['.obsidian', '.smart-env', '.trash', '.git', 'node_modules']),
  maxBytesNota: 300_000,
  maxBytesBloque: 450_000,
};
