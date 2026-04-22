import { ipcRenderer } from 'electron'
import { Configuracion } from '../main/services/ConfiguracionService'

export const createConfiguracionApi = () => {
    return {
        guardarConfiguracion: (config: Configuracion) => ipcRenderer.invoke('guardar-configuracion', config),
        obtenerConfiguracion: () => ipcRenderer.invoke('obtener-configuracion'),
        limpiarConfiguracion: () => ipcRenderer.invoke('limpiar-configuracion'),
        seleccionarArchivo: (filtros: Electron.FileFilter[]) => ipcRenderer.invoke('seleccionar-archivo', filtros),
        seleccionarCarpeta: () => ipcRenderer.invoke('seleccionar-carpeta'),
    }
}
