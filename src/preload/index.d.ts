import { ParametrosBusqueda } from '../main/scraper/SatTypes'
import { Configuracion } from '../main/services/ConfiguracionService'
import { ElectronAPI } from '@electron-toolkit/preload'

export { }
interface OpinionCumplimiento {
  resultado: 'positivo' | 'negativo' | 'unknown'
  fecha_emision: string
  fecha_vigencia?: string
  descripcion: string
  rutaArchivo?: string
}

interface ConstanciaSituacionFiscal {
  rfc: string
  nombre?: string
  regimenes?: string[]
  fecha_emision: string
  rutaArchivo?: string
  descripcion: string
}
declare global {
  interface Window {
    electron: ElectronAPI
    electronUpdater: {
      onStatus: (callback: (status: string) => void) => void
      onProgress: (callback: (percent: number) => void) => void
      install: () => void
      postpone: () => void
      download: () => void
    }
    appInfo: {
      getVersion(): Promise<string>
    }
    api: {
      // Catálogo
      catalogoObtener(tipo: string): Promise<any>
      catalogoObtenerPorRfc(tipo: string, rfc: string): Promise<any>
      catalogoActualizar(tipo: string, rfc: string, datos: any): Promise<any>
      catalogoSincronizar(): Promise<any>

      // Conciliación
      iniciarConciliacion(params: any): Promise<{ success: boolean; resumen?: any; error?: string }>
      obtenerUltimaConciliacion(params: { tipo: string; ejercicio: string; periodo: string }): Promise<{ success: boolean; ultima?: any; error?: string }>
      obtenerHistorialConciliaciones(): Promise<{ success: boolean; historial?: any[]; error?: string }>
      onProgresoConciliacion(callback: (progreso: any) => void): void

      // Configuración
      guardarConfiguracion(config: Configuracion): Promise<{ success: boolean; error?: string }>
      obtenerConfiguracion(): Promise<{ success: boolean; config?: Configuracion; error?: string }>
      limpiarConfiguracion(): Promise<{ success: boolean; error?: string }>
      seleccionarArchivo(filtros: Electron.FileFilter[]): Promise<{ success: boolean; ruta?: string }>
      seleccionarCarpeta(): Promise<{ success: boolean; ruta?: string }>

      // Dashboard
      dashboardKpis(año: number, mes: number): Promise<any>
      dashboardFlujoAnual(año: number): Promise<any>
      dashboardTopProveedores(año: number, mes: number): Promise<any>
      dashboardTopClientes(año: number, mes: number): Promise<any>
      obtenerConteos(): Promise<{ success: boolean; data?: { recibidas: number; emitidas: number; nomina: number; pagos: number }; error?: string }>
      reportesIvaAnual(año: number): Promise<{ success: boolean; data?: any[]; error?: string }>
      reportesIsrAnual(año: number, regimen: string): Promise<{ success: boolean; data?: any; error?: string }>
      reportesDetalleMes(año: number, mes: number): Promise<{ success: boolean; data?: any[]; error?: string }>
      cfdiTogglePagado(uuid: string, pagado: boolean): Promise<{ success: boolean; error?: string }>
      reportesDetectarRegimen(): Promise<{ success: boolean; data?: string | null; error?: string }>

      // Factura
      descargarFacturas(datos: { captcha?: string; params: ParametrosBusqueda }): Promise<{ success: boolean; total?: number; errores?: { uuid: string; error: string }[]; error?: string }>
      obtenerFacturas(): Promise<{ success: boolean; facturas?: import('../renderer/src/types/FacturaDto').FacturaDto[]; error?: string }>
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
      eliminarFactura(uuid: string): Promise<{ success: boolean; error?: string }>
      obtenerCaptcha(): Promise<{ success: boolean; imagenBase64?: string; error?: string }>
      reintentarPendientes(datos: { captcha?: string }): Promise<{ success: boolean; total?: number; errores?: any[]; error?: string }>
      obtenerPendientes(): Promise<{ success: boolean; pendientes?: any[]; error?: string }>
      contarPendientes(): Promise<{ success: boolean; total?: number; error?: string }>
      limpiarPendientes(): Promise<{ success: boolean; error?: string }>
      leerXml(ruta: string): Promise<{ success: boolean; contenido?: string; error?: string }>
      obtenerPdfFactura(datos: any): Promise<any>
      generarPdf(datos: { xmlContenido: string; parseada: any; uuid: string; plantilla: string; rutaDestino: string }): Promise<{ success: boolean; error?: string }>
      imprimirPdf(): Promise<{ success: boolean; error?: string }>
      facturasDrillDown(rfc: string): Promise<any>
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
      onProgresoDescarga(callback: (progreso: any) => void): void

      // Importación
      seleccionarXmls(): Promise<{ success: boolean; rutas: string[] }>
      seleccionarCarpetaXml(): Promise<{ success: boolean; rutas: string[] }>
      importarXmls(rutas: string[]): Promise<{ success: boolean; importadas: number; omitidas: number; errores: any[] }>

      // Perfil
      obtenerPerfiles(): Promise<{ success: boolean; perfiles?: any[]; error?: string }>
      crearPerfil(perfil: any): Promise<{ success: boolean; error?: string }>
      eliminarPerfil(rfc: string): Promise<{ success: boolean; error?: string }>
      seleccionarPerfil(rfc: string): Promise<{ success: boolean; perfil?: any; error?: string }>
      obtenerPerfilActivo(): Promise<{ success: boolean; perfil?: any; error?: string }>
      cerrarPerfil(): Promise<any>

      // Misc
      abrirArchivo(ruta: string): Promise<void>

      // Licencia
      obtenerLicencia(): Promise<{ success: boolean; licencia?: any; error?: string }>
      obtenerEstadoLicencia(): Promise<{ success: boolean; estado?: 'Demo' | 'Vigente' | 'Vencido'; error?: string }>
      validarAgregarRfc(): Promise<{ success: boolean; valido?: boolean; motivo?: string; error?: string }>
      validarRegistrarMaquina(): Promise<{ success: boolean; valido?: boolean; motivo?: string; error?: string }>
      validarDescargaCfdi(): Promise<{ success: boolean; valido?: boolean; motivo?: string; usos_restantes?: number; error?: string }>
      incrementarDescargaCfdi(): Promise<{ success: boolean; error?: string }>
      validarImportacionCfdi(): Promise<{ success: boolean; valido?: boolean; motivo?: string; usos_restantes?: number; error?: string }>
      incrementarImportacionCfdi(): Promise<{ success: boolean; error?: string }>
      validarConsolidacion(): Promise<{ success: boolean; valido?: boolean; motivo?: string; usos_restantes?: number; error?: string }>
      incrementarConsolidacion(): Promise<{ success: boolean; error?: string }>

      // Exportación
      obtenerPreview(filtros: {
        tipoDescarga: 'emitida' | 'recibida'
        tiposComprobante: string[]
        fechaDesde: string
        fechaHasta: string
      }): Promise<{ success: boolean; datos?: any[]; cantidad?: number; totales?: any; error?: string }>
      generarExcel(filtros: {
        tipoDescarga: 'emitida' | 'recibida'
        tiposComprobante: string[]
        fechaDesde: string
        fechaHasta: string
      }, rutaDestino: string): Promise<{ success: boolean; cantidad?: number; error?: string }>
      obtenerTiposCfdi(): Promise<{ success: boolean; tipos?: any[]; error?: string }>
      seleccionarCarpetaDestino(): Promise<{ canceled?: boolean; filePath?: string }>


      // Cumplimiento
      cumplimientoObtenerCaptcha(): Promise<{ success: boolean; data: { imagenBase64: string }; error?: string }>
      obtenerOpinion(data: { captcha?: string }): Promise<{ success: boolean; data: OpinionCumplimiento; error?: string }>
      cerrarSesion(): Promise<{ success: boolean }>
      onProgresoCumplimiento(callback: (mensaje: string) => void): void

      // Constancia Situación Fiscal
      constanciaObtenerCaptcha(): Promise<{ success: boolean; data: { imagenBase64: string }; error?: string }>
      constanciaObtenerConstancia(data: { captcha?: string }): Promise<{ success: boolean; data: ConstanciaSituacionFiscal; error?: string }>
      constanciaCerrarSesion(): Promise<{ success: boolean }>
      onProgresoConstancia(callback: (mensaje: string) => void): void

      // Radar 69-B
      lista69bSincronizar(): Promise<{ success: boolean; data?: { total: number }; error?: string }>
      lista69bAnalizar(): Promise<{ success: boolean; data?: Radar69BAnalisis; error?: string }>
      lista69bObtenerMeta(): Promise<{ success: boolean; data?: { ultima_sync: string | null; total_registros: number }; error?: string }>
      onProgresoLista69B(callback: (mensaje: string) => void): void

      // Soporte
      enviarTicketSoporte(datos: {
        tipo: string
        asunto: string
        descripcion: string
        email: string
      }): Promise<{ success: boolean; folio?: string; error?: string }>

      //pagos
      comprarLicencia(datos: {
        plan: string
        nombre: string
        email: string
        rfc: string
        metodoPago: string
        tarjeta?: {
          numero: string
          vencimiento: string
          cvv: string
          titular: string
        }
      }): Promise<{ success: boolean; licenseKey?: string; error?: string }>

      activarLicencia(datos: {
        licenseKey: string
        rfc: string
      }): Promise<{ success: boolean; error?: string }>
    }
  }
}