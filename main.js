const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { pathToFileURL } = require('url');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 880,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-folder', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (res.canceled || res.filePaths.length === 0) return { canceled: true };
  return { canceled: false, path: res.filePaths[0] };
});

ipcMain.handle('list-dir', async (e, dirPath) => {
  const dirents = await fs.readdir(dirPath, { withFileTypes: true });
  const out = [];
  for (const d of dirents) {
    const full = path.join(dirPath, d.name);
    let size = 0, mtime = 0, ctime = 0;
    try {
      const st = await fs.stat(full);
      size = d.isDirectory() ? 0 : st.size; mtime = st.mtimeMs; ctime = st.ctimeMs;
    } catch {}
    out.push({ name: d.name, fullPath: full, isDirectory: d.isDirectory(), size, mtime, ctime, ext: path.extname(d.name).slice(1).toLowerCase() });
  }
  return out;
});

ipcMain.handle('read-text', async (e, filePath) => {
  const st = await fs.stat(filePath);
  if (st.size > 5 * 1024 * 1024) throw new Error('Archivo muy grande (>5MB) para editar como texto.');
  const content = await fs.readFile(filePath, 'utf8');
  return { content, mtime: st.mtimeMs };
});

ipcMain.handle('write-text', async (e, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf8');
  return true;
});

ipcMain.handle('open-path', async (e, fullPath) => {
  const err = await shell.openPath(fullPath);
  if (err) throw new Error(err);
  return true;
});

ipcMain.handle('show-in-folder', async (e, fullPath) => {
  shell.showItemInFolder(fullPath);
  return true;
});

ipcMain.handle('rename-path', async (e, oldPath, newPath) => {
  await fs.rename(oldPath, newPath);
  return true;
});

ipcMain.handle('file-url', async (e, fullPath) => {
  return pathToFileURL(fullPath).href;
});

// --- Nuevas operaciones de gestor ---
ipcMain.handle('mkdir', async (e, dirPath) => {
  await fs.mkdir(dirPath, { recursive: false });
  return true;
});

ipcMain.handle('mkfile', async (e, filePath, content = '') => {
  await fs.writeFile(filePath, content, { flag: 'wx' });
  return true;
});

ipcMain.handle('trash', async (e, fullPath) => {
  await shell.trashItem(fullPath);
  return true;
});

ipcMain.handle('copy-entry', async (e, src, dest) => {
  await fs.cp(src, dest, { recursive: true, errorOnExist: true });
  return true;
});

ipcMain.handle('stat-entry', async (e, fullPath) => {
  const st = await fs.stat(fullPath);
  return {
    size: st.size, mtime: st.mtimeMs, ctime: st.ctimeMs, birthtime: st.birthtimeMs,
    isDirectory: st.isDirectory(), isFile: st.isFile()
  };
});

ipcMain.handle('get-drives', async () => {
  // Unidades Windows: comprobar letras existentes + raiz actual
  const drives = [];
  for (let code = 67; code <= 90; code++) {
    const letter = String.fromCharCode(code) + ':\\';
    try {
      await fs.readdir(letter);
      drives.push(letter);
    } catch {}
  }
  if (drives.length === 0) drives.push(path.parse(app.getPath('home')).root);
  return drives;
});

// Busqueda global recursiva (por nombre). Limita resultados y visitas para no colgarla.
ipcMain.handle('search-files', async (e, root, query, limit = 500) => {
  const q = String(query).toLowerCase();
  const SKIP = new Set(['$recycle.bin', 'system volume information', 'node_modules', '.git', '.svn']);
  const out = [];
  const stack = [root];
  let visited = 0;
  while (stack.length && out.length < limit && visited < 30000) {
    const dir = stack.pop();
    let ents;
    try { ents = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const d of ents) {
      if (out.length >= limit) break;
      if (d.name.startsWith('.') || SKIP.has(d.name.toLowerCase())) continue;
      visited++;
      const full = path.join(dir, d.name);
      const isDir = d.isDirectory();
      if (d.name.toLowerCase().includes(q)) {
        let size = 0, mtime = 0;
        try { const st = await fs.stat(full); size = isDir ? 0 : st.size; mtime = st.mtimeMs; } catch {}
        out.push({ name: d.name, fullPath: full, isDirectory: isDir, size, mtime, ctime: 0, ext: path.extname(d.name).slice(1).toLowerCase() });
      }
      if (isDir) stack.push(full);
    }
  }
  return { results: out, truncated: out.length >= limit };
});

ipcMain.handle('special-paths', async () => {
  const out = {};
  for (const k of ['home', 'desktop', 'documents', 'downloads', 'music', 'pictures', 'videos']) {
    try { out[k] = app.getPath(k); } catch {}
  }
  return out;
});

// Miniatura del sistema (rapida, no carga el archivo completo).
// Devuelve dataURL lista para <img>; si no se puede, cae a file:// y el
// renderer muestra el icono generico con onerror.
ipcMain.handle('thumb', async (e, fullPath, size = 256) => {
  try {
    const img = await nativeImage.createThumbnailFromPath(fullPath, { width: Number(size) || 256, height: Number(size) || 256 });
    if (img && !img.isEmpty()) return img.toDataURL();
  } catch {}
  return pathToFileURL(fullPath).href;
});
