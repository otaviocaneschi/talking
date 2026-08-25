const { app, BrowserWindow, shell, ipcMain, desktopCapturer, session } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) app.quit();

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 940,
        minHeight: 600,
        title: 'Talking',
        icon: path.join(__dirname, '..', 'public', 'icon.png'),
        backgroundColor: '#1a1a2e',
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Em dev, carrega o Vite dev server
    // Em produção, carrega o build
    const isDev = process.argv.includes('--dev');

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    // Mostra a janela quando estiver pronta (evita flash branco)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Abre links externos no browser do sistema
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // ─── Permitir screen sharing no Electron ────────────
    // Quando a página pede getDisplayMedia, o Electron intercepta
    // e podemos fornecer as fontes de tela/janela automaticamente.
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
            // Se tiver ao menos uma fonte, permite (usa a primeira tela por padrão)
            // O Electron exibirá o seletor nativo de tela
            if (sources.length > 0) {
                callback({ video: sources[0] });
            } else {
                callback({});
            }
        });
    });
}

// ─── IPC Handlers ─────────────────────────────────────
ipcMain.handle('get-desktop-sources', async () => {
    const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
    });

    return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
    }));
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
