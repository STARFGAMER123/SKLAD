import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resolveDataDir, readServerConfig } from '@/lib/server-config';
import { getCurrentDbPath, isDatabaseConfigured } from '@/lib/db-warehouse';

/**
 * GET /api/server/db/list — список файлов баз данных НА СЕРВЕРЕ.
 *
 * Сканирует папку данных (глубина 3) на *.db / *.sqlite / *.db3,
 * добавляет недавние (recentDbs) и текущую выбранную базу.
 */

export const dynamic = 'force-dynamic';

const DB_EXTENSIONS = new Set(['.db', '.sqlite', '.db3']);
const MAX_DEPTH = 3;

interface DbFile {
  path: string;
  name: string;
  size: number;
  mtime: number;
  selected?: boolean;
}

function walk(dir: string, depth: number, found: Map<string, DbFile>): void {
  if (depth > MAX_DEPTH || found.size > 200) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'backups', 'exports', 'uploads', 'build', 'release', 'dist'].includes(entry.name)) continue;
      walk(full, depth + 1, found);
    } else if (entry.isFile() && DB_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      try {
        const stat = fs.statSync(full);
        found.set(full, {
          path: full,
          name: path.basename(full),
          size: stat.size,
          mtime: stat.mtimeMs,
        });
      } catch {
        // ignore
      }
    }
  }
}

export async function GET() {
  try {
    const found = new Map<string, DbFile>();
    walk(resolveDataDir(), 0, found);

    // недавние базы из конфига (могут лежать вне папки данных)
    for (const p of readServerConfig().recentDbs) {
      if (found.has(p)) continue;
      try {
        const stat = fs.statSync(p);
        if (stat.isFile()) {
          found.set(p, { path: p, name: path.basename(p), size: stat.size, mtime: stat.mtimeMs });
        }
      } catch {
        // ignore
      }
    }

    // текущая выбранная база — всегда в списке
    const selected = isDatabaseConfigured() ? getCurrentDbPath() : null;
    if (selected && !found.has(selected)) {
      try {
        const stat = fs.statSync(selected);
        found.set(selected, { path: selected, name: path.basename(selected), size: stat.size, mtime: stat.mtimeMs });
      } catch {
        // ignore
      }
    }

    const list = Array.from(found.values())
      .map((f) => ({ ...f, selected: f.path === selected }))
      .sort((a, b) => (b.selected ? 1 : 0) - (a.selected ? 1 : 0) || b.mtime - a.mtime);

    return NextResponse.json({ ok: true, databases: list });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Не удалось получить список баз';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
