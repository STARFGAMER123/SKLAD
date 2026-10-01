/**
 * SKLAD v3.1 — guard для warehouse-роутов.
 *
 * Все /api/warehouse/* требуют выбранную на сервере БД.
 * Пока база не выбрана — 409 DB_NOT_CONFIGURED (клиент по этому коду
 * показывает экран «База данных не найдена»).
 */

import { NextResponse } from 'next/server';
import { isDatabaseConfigured } from './db-warehouse';

export function ensureDbReady(): NextResponse | null {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: 'База данных на сервере не выбрана',
        code: 'DB_NOT_CONFIGURED',
      },
      { status: 409 },
    );
  }
  return null;
}
