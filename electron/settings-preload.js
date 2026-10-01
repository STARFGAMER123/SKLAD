// SKLAD v3.1 — preload окна настроек сервера
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skladSettings', {
  load: () => ipcRenderer.invoke('settings:load'),
  save: (data) => ipcRenderer.invoke('settings:save', data),
});
