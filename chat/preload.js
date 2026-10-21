const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chatApi', {
  settings: () => ipcRenderer.invoke('chat-settings'),
  save: (s) => ipcRenderer.invoke('chat-save', s),
  history: () => ipcRenderer.invoke('chat-history'),
  clear: () => ipcRenderer.invoke('chat-clear'),
  send: (text) => ipcRenderer.invoke('chat-send', text),
});
