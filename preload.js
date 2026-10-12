const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('winAPI', {
  isElectron: true,
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  listDir: (dirPath) => ipcRenderer.invoke('list-dir', dirPath),
  readText: (filePath) => ipcRenderer.invoke('read-text', filePath),
  writeText: (filePath, content) => ipcRenderer.invoke('write-text', filePath, content),
  openPath: (fullPath) => ipcRenderer.invoke('open-path', fullPath),
  showInFolder: (fullPath) => ipcRenderer.invoke('show-in-folder', fullPath),
  renamePath: (oldPath, newPath) => ipcRenderer.invoke('rename-path', oldPath, newPath),
  fileUrl: (fullPath) => ipcRenderer.invoke('file-url', fullPath),
  thumb: (fullPath, size) => ipcRenderer.invoke('thumb', fullPath, size),
  searchFiles: (root, query) => ipcRenderer.invoke('search-files', root, query),
  mkdir: (dirPath) => ipcRenderer.invoke('mkdir', dirPath),
  mkfile: (filePath, content) => ipcRenderer.invoke('mkfile', filePath, content),
  trash: (fullPath) => ipcRenderer.invoke('trash', fullPath),
  copyEntry: (src, dest) => ipcRenderer.invoke('copy-entry', src, dest),
  statEntry: (fullPath) => ipcRenderer.invoke('stat-entry', fullPath),
  getDrives: () => ipcRenderer.invoke('get-drives'),
  specialPaths: () => ipcRenderer.invoke('special-paths')
});
