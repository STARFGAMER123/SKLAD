import { NextResponse } from 'next/server';
import os from 'os';
import { isDatabaseConfigured, getCurrentDbPath } from '@/lib/db-warehouse';
import { resolveDataDir } from '@/lib/server-config';

/**
 * GET /api/server/health — проверка доступности сервера SKLAD.
 *
 * Используется клиентом для: коннекта, реконнект-индикатора и
 * определения «БД не выбрана» (dbConfigured: false).
 */

export const dynamic = 'force-dynamic';

const startedAt = Date.now();

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'sklad-server',
    version: '3.1.1',
    dbConfigured: isDatabaseConfigured(),
    dbPath: isDatabaseConfigured() ? getCurrentDbPath() : null,
    dataDir: resolveDataDir(),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    serverTime: new Date().toISOString(),
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
  });
}
