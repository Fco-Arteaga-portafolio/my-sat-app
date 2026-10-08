import { ipcRenderer } from 'electron'
import type { Perfil } from '../main/database/ProfileManager'

/** RFC de la cuenta (ProductoRfc) que llega en el resumen de licencia. */
export interface RfcCuentaUi {
  id: string
  rfc: string
  alias: string
  fechaAlta: string
  activo: boolean
  precioPagado: number
}

/** Estado del gate "Agregar contribuyente" (regla estricta del producto RFC). */
export interface EstadoAgregarRfcUi {
  success: boolean
  puedeAgregar?: boolean
  motivo?: string
  rfcs?: RfcCuentaUi[]
  error?: string
}

export function createPerfilApi(): {
  obtenerPerfiles: () => Promise<{ success: boolean; perfiles?: Perfil[]; error?: string }>
  obtenerEstadoAgregarRfc: () => Promise<EstadoAgregarRfcUi>
  crearPerfil: (perfil: Perfil) => Promise<{
    success: boolean
    id?: string
    rfc?: string
    yaExistia?: boolean
    error?: string
  }>
  eliminarPerfil: (rfc: string) => Promise<{ success: boolean; error?: string }>
  seleccionarPerfil: (rfc: string) => Promise<{ success: boolean; perfil?: Perfil; error?: string }>
  obtenerPerfilActivo: () => Promise<{ success: boolean; perfil?: Perfil | null; error?: string }>
  cerrarPerfil: () => Promise<{ success: boolean }>
} {
  return {
    obtenerPerfiles: (): Promise<{ success: boolean; perfiles?: Perfil[]; error?: string }> =>
      ipcRenderer.invoke('obtener-perfiles'),

    /**
     * Regla estricta: el alta de contribuyente solo está habilitado si la cuenta
     * compró el producto RFC. `rfcs` trae los RFCs de la cuenta sincronizados
     * (los agregados desde Emite también aparecen).
     */
    obtenerEstadoAgregarRfc: (): Promise<EstadoAgregarRfcUi> =>
      ipcRenderer.invoke('obtener-estado-agregar-rfc'),

    /**
     * Alta de contribuyente: el Desktop registra el RFC en la cuenta (POST
     * /rfcs) y solo si el backend lo acepta crea el perfil local.
     */
    crearPerfil: (
      perfil: Perfil
    ): Promise<{
      success: boolean
      id?: string
      rfc?: string
      yaExistia?: boolean
      error?: string
    }> => ipcRenderer.invoke('crear-perfil', perfil),

    eliminarPerfil: (rfc: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('eliminar-perfil', rfc),

    seleccionarPerfil: (
      rfc: string
    ): Promise<{ success: boolean; perfil?: Perfil; error?: string }> =>
      ipcRenderer.invoke('seleccionar-perfil', rfc),

    obtenerPerfilActivo: (): Promise<{
      success: boolean
      perfil?: Perfil | null
      error?: string
    }> => ipcRenderer.invoke('obtener-perfil-activo'),

    cerrarPerfil: (): Promise<{ success: boolean }> => ipcRenderer.invoke('cerrar-perfil')
  }
}
