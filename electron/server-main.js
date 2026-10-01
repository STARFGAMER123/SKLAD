/**
 * SKLAD v3.1 — SKLAD_Server.exe (tray-only).
 *
 * - Свёрнут в трей; Next.js standalone запускается дочерним процессом
 *   через ELECTRON_RUN_AS_NODE (проверенный паттерн v2.1).
 * - Порт/настройки: server-config.json РЯДОМ С EXE (PORTABLE_EXECUTABLE_DIR).
 * - Control-сервер 127.0.0.1:<controlPort>/pick-db — нативный диалог
 *   выбора базы на серверном ПК (для /api/server/db/pick).
 * - Смена порта/интерфейса → перезапуск Next-процесса.
 * - Автозапуск Windows (app.setLoginItemSettings).
 */

const { app, Tray, Menu, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

// ─── Конфиг рядом с exe ──────────────────────────────────────────────────────
const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
const configPath = path.join(exeDir, 'server-config.json');
const DEFAULT_CFG = {
  port: 3270,
  bind: '0.0.0.0',
  controlPort: 3271,
  dataDir: '',
  autostart: false,
  selectedDb: null,
  recentDbs: [],
};

let cfg = loadConfig();
function loadConfig() {
  try {
    return { ...DEFAULT_CFG, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
  } catch {
    return { ...DEFAULT_CFG, recentDbs: [] };
  }
}
function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('[SKLAD] config save failed:', e.message);
  }
}

// ─── Состояние ───────────────────────────────────────────────────────────────
let serverProcess = null;
let controlServer = null;
let tray = null;
let settingsWin = null;
let nextReady = false;
const startedAt = Date.now();

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// ─── Next.js standalone ─────────────────────────────────────────────────────
function uiPath() {
  return path.join(process.resourcesPath, 'sklad-server', 'ui');
}
function dataDir() {
  const d = cfg.dataDir && cfg.dataDir.trim() ? cfg.dataDir.trim() : path.join(exeDir, 'data');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function startNext() {
  if (serverProcess) return;
  const script = path.join(uiPath(), 'server.js');
  if (!fs.existsSync(script)) {
    dialog.showErrorBox('SKLAD Server', 'Не найден server.js (повреждённая установка).');
    app.quit();
    return;
  }
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(cfg.port),
    HOSTNAME: cfg.bind,
    SKLAD_DATA_DIR: dataDir(),
    SKLAD_CONFIG_DIR: exeDir,
    SKLAD_SELECTED_DB: cfg.selectedDb || '',
    SKLAD_CONTROL_PORT: String(cfg.controlPort),
    ELECTRON_RUN_AS_NODE: '1',
  };
  serverProcess = spawn(process.execPath, [script], {
    cwd: uiPath(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  serverProcess.stdout.on('data', (d) => console.log(`[Next] ${d.toString().trim()}`));
  serverProcess.stderr.on('data', (d) => console.error(`[Next:err] ${d.toString().trim()}`));
  serverProcess.on('close', () => {
    serverProcess = null;
    nextReady = false;
    refreshTray();
  });
  waitReady();
}

function stopNext() {
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
    serverProcess = null;
  }
  nextReady = false;
}

function waitReady(attempt = 0) {
  const req = http.get(`http://127.0.0.1:${cfg.port}/api/server/health`, (res) => {
    res.resume();
    if (res.statusCode === 200) {
      nextReady = true;
      console.log(`[SKLAD] Server ready on port ${cfg.port}`);
      refreshTray();
    }
  });
  req.on('error', () => {
    if (attempt < 60) setTimeout(() => waitReady(attempt + 1), 500);
    else console.error('[SKLAD] Next.js не поднялся за 30 с');
  });
  req.setTimeout(900, () => req.destroy());
}

function restartNext() {
  stopNext();
  setTimeout(startNext, 500);
}

// ─── Control-сервер (нативные диалоги) ──────────────────────────────────────
function startControlServer() {
  controlServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/pick-db') {
      dialog
        .showOpenDialog({
          title: 'Выберите файл базы данных SKLAD',
          defaultPath: dataDir(),
          properties: ['openFile'],
          filters: [
            { name: 'Базы данных', extensions: ['db', 'sqlite', 'db3'] },
            { name: 'Все файлы', extensions: ['*'] },
          ],
        })
        .then((r) => {
          if (r.canceled || !r.filePaths[0]) {
            res.statusCode = 204;
            res.end();
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ path: r.filePaths[0] }));
          }
        })
        .catch(() => {
          res.statusCode = 500;
          res.end('dialog error');
        });
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, control: true }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  controlServer.on('error', (e) => console.error('[SKLAD] control server:', e.message));
  controlServer.listen(cfg.controlPort, '127.0.0.1');
}

