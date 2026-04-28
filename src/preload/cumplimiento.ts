import { ipcRenderer } from 'electron'

interface OpinionCumplimiento {
    resultado: 'positivo' | 'negativo' | 'unknown'
    fecha_emision: string
    fecha_vigencia?: string
    descripcion: string
    rutaArchivo?: string
}

export const createCumplimientoApi = () => {
    return {
        obtenerCaptcha: async () =>
            ipcRenderer.invoke('cumplimiento-obtener-captcha'),

        obtenerOpinion: async (data: { captcha?: string }) =>
            ipcRenderer.invoke('cumplimiento-obtener-opinion', data),

        cerrarSesion: async () =>
            ipcRenderer.invoke('cumplimiento-cerrar-sesion'),

        onProgresoCumplimiento: (callback: (mensaje: string) => void) => {
            ipcRenderer.on('progreso-cumplimiento', (_, mensaje) => callback(mensaje))
        },

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
