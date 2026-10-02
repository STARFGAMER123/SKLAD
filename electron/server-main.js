/**
 * SKLAD v3.1 — SKLAD_Server.exe (tray-only).
 *
 * - Свёрнут в трей; Next.js standalone запускается дочерним процессом
 *   через ELECTRON_RUN_AS_NODE (проверенный паттерн v2.1).
 * - Порт/настройки: server-config.json РЯДОМ С EXE (PORTABLE_EXECUTABLE_DIR).
 * - Лог: sklad-server.log РЯДОМ С EXE — все шаги запуска и ошибки
 *   (portable-режим без консоли, console.* невидим).
 * - Control-сервер 127.0.0.1:<controlPort>/pick-db — нативный диалог
 *   выбора базы на серверном ПК (для /api/server/db/pick).
 * - Смена порта/интерфейса → перезапуск Next-процесса.
 * - Автозапуск Windows (app.setLoginItemSettings).
 */

const { app, Tray, Menu, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
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
    logErr(`config save failed: ${e.message}`);
  }
}

// ─── Лог рядом с exe (portable без консоли!) ─────────────────────────────────
const logPath = path.join(exeDir, 'sklad-server.log');
let logStream = null;
function openLog() {
  try {
    // одна ступень ротации: прошлый лог -> .1.log
    try {
      if (fs.existsSync(logPath)) fs.renameSync(logPath, logPath.replace(/\.log$/, '.1.log'));
    } catch {}
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logInfo(`=== SKLAD Server запущен | exe=${process.execPath} | exeDir=${exeDir}`);
    logInfo(`electron=${process.versions.electron} node=${process.versions.node} abi=${process.versions.modules} platform=${process.platform} arch=${process.arch}`);
  } catch (e) {
    // совсем некуда писать — остаётся console
    console.error('[SKLAD] log open failed:', e.message);
  }
}
function logInfo(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  if (logStream) logStream.write(line + '\n');
  console.log(line);
}
function logErr(msg) {
  const line = `[${new Date().toISOString()}] [ERROR] ${msg}`;
  if (logStream) logStream.write(line + '\n');
  console.error(line);
}
function showError(title, details) {
  logErr(`${title}: ${details}`);
  try {
    dialog.showErrorBox(title, `${details}\n\nПодробности: ${logPath}`);
  } catch {}
}

// Перехват тихих падений main-процесса
process.on('uncaughtException', (e) => showError('SKLAD Server — внутренняя ошибка', `${e.stack || e.message}`));
process.on('unhandledRejection', (e) => showError('SKLAD Server — ошибка promise', `${(e && (e.stack || e.message)) || e}`));

// ─── Состояние ───────────────────────────────────────────────────────────────
let serverProcess = null;
let controlServer = null;
let tray = null;
let settingsWin = null;
let nextReady = false;
const startedAt = Date.now();

// Если экземпляр уже запущен — сообщаем понятно и выходим
if (!app.requestSingleInstanceLock()) {
  app.whenReady().then(() => {
    showError('SKLAD Server уже запущен', 'Новый экземпляр закроется.\nПроверьте трей или завершите старый процесс SKLAD_Server.exe в диспетчере задач.');
    app.quit();
  });
  setImmediate(() => app.quit());
}

// ─── Next.js standalone ─────────────────────────────────────────────────────
function uiPath() {
  return path.join(process.resourcesPath, 'sklad-server', 'ui');
}
function dataDir() {
  const d = cfg.dataDir && cfg.dataDir.trim() ? cfg.dataDir.trim() : path.join(exeDir, 'data');
  try {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  } catch (e) {
    showError('SKLAD Server — папка данных недоступна', `Не удалось создать папку данных:\n${d}\n\n${e.message}`);
  }
  return d;
}

function startNext() {
  if (serverProcess) return;
  const script = path.join(uiPath(), 'server.js');
  logInfo(`startNext: resourcesPath=${process.resourcesPath}`);
  logInfo(`startNext: script=${script} exists=${fs.existsSync(script)}`);
  if (!fs.existsSync(script)) {
    showError('SKLAD Server', `Не найден server.js (повреждённая установка):\n${script}`);
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
  logInfo(`startNext: spawn PORT=${cfg.port} HOSTNAME=${cfg.bind} dataDir=${env.SKLAD_DATA_DIR}`);
  try {
    serverProcess = spawn(process.execPath, [script], {
      cwd: uiPath(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (e) {
    showError('SKLAD Server — не удалось запустить Next.js', e.message);
    serverProcess = null;
    return;
  }
  serverProcess.stdout.on('data', (d) => logInfo(`[Next] ${d.toString().trim()}`));
  serverProcess.stderr.on('data', (d) => logErr(`[Next:err] ${d.toString().trim()}`));
  serverProcess.on('error', (e) => {
    // spawn не удался (ENOENT/EACCES/блокировка антивирусом и т.п.)
    showError('SKLAD Server — ошибка запуска Next.js-процесса', `${e.message}\n\nЧастые причины: антивирус заблокировал процесс, нет прав на ${exeDir}.`);
    serverProcess = null;
    refreshTray();
  });
  serverProcess.on('close', (code, signal) => {
    logInfo(`Next process closed: code=${code} signal=${signal}`);
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
      logInfo(`Server ready on port ${cfg.port} (за ${((Date.now() - startedAt) / 1000).toFixed(1)} с)`);
      refreshTray();
    } else {
      logErr(`health: unexpected status ${res.statusCode}`);
    }
  });
  req.on('error', () => {
    if (attempt < 60) {
      if (attempt % 10 === 0) logInfo(`waitReady: попытка ${attempt}/60...`);
      setTimeout(() => waitReady(attempt + 1), 500);
    } else {
      showError('SKLAD Server — не дождались запуска', `Next.js не поднялся на порту ${cfg.port} за 30 с.\nСмотрите раздел [Next:err] в sklad-server.log`);
    }
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
  controlServer.on('error', (e) => logErr(`control server: ${e.message}`));
  controlServer.listen(cfg.controlPort, '127.0.0.1', () => logInfo(`control server on 127.0.0.1:${cfg.controlPort}`));
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
      { label: 'Показать лог', click: () => require('electron').shell.openPath(logPath) },
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
    logErr(`autostart: ${e.message}`);
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
  logInfo(`whenReady: app готов за ${((Date.now() - startedAt) / 1000).toFixed(1)} с`);
  try {
    startControlServer();
    startNext();
  } catch (e) {
    showError('SKLAD Server — ошибка старта служб', e.stack || e.message);
  }
  try {
    const iconPath = trayIcon();
    logInfo(`tray icon: ${iconPath || 'НЕ НАЙДЕН'}`);
    tray = iconPath ? new Tray(iconPath) : new Tray(nativeImage.createEmpty());
  } catch (e) {
    showError('SKLAD Server — не удалось создать иконку трея', e.stack || e.message);
    tray = null;
  }
  try {
    if (tray) {
      tray.setToolTip(`SKLAD Server — порт ${cfg.port}`);
      refreshTray();
    }
    applyAutostart();
  } catch (e) {
    showError('SKLAD Server — ошибка инициализации трея', e.stack || e.message);
  }
  logInfo('whenReady: инициализация завершена');
});

app.on('second-instance', () => {
  if (settingsWin) settingsWin.focus();
});

app.on('before-quit', () => {
  logInfo('before-quit: останавливаем Next и control-сервер');
  stopNext();
  if (controlServer) {
    try { controlServer.close(); } catch {}
  }
  if (logStream) {
    try { logStream.end(); } catch {}
  }
});
