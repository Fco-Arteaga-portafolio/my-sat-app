import { ipcRenderer } from 'electron'
import { ParametrosBusqueda } from '../main/scraper/SatTypes'

export const createFacturaApi = () => {
    return {
        descargarFacturas: (datos: { captcha?: string; params: ParametrosBusqueda }) =>
            ipcRenderer.invoke('descargar-facturas', datos),
        obtenerFacturas: () => ipcRenderer.invoke('obtener-facturas'),
        obtenerFacturasPorTipo: (datos: {
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
        }) => ipcRenderer.invoke('obtener-facturas-por-tipo', datos),
        eliminarFactura: (uuid: string) => ipcRenderer.invoke('eliminar-factura', uuid),
        obtenerCaptcha: () => ipcRenderer.invoke('obtener-captcha'),
        reintentarPendientes: (datos: { captcha?: string }) => ipcRenderer.invoke('reintentar-pendientes', datos),
        obtenerPendientes: () => ipcRenderer.invoke('obtener-pendientes'),
        contarPendientes: () => ipcRenderer.invoke('contar-pendientes'),
        limpiarPendientes: () => ipcRenderer.invoke('limpiar-pendientes'),
        leerXml: (ruta: string) => ipcRenderer.invoke('leer-xml', ruta),
        obtenerPdfFactura: (datos: any) => ipcRenderer.invoke('obtener-pdf-factura', datos),
        generarPdf: (datos: { xmlContenido: string; parseada: any; uuid: string; plantilla: string; rutaDestino: string }) =>
            ipcRenderer.invoke('generar-pdf', datos),
        imprimirPdf: () => ipcRenderer.invoke('imprimir-pdf'),
        facturasDrillDown: (rfc: string) => ipcRenderer.invoke('facturas-drill-down', rfc),
        obtenerPagoComplemento: (uuid_rep: string) =>
            ipcRenderer.invoke('obtener-pago-complemento', uuid_rep),
        onProgresoDescarga: (callback: (progreso: any) => void) => {
            ipcRenderer.on('progreso-descarga', (_, progreso) => callback(progreso))
        },
    }
}
