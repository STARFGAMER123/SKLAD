// SKLAD v3.1 — preload клиента: мост подключения к серверу
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skladDesktop', {
  /** Адрес сервера из %APPDATA%\SkladClient\config.json */
  getConfig: () => ipcRenderer.invoke('client:get-config'),
  /** Сохранить адрес сервера (вызывается после успешного health-чека) */
  setConfig: (cfg) => ipcRenderer.invoke('client:set-config', cfg),
});
