import { ipcRenderer } from 'electron'

export const createCatalogoApi = () => {
    return {
        catalogoObtener: (tipo: string) => ipcRenderer.invoke('catalogo-obtener', tipo),
        catalogoObtenerPorRfc: (tipo: string, rfc: string) => ipcRenderer.invoke('catalogo-obtener-por-rfc', tipo, rfc),
        catalogoActualizar: (tipo: string, rfc: string, datos: any) => ipcRenderer.invoke('catalogo-actualizar', tipo, rfc, datos),
        catalogoSincronizar: () => ipcRenderer.invoke('catalogo-sincronizar'),
    }
}
