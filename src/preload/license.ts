import { ipcRenderer } from 'electron'

export const createLicenseApi = () => {
    return {
        obtenerLicencia: () => ipcRenderer.invoke('obtener-licencia'),
        obtenerEstadoLicencia: () => ipcRenderer.invoke('obtener-estado-licencia'),
        validarAgregarRfc: () => ipcRenderer.invoke('validar-agregar-rfc'),
        validarRegistrarMaquina: () => ipcRenderer.invoke('validar-registrar-maquina'),
        validarDescargaCfdi: () => ipcRenderer.invoke('validar-descarga-cfdi'),
        incrementarDescargaCfdi: () => ipcRenderer.invoke('incrementar-descarga-cfdi'),
        validarImportacionCfdi: () => ipcRenderer.invoke('validar-importacion-cfdi'),
        incrementarImportacionCfdi: () => ipcRenderer.invoke('incrementar-importacion-cfdi'),
        validarConsolidacion: () => ipcRenderer.invoke('validar-consolidacion'),
        incrementarConsolidacion: () => ipcRenderer.invoke('incrementar-consolidacion'),
    }
}
