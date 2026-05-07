import { ipcRenderer } from 'electron'

export const createLista69BApi = () => {
    return {
        lista69bSincronizar: async () =>
            ipcRenderer.invoke('lista69b-sincronizar'),

        lista69bAnalizar: async () =>
            ipcRenderer.invoke('lista69b-analizar'),

        lista69bObtenerMeta: async () =>
            ipcRenderer.invoke('lista69b-obtener-meta'),

        onProgresoLista69B: (callback: (mensaje: string) => void) => {
            ipcRenderer.on('progreso-lista69b', (_, mensaje) => callback(mensaje))
        },
    }
}