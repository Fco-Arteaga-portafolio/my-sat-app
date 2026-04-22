import { ipcRenderer } from 'electron'

export const createImportacionApi = () => {
    return {
        seleccionarXmls: () => ipcRenderer.invoke('seleccionar-xmls'),
        seleccionarCarpetaXml: () => ipcRenderer.invoke('seleccionar-carpeta-xml'),
        importarXmls: (rutas: string[]) => ipcRenderer.invoke('importar-xmls', rutas),
    }
}
