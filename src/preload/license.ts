import { ipcRenderer } from 'electron'

export const createLicenseApi = () => {
    return {
        obtenerLicencia: () => ipcRenderer.invoke('obtener-licencia'),
        obtenerEstadoLicencia: () => ipcRenderer.invoke('obtener-estado-licencia'),
        validarAgregarRfc: () => ipcRenderer.invoke('validar-agregar-rfc'),
        validarRegistrarMaquina: () => ipcRenderer.invoke('validar-registrar-maquina'),
    }
}
