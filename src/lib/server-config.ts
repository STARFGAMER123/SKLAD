/**
 * SKLAD v3.1 — конфиг сервера (server-config.json).
 *
 * Файл лежит РЯДОМ С EXE (PORTABLE_EXECUTABLE_DIR) — переносимая сборка.
 * Приоритет папки: SKLAD_CONFIG_DIR (выставляет server-main.js)
 * → PORTABLE_EXECUTABLE_DIR → process.cwd() (dev).
 */

import fs from 'fs';
import path from 'path';

export interface ServerConfig {
  port: number;
  bind: string;
  controlPort: number;
  dataDir: string;
  autostart: boolean;
  selectedDb: string | null;
  recentDbs: string[];
}

export const DEFAULT_CONFIG: ServerConfig = {
  port: 3270,
  bind: '0.0.0.0',
  controlPort: 3271,
  dataDir: '',
  autostart: false,
  selectedDb: null,
  recentDbs: [],
};

export function getConfigDir(): string {
  if (process.env.SKLAD_CONFIG_DIR) return process.env.SKLAD_CONFIG_DIR;
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  return process.cwd();
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), 'server-config.json');
}

export function readServerConfig(): ServerConfig {
  const defaults = { ...DEFAULT_CONFIG, recentDbs: [] as string[] };
  try {
    const raw = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
    return { ...defaults, ...raw };
  } catch {
    return defaults;
  }
}

export function writeServerConfig(cfg: ServerConfig): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf8');
}

export function updateServerConfig(patch: Partial<ServerConfig>): ServerConfig {
  const cfg = { ...readServerConfig(), ...patch };
  writeServerConfig(cfg);
  return cfg;
}

/** Папка данных: dataDir из конфига → SKLAD_DATA_DIR → <configDir>/data. */
export function resolveDataDir(): string {
  const cfg = readServerConfig();
  const dir =
    (cfg.dataDir && cfg.dataDir.trim()) ||
    process.env.SKLAD_DATA_DIR ||
    path.join(getConfigDir(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
