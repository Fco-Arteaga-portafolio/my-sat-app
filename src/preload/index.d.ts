import { ElectronAPI } from '@electron-toolkit/preload'
import { ParametrosBusqueda } from '../main/scraper/SatScraper'
import { Factura } from '../main/database/repositories/FacturaRepository'
import { Configuracion } from '../main/services/ConfiguracionService'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {}
    descargarFacturas: (datos: { captcha?: string; params: ParametrosBusqueda }) =>
      Promise<{ success: boolean; total?: number; errores?: { uuid: string; error: string }[]; error?: string }>
    obtenerFacturas: () => Promise<{ success: boolean; facturas?: Factura[]; error?: string }>
    eliminarFactura: (uuid: string) => Promise<{ success: boolean; error?: string }>
    guardarConfiguracion: (config: Configuracion) => Promise<{ success: boolean; error?: string }>
    obtenerConfiguracion: () => Promise<{ success: boolean; config?: Configuracion; error?: string }>
    limpiarConfiguracion: () => Promise<{ success: boolean; error?: string }>
    seleccionarArchivo: (filtros: Electron.FileFilter[]) => Promise<{ success: boolean; ruta?: string }>
    seleccionarCarpeta: () => Promise<{ success: boolean; ruta?: string }>
    obtenerCaptcha: () => Promise<{ success: boolean; imagenBase64?: string; error?: string }>
    abrirArchivo: (ruta: string) => Promise<void>
    leerXml: (ruta: string) => Promise<{ success: boolean; contenido?: string; error?: string }>
    generarPdf: (datos: { xmlContenido: string; parseada: any; uuid: string; plantilla: string; rutaDestino: string }) =>
      Promise<{ success: boolean; error?: string }>
    onProgresoDescarga: (callback: (progreso: any) => void) => void
    obtenerPendientes: () => Promise<{ success: boolean; pendientes?: any[]; error?: string }>
    contarPendientes: () => Promise<{ success: boolean; total?: number; error?: string }>
    limpiarPendientes: () => Promise<{ success: boolean; error?: string }>
    obtenerPerfiles: () => Promise<{ success: boolean; perfiles?: any[]; error?: string }>
    crearPerfil: (perfil: any) => Promise<{ success: boolean; error?: string }>
    eliminarPerfil: (rfc: string) => Promise<{ success: boolean; error?: string }>
    seleccionarPerfil: (rfc: string) => Promise<{ success: boolean; perfil?: any; error?: string }>
    obtenerPerfilActivo: () => Promise<{ success: boolean; perfil?: any; error?: string }>
    reintentarPendientes: (datos: { captcha?: string }) => Promise<{ success: boolean; total?: number; errores?: any[]; error?: string }>
    cerrarPerfil(): Promise<any>
    seleccionarXmls(): Promise<{ success: boolean; rutas: string[] }>
    seleccionarCarpetaXml(): Promise<{ success: boolean; rutas: string[] }>
    importarXmls(rutas: string[]): Promise<{ success: boolean; importadas: number; omitidas: number; errores: any[] }>
  }
}
