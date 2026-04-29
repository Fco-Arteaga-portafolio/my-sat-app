import { ipcMain, dialog } from 'electron'
import { FacturaRepository } from '../database/repositories/FacturaRepository'
import BetterSqlite3 from 'better-sqlite3'

export interface FiltersExportacion {
    tipoDescarga: 'emitida' | 'recibida'
    tiposComprobante: string[]
    fechaDesde: string
    fechaHasta: string
}

export class ExportacionHandler {
    private facturaRepository: FacturaRepository

    constructor(db: BetterSqlite3.Database) {
        this.facturaRepository = new FacturaRepository(db)
    }

    registrar(): void {
        /**
         * Obtiene facturas con preview para exportación
         */
        ipcMain.handle('exportacion-obtener-preview', async (_, filtros: FiltersExportacion) => {
            try {
                // Obtener facturas usando el repositorio
                const facturas = this.facturaRepository.obtenerPorTipoDescarga(
                    filtros.tipoDescarga,
                    {
                        tiposComprobante: filtros.tiposComprobante && filtros.tiposComprobante.length > 0 ? filtros.tiposComprobante : undefined,
                        fechaDesde: filtros.fechaDesde,
                        fechaHasta: filtros.fechaHasta
                    }
                ) as any[]

                console.log('Facturas obtenidas:', facturas.length)
                console.log('Primer factura:', facturas[0])

                // Calcular totales
                const totales = {
                    cantidad_cfdis: facturas.length,
                    subtotal: facturas.reduce((s, f) => s + (parseFloat(f.subtotal) || 0), 0),
                    descuentos: facturas.reduce((s, f) => s + (parseFloat(f.descuento) || 0), 0),
                    iva_trasladado: facturas.reduce((s, f) => s + (parseFloat(f.total_impuestos_trasladados) || 0), 0),
                    total_impuestos_retenidos: facturas.reduce((s, f) => s + (parseFloat(f.total_impuestos_retenidos) || 0), 0),
                    total_general: facturas.reduce((s, f) => s + (parseFloat(f.total) || 0), 0)
                }

                console.log('Totales calculados:', totales)

                return {
                    success: true,
                    datos: facturas.map(f => ({
                        uuid: f.uuid,
                        serie: f.serie || '',
                        folio: f.folio || '',
                        fecha_emision: f.fecha_emision,
                        tipo_comprobante: this.mapearTipoComprobante(f.tipo_comprobante),
                        rfc_emisor: f.rfc_emisor,
                        nombre_emisor: f.nombre_emisor,
                        rfc_receptor: f.rfc_receptor,
                        nombre_receptor: f.nombre_receptor,
                        subtotal: parseFloat(f.subtotal) || 0,
                        descuento: parseFloat(f.descuento) || 0,
                        total_impuestos_trasladados: parseFloat(f.total_impuestos_trasladados) || 0,
                        total_impuestos_retenidos: parseFloat(f.total_impuestos_retenidos) || 0,
                        total: parseFloat(f.total) || 0,
                        moneda: f.moneda || 'MXN',
                        forma_pago: f.forma_pago || '',
                        metodo_pago: f.metodo_pago || '',
                        estado: f.estado
                    })),
                    cantidad: facturas.length,
                    totales
                }
            } catch (error) {
                console.error('Error en preview:', error)
                return { success: false, error: String(error) }
            }
        })

        /**
         * Genera y guarda archivo Excel
         */
        ipcMain.handle('exportacion-generar-excel', async (_event, datos: { filtros: FiltersExportacion; rutaDestino: string }) => {
            try {
                // Obtener facturas
                const facturas = this.facturaRepository.obtenerPorTipoDescarga(
                    datos.filtros.tipoDescarga,
                    {
                        tiposComprobante: datos.filtros.tiposComprobante && datos.filtros.tiposComprobante.length > 0 ? datos.filtros.tiposComprobante : undefined,
                        fechaDesde: datos.filtros.fechaDesde,
                        fechaHasta: datos.filtros.fechaHasta
                    }
                ) as any[]

                if (facturas.length === 0) {
                    return { success: false, error: 'No hay facturas para exportar' }
                }

                const XLSX = require('xlsx')

                // Preparar datos
                const datosExcel = facturas.map(f => ({
                    'UUID': f.uuid,
                    'Serie': f.serie || '',
                    'Folio': f.folio || '',
                    'Fecha': f.fecha_emision,
                    'Tipo': this.mapearTipoComprobante(f.tipo_comprobante),
                    'RFC Emisor': f.rfc_emisor,
                    'Nombre Emisor': f.nombre_emisor,
                    'RFC Receptor': f.rfc_receptor,
                    'Nombre Receptor': f.nombre_receptor,
                    'Subtotal': parseFloat(f.subtotal) || 0,
                    'Descuento': parseFloat(f.descuento) || 0,
                    'IVA Trasladado': parseFloat(f.total_impuestos_trasladados) || 0,
                    'ISR Retenido': parseFloat(f.total_impuestos_retenidos) || 0,
                    'Total': parseFloat(f.total) || 0,
                    'Moneda': f.moneda || 'MXN',
                    'Forma Pago': f.forma_pago || '',
                    'Método Pago': f.metodo_pago || '',
                    'Estado': f.estado
                }))

                // Crear workbook
                const ws = XLSX.utils.json_to_sheet(datosExcel)
                ws['!cols'] = [
                    { wch: 36 }, // UUID
                    { wch: 8 },  // Serie
                    { wch: 8 },  // Folio
                    { wch: 12 }, // Fecha
                    { wch: 10 }, // Tipo
                    { wch: 12 }, // RFC Emisor
                    { wch: 20 }, // Nombre Emisor
                    { wch: 12 }, // RFC Receptor
                    { wch: 20 }, // Nombre Receptor
                    { wch: 12 }, // Subtotal
                    { wch: 12 }, // Descuento
                    { wch: 14 }, // IVA Trasladado
                    { wch: 14 }, // ISR Retenido
                    { wch: 12 }, // Total
                    { wch: 8 },  // Moneda
                    { wch: 12 }, // Forma Pago
                    { wch: 12 }, // Método Pago
                    { wch: 10 }  // Estado
                ]

                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, 'Facturas')
                XLSX.writeFile(wb, datos.rutaDestino)

                return { success: true, cantidad: facturas.length }
            } catch (error) {
                console.error('Error generando Excel:', error)
                return { success: false, error: String(error) }
            }
        })

        /**
         * Obtiene tipos de CFDI disponibles
         */
        ipcMain.handle('exportacion-obtener-tipos-cfdi', () => {
            try {
                return {
                    success: true,
                    tipos: [
                        { code: 'I', label: 'Ingreso' },
                        { code: 'E', label: 'Egreso' },
                        { code: 'N', label: 'Nómina' },
                        { code: 'P', label: 'Pago' },
                        { code: 'T', label: 'Traslado' }
                    ]
                }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })

        /**
         * Abre el diálogo para seleccionar carpeta destino
         */
        ipcMain.handle('exportacion-seleccionar-carpeta', async () => {
            try {
                const result = await dialog.showSaveDialog({
                    title: 'Guardar Excel como',
                    defaultPath: `Exportacion_${new Date().toISOString().split('T')[0]}.xlsx`,
                    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
                })
                return { success: true, ...result }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })
    }

    /**
     * Mapea código de tipo de comprobante a descripción
     */
    private mapearTipoComprobante(tipo: string): string {
        const mapeo: { [key: string]: string } = {
            'I': 'Ingreso',
            'E': 'Egreso',
            'T': 'Traslado',
            'N': 'Nómina',
            'P': 'Pago'
        }
        return mapeo[tipo] || tipo
    }
}