// ─── Трей ────────────────────────────────────────────────────────────────────
function lanAddresses() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const i of ifs[name] || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(`${name}: ${i.address}`);
    }
  }
  return out;
}

function trayIcon() {
  // prefer ico/win, fallback png
  const candidates = [
    path.join(__dirname, 'icon.ico'),
    path.join(__dirname, 'icon.png'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(process.resourcesPath, 'icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined; // electron built-in blank
}

function refreshTray() {
  if (!tray) return;
  const status = nextReady ? `Работает · порт ${cfg.port}` : 'Запуск…';
  const webItem = nextReady
    ? { label: `Веб-интерфейс: http://${lanAddresses()[0]?.split(': ')[1] || 'localhost'}:${cfg.port}`, click: openWeb }
    : { label: 'Веб-интерфейс (сервер запускается…)', enabled: false };
  tray.setToolTip(`SKLAD Server — ${status}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `SKLAD Server v3.1.0 — ${status}`, enabled: false },
      { type: 'separator' },
      { label: `Порт: ${cfg.port} · БД: ${cfg.selectedDb ? path.basename(cfg.selectedDb) : 'не выбрана'}`, enabled: false },
      ...lanAddresses().map((a) => ({ label: `  ${a}:${cfg.port}`, enabled: false })),
      { type: 'separator' },
      webItem,
      { label: 'Настройки…', click: openSettings },
      { label: 'Открыть папку данных', click: () => require('electron').shell.openPath(dataDir()) },
      { type: 'separator' },
      {
        label: 'Автозапуск с Windows',
        type: 'checkbox',
        checked: cfg.autostart,
        click: (item) => {
          cfg.autostart = item.checked;
          saveConfig();
          applyAutostart();
        },
      },
      { type: 'separator' },
      { label: 'Выход', click: () => app.quit() },
    ]),
  );
}

function openWeb() {
  const addr = lanAddresses()[0]?.split(': ')[1] || '127.0.0.1';
  require('electron').shell.openExternal(`http://${addr}:${cfg.port}`);
}

function applyAutostart() {
  try {
    app.setLoginItemSettings({ openAtLogin: cfg.autostart, path: process.execPath });
  } catch (e) {
    console.error('[SKLAD] autostart:', e.message);
  }
}

// ─── Окно настроек ───────────────────────────────────────────────────────────
function openSettings() {
  if (settingsWin) {
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 480,
    height: 520,
    title: 'SKLAD Server — настройки',
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    icon: trayIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'settings-preload.js'),
    },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  settingsWin.once('ready-to-show', () => settingsWin.show());
  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

ipcMain.handle('settings:load', () => ({
  config: cfg,
  interfaces: lanAddresses(),
  serverReady: nextReady,
}));

ipcMain.handle('settings:save', (_e, next) => {
  const oldPort = cfg.port;
  const oldBind = cfg.bind;
  cfg = { ...cfg, ...next };
  saveConfig();
  applyAutostart();
  const portChanged = cfg.port !== oldPort || cfg.bind !== oldBind;
  if (portChanged) restartNext();
  refreshTray();
  return { ok: true, restartRequired: portChanged };
});

// ─── Жизненный цикл ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startControlServer();
  startNext();
  tray = new Tray(trayIcon());
  tray.setToolTip(`SKLAD Server — порт ${cfg.port}`);
  refreshTray();
  applyAutostart();
});

app.on('second-instance', () => {
  if (settingsWin) settingsWin.focus();
});

app.on('before-quit', () => {
  stopNext();
  if (controlServer) {
    try { controlServer.close(); } catch {}
  }
});
