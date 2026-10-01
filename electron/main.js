const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;
const PORT = 3000;

function findFreePort(startPort) {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => resolve(startPort));
  });
}

function waitForServer(port, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const req = http.get(`http://localhost:${port}`, (res) => {
        clearInterval(interval);
        resolve(true);
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Server failed to start within timeout'));
        }
      });
      req.setTimeout(1000);
      req.on('timeout', () => req.destroy());
    }, 1000);
  });
}

function startServer(appPath) {
  const isDev = !app.isPackaged;

  if (isDev) {
    // Development mode - just wait for user's dev server
    console.log('[SKLAD] Development mode - waiting for Next.js dev server...');
    return;
  }

  // Production mode - start standalone Next.js server
  console.log('[SKLAD] Production mode - starting Next.js standalone server...');

  const serverScript = path.join(appPath, 'server.js');

  // Portable: store all data (db, backups, exports) next to the .exe file.
  // electron-builder portable sets PORTABLE_EXECUTABLE_DIR env var.
  // Fallback: directory of the executable itself.
  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  const dataDir = path.join(exeDir, 'data');

  console.log('[SKLAD] Data directory:', dataDir);

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOSTNAME: '127.0.0.1',
    SKLAD_DATA_DIR: dataDir,
    ELECTRON_RUN_AS_NODE: '1',
  };

  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: appPath,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Next.js] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Next.js Error] ${data.toString().trim()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`[Next.js] Server exited with code ${code}`);
    serverProcess = null;
  });

  serverProcess.on('error', (err) => {
    console.error(`[Next.js] Failed to start: ${err.message}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'SKLAD - Склад: система учёта',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Remove default menu
  Menu.setApplicationMenu(null);

  // Load the Next.js app
  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  const isDev = !app.isPackaged;

  // Determine app path
  let appPath;
  if (isDev) {
    appPath = path.join(__dirname, '..');
  } else {
    appPath = path.join(process.resourcesPath, 'app');
  }

  if (!isDev) {
    startServer(appPath);

    try {
      await waitForServer(PORT);
      console.log('[SKLAD] Next.js server is ready');
    } catch (err) {
      console.error('[SKLAD] Failed to start Next.js server:', err.message);
      // Show error dialog
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Ошибка запуска',
        'Не удалось запустить сервер приложения.\n\nПопробуйте перезапустить SKLAD.\nЕсли ошибка повторяется, обратитесь к администратору.'
      );
      app.quit();
      return;
    }
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Kill Next.js server process
  if (serverProcess) {
    console.log('[SKLAD] Stopping Next.js server...');
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (serverProcess) serverProcess.kill('SIGKILL');
    }, 3000);
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for preload
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-platform', () => process.platform);
