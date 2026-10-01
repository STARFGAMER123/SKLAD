import { NextResponse } from 'next/server';
import fs from 'fs';
import { switchDatabase, getCurrentDbPath } from '@/lib/db-warehouse';

/**
 * POST /api/server/db/select — выбрать существующую базу НА СЕРВЕРЕ.
 *
 * Тело: { "path": "C:\\SKLAD\\data\\warehouse.db" }
 * После выбора путь сохраняется в server-config.json (selectedDb),
 * восстанавливается при рестарте сервера.
 */

export const dynamic = 'force-dynamic';

const DB_EXTENSIONS = new Set(['.db', '.sqlite', '.db3']);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw = typeof body.path === 'string' ? body.path.trim() : '';

    if (!raw) {
      return NextResponse.json({ error: 'Путь к базе не указан' }, { status: 400 });
    }

    const ext = raw.slice(raw.lastIndexOf('.')).toLowerCase();
    if (!DB_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: 'Допустимы только файлы .db / .sqlite / .db3' },
        { status: 400 },
      );
    }
    if (!fs.existsSync(raw) || !fs.statSync(raw).isFile()) {
      return NextResponse.json(
        { error: 'Файл базы данных не найден на сервере' },
        { status: 400 },
      );
    }

    const result = switchDatabase(raw);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, dbPath: getCurrentDbPath() });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Не удалось выбрать базу';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
