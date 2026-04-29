import { ipcRenderer } from 'electron'

export const createCumplimientoApi = () => {
    return {
        // ✅ Renombrado para no colisionar con obtenerCaptcha de facturas
        cumplimientoObtenerCaptcha: async () =>
            ipcRenderer.invoke('cumplimiento-obtener-captcha'),

        obtenerOpinion: async (data: { captcha?: string }) =>
            ipcRenderer.invoke('cumplimiento-obtener-opinion', data),

        cerrarSesion: async () =>
            ipcRenderer.invoke('cumplimiento-cerrar-sesion'),

        onProgresoCumplimiento: (callback: (mensaje: string) => void) => {
            ipcRenderer.on('progreso-cumplimiento', (_, mensaje) => callback(mensaje))
        },
        // ✅ Eliminados los constancia* duplicados — ya viven en createConstanciaApi
    }
}