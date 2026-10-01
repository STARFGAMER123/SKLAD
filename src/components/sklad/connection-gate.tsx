'use client';

/**
 * SKLAD v3.1 — ConnectionGate: стейт-машина подключения к серверу.
 *
 * boot       — инициализация (сохранённое подключение → health)
 * connecting — проверка введённого адреса
 * connect    — экран «Подключение к серверу»
 * nodb       — сервер доступен, БД не выбрана (4 опции)
 * ready      — рабочая область + фоновый поллинг health каждые 5 с
 *
 * Реконнект: падение health → баннер «Переподключение…» (●);
 * восстановление → баннер снимается. dbConfigured:false в nodb/ready
 * возвращает на экран выбора БД.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Server, Wifi, WifiOff, RefreshCw, FolderOpen, Upload, FilePlus2,
  MonitorUp, ListChecks, ArrowLeft, Loader2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  initConnection, setConnection, clearConnection, apiUrl, isSameOrigin,
  pingServer, type Connection,
} from '@/lib/api-client';

type Phase = 'boot' | 'connecting' | 'connect' | 'nodb' | 'ready';

interface Health {
  ok?: boolean;
  dbConfigured?: boolean;
  hostname?: string;
  version?: string;
}

interface DbItem {
  path: string;
  name: string;
  size: number;
  mtime: number;
  selected?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function ConnectionGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('boot');
  const [reconnecting, setReconnecting] = useState(false);
  const [conn, setConn] = useState<Connection>({ host: '127.0.0.1', port: 3270 });
  const [serverInfo, setServerInfo] = useState<Health | null>(null);

  // nodb-опции
  const [dbListOpen, setDbListOpen] = useState(false);
  const [dbList, setDbList] = useState<DbItem[] | null>(null);
  const [dbListLoading, setDbListLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // pick|list|import|create
  const [pickWaiting, setPickWaiting] = useState(false);
  const pickAbortRef = useRef<AbortController | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const checkHealth = useCallback(async (): Promise<Health | null> => {
    const h = await pingServer(undefined, 2500);
    return (h as Health) ?? null;
  }, []);

  const enterReady = useCallback(() => {
    setReconnecting(false);
    setPhase('ready');
  }, []);

  // ---------- boot ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await initConnection();
      if (cancelled) return;
      setConn({ host: c.host, port: c.port });
      const h = await checkHealth();
      if (cancelled) return;
      setServerInfo(h);
      if (!h) {
        setPhase('connect');
        return;
      }
      if (!h.dbConfigured) {
        setPhase('nodb');
        return;
      }
      enterReady();
    })();
    return () => {
      cancelled = true;
    };
  }, [checkHealth, enterReady]);

  // ---------- фоновый поллинг (nodb + ready) ----------
  useEffect(() => {
    if (phase !== 'nodb' && phase !== 'ready') return;
    const id = setInterval(async () => {
      const h = await checkHealth();
      setServerInfo(h);
      if (!h) {
        setReconnecting(true);
        return;
      }
      if (!h.dbConfigured) {
        setReconnecting(false);
        setPhase('nodb');
        return;
      }
      if (phase === 'ready' || h.dbConfigured) {
        enterReady();
      }
    }, 5000);
    return () => clearInterval(id);
  }, [phase, checkHealth, enterReady]);

  // ---------- connect-экран ----------
  const handleConnect = useCallback(async () => {
    setPhase('connecting');
    const h = await pingServer({ host: conn.host.trim(), port: Number(conn.port) || 3270 }, 3000);
    setServerInfo(h);
    if (!h) {
      toast.error(`Сервер ${conn.host}:${conn.port} недоступен`);
      setPhase('connect');
      return;
    }
    await setConnection({ host: conn.host.trim(), port: Number(conn.port) || 3270 });
    if (!h.dbConfigured) {
      setPhase('nodb');
      return;
    }
    enterReady();
  }, [conn, checkHealth, enterReady]);

  // ---------- nodb: опция 1 — нативный диалог на сервере ----------
  const handlePick = useCallback(async () => {
    setBusy('pick');
    setPickWaiting(true);
    const ac = new AbortController();
    pickAbortRef.current = ac;
    try {
      const res = await fetch(apiUrl('/api/server/db/pick'), {
        method: 'POST',
        signal: ac.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 501) {
        toast.info('Диалог доступен только у серверного ПК (SKLAD_Server).');
        return;
      }
      if (data?.canceled) {
        toast.info('Выбор базы отменён.');
        return;
      }
      if (!res.ok) {
        toast.error(data?.error || 'Не удалось выбрать базу');
        return;
      }
      toast.success(`База выбрана: ${data.dbPath}`);
      enterReady();
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === 'AbortError') {
        toast.info('Ожидание отменено. Если окно открыто на сервере — закройте его там вручную.');
      } else {
        toast.error('Связь с сервером потеряна');
      }
    } finally {
      setPickWaiting(false);
      setBusy(null);
      pickAbortRef.current = null;
    }
  }, [enterReady]);

  const cancelPick = useCallback(() => {
    pickAbortRef.current?.abort();
  }, []);

  // ---------- nodb: опция 2 — список баз ----------
  const openDbList = useCallback(async () => {
    setDbListOpen(true);
    setDbListLoading(true);
    try {
      const res = await fetch(apiUrl('/api/server/db/list'), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setDbList(data.databases ?? []);
    } catch {
      toast.error('Не удалось получить список баз');
      setDbList(null);
    } finally {
      setDbListLoading(false);
    }
  }, []);

  const selectDb = useCallback(
    async (path: string) => {
      setBusy('list');
      try {
        const res = await fetch(apiUrl('/api/server/db/select'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Ошибка выбора');
        setDbListOpen(false);
        toast.success(`База выбрана: ${data.dbPath}`);
        enterReady();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Ошибка выбора базы');
      } finally {
        setBusy(null);
      }
    },
    [enterReady],
  );

  // ---------- nodb: опция 3 — импорт файла с клиента ----------
  const handleImport = useCallback(
    async (file: File) => {
      setBusy('import');
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(apiUrl('/api/server/db/import'), { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Ошибка импорта');
        toast.success(`База импортирована: ${data.path}`);
        enterReady();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Ошибка импорта базы');
      } finally {
        setBusy(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [enterReady],
  );

  // ---------- nodb: опция 4 — создать новую ----------
  const handleCreate = useCallback(async () => {
    if (!createName.trim()) {
      toast.error('Укажите имя базы');
      return;
    }
    setBusy('create');
    try {
      const res = await fetch(apiUrl('/api/server/db/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Ошибка создания');
      setCreateOpen(false);
      toast.success(`Создана база: ${data.dbPath}`);
      enterReady();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ошибка создания базы');
    } finally {
      setBusy(null);
    }
  }, [createName, enterReady]);

  // ---------- render ----------
  if (phase === 'ready') {
    return (
      <div className="min-h-screen relative">
        {reconnecting && (
          <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/95 py-1.5 text-sm font-medium text-amber-950 shadow">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-950 animate-pulse">●</span>
            Переподключение к серверу…
          </div>
        )}
        {children}
      </div>
    );
  }

  if (phase === 'boot') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Инициализация…</p>
        </div>
      </div>
    );
  }

  if (phase === 'connecting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Подключение к {conn.host}:{conn.port}…</p>
        </div>
      </div>
    );
  }

  if (phase === 'connect') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Server className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">Подключение к серверу</CardTitle>
            <CardDescription>
              Укажите IP-адрес компьютера с SKLAD_Server и порт
              <br />(по умолчанию 3270)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="host">IP-адрес сервера</Label>
              <Input
                id="host"
                placeholder="192.168.1.100"
                value={conn.host}
                onChange={(e) => setConn((c) => ({ ...c, host: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Порт</Label>
              <Input
                id="port"
                type="number"
                value={conn.port}
                onChange={(e) => setConn((c) => ({ ...c, port: Number(e.target.value) }))}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              />
            </div>
            <Button className="w-full" onClick={handleConnect} disabled={!conn.host.trim()}>
              <Wifi className="mr-2 h-4 w-4" /> Подключить
            </Button>
            {isSameOrigin() && (
              <p className="text-center text-xs text-muted-foreground">
                Страница открыта с самого сервера — можно оставить localhost
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- nodb ----------
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".db,.sqlite,.db3"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
        }}
      />
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle className="text-xl">База данных не найдена</CardTitle>
          <CardDescription>
            Сервер {serverInfo?.hostname ? `«${serverInfo.hostname}» ` : ''}доступен, но база данных не выбрана.
            <br />Укажите файл базы на серверном ПК или создайте новую.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
            onClick={handlePick}
            disabled={busy !== null}
          >
            <span className="flex items-center gap-2 font-medium">
              <MonitorUp className="h-4 w-4" />
              Выбрать на сервере
              {pickWaiting && <Loader2 className="h-3 w-3 animate-spin" />}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Открыть окно выбора на серверном ПК
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
            onClick={openDbList}
            disabled={busy !== null}
          >
            <span className="flex items-center gap-2 font-medium">
              <ListChecks className="h-4 w-4" />
              Список баз
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Файлы .db в папке данных сервера
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy !== null}
          >
            <span className="flex items-center gap-2 font-medium">
              <Upload className="h-4 w-4" />
              Импортировать файл
              {busy === 'import' && <Loader2 className="h-3 w-3 animate-spin" />}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Загрузить .db с этого устройства
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
            onClick={() => setCreateOpen(true)}
            disabled={busy !== null}
          >
            <span className="flex items-center gap-2 font-medium">
              <FilePlus2 className="h-4 w-4" />
              Создать новую
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Пустая база в папке данных
            </span>
          </Button>

          <div className="sm:col-span-2 mt-1 flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearConnection();
                setPhase('connect');
              }}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Сменить сервер
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const h = await checkHealth();
                setServerInfo(h);
                if (h?.dbConfigured) enterReady();
                else if (!h) setPhase('connect');
                else toast.info('База по-прежнему не выбрана');
              }}
            >
              <RefreshCw className="mr-1 h-4 w-4" /> Перепроверить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ожидание нативного диалога */}
      <Dialog open={pickWaiting} onOpenChange={(open) => !open && cancelPick()}>
        <DialogContent className="max-w-sm [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Ожидание на сервере…
            </DialogTitle>
            <DialogDescription>
              На мониторе серверного ПК открыто окно выбора файла базы.
              Выберите файл там — подключение продолжится автоматически.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelPick}>Отмена</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Список баз */}
      <Dialog open={dbListOpen} onOpenChange={setDbListOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" /> Базы данных на сервере
            </DialogTitle>
            <DialogDescription>Выберите файл базы</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 min-h-0 overflow-y-auto -mx-2 px-2">
            {dbListLoading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {!dbListLoading && dbList && dbList.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Файлы баз (*.db) в папке данных не найдены
              </p>
            )}
            {!dbListLoading &&
              dbList?.map((db) => (
                <button
                  key={db.path}
                  className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 mb-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                  onClick={() => selectDb(db.path)}
                  disabled={busy !== null}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {db.name}
                      {db.selected && (
                        <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          ТЕКУЩАЯ
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground" title={db.path}>
                      {db.path}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatSize(db.size)}
                  </span>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Создание новой базы */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Новая база данных</DialogTitle>
            <DialogDescription>
              Будет создан файл в папке данных сервера со всей необходимой схемой
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="db-name">Имя базы</Label>
            <Input
              id="db-name"
              placeholder="Склад №2"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button onClick={handleCreate} disabled={busy !== null || !createName.trim()}>
              {busy === 'create' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
