import { NextResponse } from 'next/server';
import path from 'path';
import { resolveDataDir } from '@/lib/server-config';
import { createDatabase, getCurrentDbPath } from '@/lib/db-warehouse';

/**
 * POST /api/server/db/create — создать НОВУЮ базу на сервере.
 *
 * Тело: { "name": "Склад №2" } — файл создаётся в папке данных,
 * схема (4 таблицы) инициализируется автоматически.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Укажите имя новой базы' }, { status: 400 });
    }
    if (/[\\/:*?"<>|]/.test(name)) {
      return NextResponse.json({ error: 'Недопустимое имя базы' }, { status: 400 });
    }

    const fileName = name.toLowerCase().endsWith('.db') ? name : `${name}.db`;
    const filePath = path.join(resolveDataDir(), fileName);

    const result = createDatabase(filePath);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, dbPath: getCurrentDbPath() });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Не удалось создать базу';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
