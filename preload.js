const { contextBridge, ipcRenderer } = require('electron');

const IN = ['claude', 'play', 'say', 'quiet', 'whisper', 'chat-thinking', 'chat-reply', 'fling', 'fling-v', 'bounce', 'config', 'balance', 'whisper-now'];
const OUT = ['ignore-mouse', 'drag-start', 'drag-end', 'menu', 'open-chat'];

contextBridge.exposeInMainWorld('petApi', {
  on: (ch, fn) => {
    if (IN.includes(ch)) ipcRenderer.on(ch, (_e, data) => fn(data));
  },
  send: (ch, data) => {
    if (OUT.includes(ch)) ipcRenderer.send(ch, data);
  },
});
