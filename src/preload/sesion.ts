import { ipcRenderer } from 'electron'

export interface ResumenSincronizadoUi {
  usoIlimitado: boolean
  rfcs: Array<{
    id: string
    rfc: string
    alias: string
    activo: boolean
    precioPagado: number
  }>
  contadores: Array<{
    modulo: string
    rfc: string
    usos: number
    limite: number
    restantes: number
  }>
}

export interface SesionApi {
  obtenerEstadoSesion: () => Promise<{ success: boolean; iniciada?: boolean; error?: string }>
  renovarSesion: () => Promise<{
    success: boolean
    iniciada?: boolean
    nombre?: string
    email?: string
    error?: string
  }>
  iniciarSesion: (
    email: string,
    password: string
  ) => Promise<{
    success: boolean
    iniciada?: boolean
    nombre?: string
    email?: string
    error?: string
  }>
  cerrarSesion: () => Promise<{ success: boolean; error?: string }>
  obtenerCuenta: () => Promise<{
    success: boolean
    cuenta?: { nombre: string; email: string } | null
    error?: string
  }>
  onTokenRechazado: (callback: () => void) => void
  abrirTienda: () => Promise<{ success: boolean; error?: string }>
  sincronizarResumen: () => Promise<{
    success: boolean
    resumen?: ResumenSincronizadoUi
    sincronizado?: string
    error?: string
  }>
}

export const createSesionApi = (): SesionApi => {
  return {
    obtenerEstadoSesion: () => ipcRenderer.invoke('obtener-estado-sesion'),
    renovarSesion: () => ipcRenderer.invoke('renovar-sesion'),
    iniciarSesion: (email: string, password: string) =>
      ipcRenderer.invoke('iniciar-sesion', { email, password }),
    cerrarSesion: () => ipcRenderer.invoke('cerrar-sesion'),
    obtenerCuenta: () => ipcRenderer.invoke('obtener-cuenta'),
    onTokenRechazado: (callback: () => void) => {
      ipcRenderer.on('sesion-token-rechazado', () => callback())
    },
    abrirTienda: () => ipcRenderer.invoke('abrir-tienda'),
    sincronizarResumen: () => ipcRenderer.invoke('sincronizar-resumen')
  }
}
