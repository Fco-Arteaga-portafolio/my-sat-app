import { ParametrosBusqueda } from '../main/scraper/SatTypes'
import { Configuracion } from '../main/services/ConfiguracionService'
import { ElectronAPI } from '@electron-toolkit/preload'

export { }

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      descargarFacturas(datos: { captcha?: string; params: ParametrosBusqueda }): Promise<{ success: boolean; total?: number; errores?: { uuid: string; error: string }[]; error?: string }>
      obtenerFacturas(): Promise<{ success: boolean; facturas?: import('../renderer/src/types/FacturaDto').FacturaDto[]; error?: string }>
      eliminarFactura(uuid: string): Promise<{ success: boolean; error?: string }>
      guardarConfiguracion(config: Configuracion): Promise<{ success: boolean; error?: string }>
      obtenerConfiguracion(): Promise<{ success: boolean; config?: Configuracion; error?: string }>
      limpiarConfiguracion(): Promise<{ success: boolean; error?: string }>
      seleccionarArchivo(filtros: Electron.FileFilter[]): Promise<{ success: boolean; ruta?: string }>
      seleccionarCarpeta(): Promise<{ success: boolean; ruta?: string }>
      obtenerCaptcha(): Promise<{ success: boolean; imagenBase64?: string; error?: string }>
      abrirArchivo(ruta: string): Promise<void>
      leerXml(ruta: string): Promise<{ success: boolean; contenido?: string; error?: string }>
      generarPdf(datos: { xmlContenido: string; parseada: any; uuid: string; plantilla: string; rutaDestino: string }): Promise<{ success: boolean; error?: string }>
      onProgresoDescarga(callback: (progreso: any) => void): void
      obtenerPendientes(): Promise<{ success: boolean; pendientes?: any[]; error?: string }>
      contarPendientes(): Promise<{ success: boolean; total?: number; error?: string }>
      limpiarPendientes(): Promise<{ success: boolean; error?: string }>
      reintentarPendientes(datos: { captcha?: string }): Promise<{ success: boolean; total?: number; errores?: any[]; error?: string }>
      obtenerPerfiles(): Promise<{ success: boolean; perfiles?: any[]; error?: string }>
      crearPerfil(perfil: any): Promise<{ success: boolean; error?: string }>
      eliminarPerfil(rfc: string): Promise<{ success: boolean; error?: string }>
      seleccionarPerfil(rfc: string): Promise<{ success: boolean; perfil?: any; error?: string }>
      obtenerPerfilActivo(): Promise<{ success: boolean; perfil?: any; error?: string }>
      cerrarPerfil(): Promise<any>
      seleccionarXmls(): Promise<{ success: boolean; rutas: string[] }>
      seleccionarCarpetaXml(): Promise<{ success: boolean; rutas: string[] }>
      importarXmls(rutas: string[]): Promise<{ success: boolean; importadas: number; omitidas: number; errores: any[] }>
      dashboardKpis(año: number, mes: number): Promise<any>
      dashboardFlujoAnual(año: number): Promise<any>
      dashboardTopProveedores(año: number, mes: number): Promise<any>
      dashboardTopClientes(año: number, mes: number): Promise<any>
      obtenerConteos(): Promise<{ success: boolean; data?: { recibidas: number; emitidas: number; nomina: number; pagos: number }; error?: string }>
      catalogoObtener(tipo: string): Promise<any>
      catalogoObtenerPorRfc(tipo: string, rfc: string): Promise<any>
      catalogoActualizar(tipo: string, rfc: string, datos: any): Promise<any>
      catalogoSincronizar(): Promise<any>
      facturasDrillDown(rfc: string): Promise<any>
      obtenerPdfFactura(datos: any): Promise<any>
      imprimirPdf(): Promise<{ success: boolean; error?: string }>
      iniciarConciliacion(params: any): Promise<{ success: boolean; resumen?: any; error?: string }>
      onProgresoConciliacion(callback: (progreso: any) => void): void
      obtenerUltimaConciliacion(params: { tipo: string; ejercicio: string; periodo: string }): Promise<{ success: boolean; ultima?: any; error?: string }>
      obtenerHistorialConciliaciones(): Promise<{ success: boolean; historial?: any[]; error?: string }>
      reportesIvaAnual(año: number): Promise<{ success: boolean; data?: any[]; error?: string }>
      obtenerFacturasPorTipo(datos: {
        tipoDescarga: 'recibida' | 'emitida'
        filtros?: {
          busqueda?: string
          fechaDesde?: string
          fechaHasta?: string
          rfcContraparte?: string
          tipoComprobante?: string
          tiposComprobante?: string[]
          formaPago?: string
          metodoPago?: string
          estado?: string
        }
      }): Promise<{ success: boolean; facturas?: import('../renderer/src/types/FacturaDto').FacturaDto[]; error?: string }>
      obtenerPagoComplemento(uuid_rep: string): Promise<{
        success: boolean
        pago?: {
          uuid_rep: string
          fecha_pago: string
          forma_pago_p: string
          moneda_p: string
          tipo_cambio_p: number
          monto: number
          documentos: {
            id_documento: string
            serie: string
            folio: string
            moneda_dr: string
            tipo_cambio_dr: number
            metodo_pago_dr: string
            num_parcialidad: number
            imp_saldo_anterior: number
            imp_pagado: number
            imp_saldo_insoluto: number
          }[]
        } | null
        error?: string
      }>
    }
  }
}