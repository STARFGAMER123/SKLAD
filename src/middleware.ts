import { NextRequest, NextResponse } from 'next/server';

/**
 * SKLAD v3.1 — CORS для /api/*.
 *
 * Толстый клиент (Electron, origin app://ui), мобильные клиенты (Android)
 * и страницы, открытые с другого адреса, обращаются к серверу кросс-доменно.
 * Браузер при открытии UI прямо с сервера работает same-origin — заголовки
 * ему не мешают.
 *
 * ⚠️ Не работает в клиентской сборке (output: "export") — build-client.bat
 * временно переименовывает этот файл перед next build.
 */

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function middleware(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }
  const res = NextResponse.next();
  const headers = corsHeaders();
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  return res;
}

export const config = {
  matcher: '/api/:path*',
};
