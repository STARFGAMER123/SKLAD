/**
 * SKLAD v3.1 — SKLAD_Client.exe (толстый клиент).
 *
 * - Раздаёт статический UI (out/ из next export) через схему app://ui
 *   (standard/secure/supportFetchAPI — работает fetch и SPA-роутинг).
 * - Подключение хранится в %APPDATA%\SkladClient\config.json
 *   (app.getPath('userData') при app.setName('SkladClient')).
 * - preload (client-preload.js) даёт UI мост window.skladDesktop:
 *   getConfig / setConfig — адрес сервера.
 */

const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('SkladClient');

// Схема app:// должна быть зарегистрирована ДО app.ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const uiDir = path.join(process.resourcesPath, 'sklad-client', 'ui');

const DEFAULT_CONFIG = { host: '127.0.0.1', port: 3270 };

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath(), 'utf8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('[SkladClient] config save failed:', e.message);
  }
}

ipcMain.handle('client:get-config', () => readConfig());
ipcMain.handle('client:set-config', (_e, cfg) => {
  const merged = { ...readConfig(), ...cfg };
  writeConfig(merged);
  return { ok: true };
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

function serveFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const body = fs.readFileSync(filePath);
  return new Response(body, {
    headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
  });
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: 'SKLAD — клиент',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'client-preload.js'),
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL('app://ui/index.html');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (!fs.existsSync(path.join(uiDir, 'index.html'))) {
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'SKLAD Client',
      'Не найден интерфейс приложения (повреждённая установка).\n\nОжидаемый путь: ' + uiDir,
    );
    app.quit();
    return;
  }

  // Electron 25+: protocol.handle с Response
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    // app://ui/<path> → host = 'ui'
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';

    const resolved = path.normalize(path.join(uiDir, pathname));
    if (!resolved.startsWith(uiDir)) {
      return new Response('Forbidden', { status: 403 });
    }
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return serveFile(resolved);
    }

    // SPA-fallback: неизвестные пути без расширения → index.html
    if (!path.extname(pathname)) {
      return serveFile(path.join(uiDir, 'index.html'));
    }
    return new Response('Not Found', { status: 404 });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
