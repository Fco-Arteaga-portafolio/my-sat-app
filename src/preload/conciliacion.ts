import { ipcRenderer } from 'electron'

export const createConciliacionApi = () => {
    return {
        iniciarConciliacion: (params: any) => ipcRenderer.invoke('iniciar-conciliacion', params),
        obtenerUltimaConciliacion: (params: any) => ipcRenderer.invoke('obtener-ultima-conciliacion', params),
        obtenerHistorialConciliaciones: () => ipcRenderer.invoke('obtener-historial-conciliaciones'),
        onProgresoConciliacion: (callback: (progreso: any) => void) => {
            ipcRenderer.on('progreso-conciliacion', (_, progreso) => callback(progreso))
        },
    }
}
