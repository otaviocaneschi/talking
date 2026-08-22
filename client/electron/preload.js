const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script — ponte segura entre o renderer e o main process.
 * Expõe apenas APIs específicas para o frontend.
 */
contextBridge.exposeInMainWorld('electronAPI', {
    // Informações da plataforma
    platform: process.platform,
    
    // Controle de janela (para barra de título customizada futura)
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    
    // Notificações nativas
    sendNotification: (title, body) => {
        new Notification(title, { body });
    },
});
