import { ipcRenderer } from 'electron'

export const createMiscApi = () => {
    return {
        abrirArchivo: (ruta: string) => ipcRenderer.invoke('abrir-archivo', ruta),
    }
}

export const createElectronUpdater = () => {
    return {
        onStatus: (callback: (status: string) => void) => {
            ipcRenderer.on('update-status', (_, status) => callback(status))
        },
        onProgress: (callback: (percent: number) => void) => {
            ipcRenderer.on('update-progress', (_, percent) => callback(percent))
        },
        install: () => {
            ipcRenderer.send('install-update')
        },
        postpone: () => {
            ipcRenderer.send('postpone-update')
        },
        download: () => ipcRenderer.send('download-update')
    }
}

export const createAppInfo = () => {
    return {
        getVersion: () => ipcRenderer.invoke('app-version')
    }
}
