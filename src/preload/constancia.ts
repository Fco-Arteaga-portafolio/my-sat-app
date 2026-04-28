import { ipcRenderer } from 'electron'

export const createConstanciaApi = () => {
    return {
        constanciaObtenerCaptcha: async () =>
            ipcRenderer.invoke('constancia-obtener-captcha'),

        constanciaObtenerConstancia: async (data: { captcha?: string }) =>
            ipcRenderer.invoke('constancia-obtener-constancia', data),

        constanciaCerrarSesion: async () =>
            ipcRenderer.invoke('constancia-cerrar-sesion'),

        onProgresoConstancia: (callback: (mensaje: string) => void) => {
            ipcRenderer.on('progreso-constancia', (_, mensaje) => callback(mensaje))
        }
    }
}