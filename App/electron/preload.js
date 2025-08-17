const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    window: {
      minimize: () => ipcRenderer.send('window-minimize'),
      maximize: () => ipcRenderer.send('window-maximize'),
      close: () => ipcRenderer.send('window-close'),
      isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    },
    send: (channel, data) => {
      // whitelist channels
      let validChannels = ['toMain', 'editor-info-update', 'discord-settings-update'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      let validChannels = ['fromMain'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    // Discord RPC specific functions
    discord: {
      updateEditorInfo: (info) => {
        ipcRenderer.send('editor-info-update', info);
      },
      updateSettings: (settings) => {
        ipcRenderer.send('discord-settings-update', settings);
      }
    },
    // File system operations
    openInExplorer: (filePath) => {
      return ipcRenderer.invoke('open-in-explorer', filePath);
    }
  }
);