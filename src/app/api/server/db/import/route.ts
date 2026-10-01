import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { resolveDataDir } from '@/lib/server-config';
import { switchDatabase, getCurrentDbPath } from '@/lib/db-warehouse';

/**
 * POST /api/server/db/import — импорт файла базы С КЛИЕНТСКОГО ПК на сервер.
 *
 * multipart/form-data, поле "file" (.db / .sqlite / .db3, до 1 ГБ).
 * Файл сохраняется в <dataDir>/uploads/ и сразу становится текущей БД.
 */

export const dynamic = 'force-dynamic';

const MAX_SIZE = 1024 * 1024 * 1024; // 1 ГБ
const DB_EXTENSIONS = new Set(['.db', '.sqlite', '.db3']);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не передан (поле "file")' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!DB_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: 'Допустимы только файлы .db / .sqlite / .db3' },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Файл больше 1 ГБ' }, { status: 400 });
    }

    const uploadsDir = path.join(resolveDataDir(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const safeName = path.basename(file.name).replace(/[^\w\-. ]/g, '_');
    let target = path.join(uploadsDir, safeName);
    if (fs.existsSync(target)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      target = path.join(uploadsDir, `${stamp}_${safeName}`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(target, buffer);

    const result = switchDatabase(target);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, path: getCurrentDbPath(), size: file.size });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Не удалось импортировать базу';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
