import { NextResponse } from 'next/server';
import { switchDatabase, getCurrentDbPath } from '@/lib/db-warehouse';

/**
 * POST /api/server/db/pick — открыть НАТИВНЫЙ диалог выбора файла
 * на серверном ПК (окно Windows у SKLAD_Server в трее).
 *
 * Маршрут через control-сервер Electron (127.0.0.1:<controlPort>/pick-db).
 * Вне SKLAD_Server (dev, голый node) возвращается 501 NO_CONTROL.
 * Диалог может ждать пользователя долго — таймаут 5 минут.
 */

export const dynamic = 'force-dynamic';

export async function POST() {
  const controlPort = Number(process.env.SKLAD_CONTROL_PORT) || 3271;

  try {
    const res = await fetch(`http://127.0.0.1:${controlPort}/pick-db`, {
      method: 'POST',
      signal: AbortSignal.timeout(5 * 60 * 1000), // диалог может ждать долго
    });

    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { error: text || 'Control-сервер вернул ошибку', code: 'NO_CONTROL' },
        { status: 501 },
      );
    }

    if (res.status === 204) {
      return NextResponse.json({ ok: false, canceled: true });
    }

    const data = (await res.json()) as { path?: string; canceled?: boolean };
    if (data.canceled || !data.path) {
      return NextResponse.json({ ok: false, canceled: true });
    }

    const result = switchDatabase(data.path);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, dbPath: getCurrentDbPath() });
  } catch {
    // ECONNREFUSED и любые проблемы связи = control-сервера нет
    return NextResponse.json(
      {
        error: 'Нативный диалог недоступен (запуск вне SKLAD_Server)',
        code: 'NO_CONTROL',
      },
      { status: 501 },
    );
  }
}
