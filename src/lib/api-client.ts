/**
 * SKLAD v3.1 — клиентский API-слой (runtime baseUrl).
 *
 * Клиент (браузер, SKLAD_Client.exe, будущий Android) работает с сервером
 * по http://<IP>:<порт>. Адрес подключения хранится:
 *   1) в мосте window.skladDesktop (SKLAD_Client.exe → %APPDATA%\SkladClient\config.json)
 *   2) в localStorage браузера
 *   3) по умолчанию: same-origin (страница открыта самим сервером) либо 127.0.0.1:3270
 *
 * apiUrl() — СИНХРОННЫЙ: ConnectionGate инициализирует базу до рендера
 * рабочей области, поэтому все fetch могут строить URL без ожидания.
 */

export interface Connection {
  host: string;
  port: number;
  sameOrigin?: boolean;
}

export const DEFAULT_PORT = 3270;

interface ResolvedConnection extends Connection {
  sameOrigin: boolean;
}

let base: ResolvedConnection | null = null;
let initPromise: Promise<ResolvedConnection> | null = null;

type DesktopBridge = {
  getConfig?: () => Promise<{ host?: string; port?: number } | null>;
  setConfig?: (cfg: { host: string; port: number }) => Promise<void>;
};

function bridge(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { skladDesktop?: DesktopBridge }).skladDesktop ?? null;
}

function isHttpOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

function fromStorage(): Connection | null {
  try {
    const raw = window.localStorage.getItem('sklad-connection');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Connection;
    if (parsed && parsed.host) {
      return { host: parsed.host, port: Number(parsed.port) || DEFAULT_PORT };
    }
  } catch {
    // ignore
  }
  return null;
}

async function resolveInitial(): Promise<ResolvedConnection> {
  // 1) мост Electron-клиента
  const b = bridge();
  if (b?.getConfig) {
    try {
      const cfg = await b.getConfig();
      if (cfg?.host) {
        return { host: cfg.host, port: Number(cfg.port) || DEFAULT_PORT, sameOrigin: false };
      }
    } catch {
      // ignore
    }
  }
  // 2) localStorage
  const saved = fromStorage();
  if (saved) return { ...saved, sameOrigin: false };
  // 3) same-origin, если страницу отдаёт сам сервер по http(s)
  if (isHttpOrigin()) {
    return {
      host: window.location.hostname || '127.0.0.1',
      port: Number(window.location.port) || (window.location.protocol === 'https:' ? 443 : 80),
      sameOrigin: true,
    };
  }
  // 4) клиент без сохранённого подключения (app://) — дефолт
  return { host: '127.0.0.1', port: DEFAULT_PORT, sameOrigin: false };
}

/** Инициализация подключения (вызывается один раз из ConnectionGate). */
export async function initConnection(): Promise<ResolvedConnection> {
  if (!base) {
    if (!initPromise) {
      initPromise = resolveInitial().then((c) => {
        base = c;
        return c;
      });
    }
    base = await initPromise;
  }
  return base;
}

/** Текущее подключение (после initConnection). */
export function getConnection(): Connection | null {
  return base ? { host: base.host, port: base.port } : null;
}

export function isSameOrigin(): boolean {
  return base?.sameOrigin ?? false;
}

/** Сохранить подключение (после успешного health-чека). */
export async function setConnection(conn: Connection): Promise<void> {
  base = { host: conn.host.trim(), port: Number(conn.port) || DEFAULT_PORT, sameOrigin: false };
  try {
    window.localStorage.setItem(
      'sklad-connection',
      JSON.stringify({ host: base.host, port: base.port }),
    );
  } catch {
    // ignore
  }
  const b = bridge();
  if (b?.setConfig) {
    try {
      await b.setConfig({ host: base.host, port: base.port });
    } catch {
      // ignore
    }
  }
}

/** Сбросить сохранённое подключение (экран «Сменить сервер»). */
export function clearConnection(): void {
  base = null;
  initPromise = null;
  try {
    window.localStorage.removeItem('sklad-connection');
  } catch {
    // ignore
  }
}

/** Построить URL для пути API с учётом текущего baseUrl. */
export function apiUrl(path: string): string {
  if (!base || base.sameOrigin) return path;
  return `http://${base.host}:${base.port}${path}`;
}

/** fetch по apiUrl с гарантированным JSON-парсингом ошибок. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}

/**
 * GET /api/server/health c коротким таймаутом.
 * Возвращает JSON при успехе, null при недоступности.
 */
export async function pingServer(
  conn?: Connection,
  timeoutMs = 2500,
): Promise<Record<string, unknown> | null> {
  const prev = base;
  if (conn) base = { host: conn.host.trim(), port: Number(conn.port) || DEFAULT_PORT, sameOrigin: false };
  try {
    const res = await fetch(apiUrl('/api/server/health'), {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    base = prev;
  }
}
