import { ipcRenderer } from 'electron'

export const createCumplimientoApi = () => {
    return {
        // ✅ Renombrado para no colisionar con obtenerCaptcha de facturas
        cumplimientoObtenerCaptcha: async () =>
            ipcRenderer.invoke('cumplimiento-obtener-captcha'),

        obtenerOpinion: async (data: { captcha?: string }) =>
            ipcRenderer.invoke('cumplimiento-obtener-opinion', data),

        // Nota: NO se llama "cerrarSesion" — createSesionApi() se mezcla después en
        // window.api y su "cerrarSesion" (logout de la APP) pisaba este. Ese choque
        // cerraba la sesión del usuario en vez del navegador SAT.
        cumplimientoCerrarSesion: async () =>
            ipcRenderer.invoke('cumplimiento-cerrar-sesion'),

        onProgresoCumplimiento: (callback: (mensaje: string) => void) => {
            ipcRenderer.on('progreso-cumplimiento', (_, mensaje) => callback(mensaje))
        },
        // ✅ Eliminados los constancia* duplicados — ya viven en createConstanciaApi
    }
}