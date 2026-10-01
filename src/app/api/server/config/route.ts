import { NextResponse } from 'next/server';
import { readServerConfig, writeServerConfig, getConfigPath, type ServerConfig } from '@/lib/server-config';

/**
 * GET  /api/server/config — текущий конфиг сервера.
 * POST /api/server/config — изменить настройки.
 *
 * Тело POST: { port?, bind?, dataDir?, autostart? }.
 * При смене port/bind: restartRequired: true — SKLAD_Server перезапускает
 * Next-процесс автоматически.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    config: readServerConfig(),
    configPath: getConfigPath(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const current = readServerConfig();
    const next: ServerConfig = { ...current };

    if (body.port !== undefined) {
      const port = Number(body.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return NextResponse.json({ error: 'Порт должен быть числом 1–65535' }, { status: 400 });
      }
      next.port = port;
    }
    if (body.bind !== undefined) {
      if (typeof body.bind !== 'string' || !body.bind.trim()) {
        return NextResponse.json({ error: 'Некорректный адрес (bind)' }, { status: 400 });
      }
      next.bind = body.bind.trim();
    }
    if (body.dataDir !== undefined) {
      next.dataDir = typeof body.dataDir === 'string' ? body.dataDir.trim() : '';
    }
    if (body.autostart !== undefined) {
      next.autostart = Boolean(body.autostart);
    }

    const restartRequired = next.port !== current.port || next.bind !== current.bind;
    writeServerConfig(next);

    return NextResponse.json({ ok: true, config: next, restartRequired });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Не удалось сохранить конфигурацию';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
