import * as xml2js from 'xml2js'
import * as ExcelJS from 'exceljs'
import { Factura } from '../database/repositories/FacturaRepository'

export interface FiltersExportacion {
    tipoDescarga: 'emitida' | 'recibida'
    tiposComprobante: string[] // 'I' | 'E' | 'N' | 'P' | 'T'
    fechaDesde: string
    fechaHasta: string
}

export interface DatosExportacion {
    uuid: string
    serie?: string
    folio?: string
    fecha_emision: string
    tipo_comprobante: string
    motivo_comprobante?: string

    // Emisor
    rfc_emisor: string
    nombre_emisor: string

    // Receptor
    rfc_receptor: string
    nombre_receptor: string

    // Totales
    subtotal: number
    descuento: number
    total_impuestos_trasladados: number
    total_impuestos_retenidos: number
    total: number

    // Impuestos trasladados
    iva_traslado?: number
    ieps_traslado?: number
    otros_traslados?: number

    // Impuestos retenidos
    isr_retenido?: number
    iva_retenido?: number
    ieps_retenido?: number
    otros_retenidos?: number

    // Conceptos (desglose)
    conceptos: ConceptoExportacion[]

    // Campos adicionales
    moneda?: string
    tipo_cambio?: number
    forma_pago?: string
    metodo_pago?: string
    estado: string

    [key: string]: any
}

export interface ConceptoExportacion {
    clave_producto: string
    descripcion: string
    cantidad: number
    unidad: string
    precio_unitario: number
    importe: number
    descuento_concepto?: number
    impuestos_trasladados: number
    impuestos_retenidos: number
}

export class ExportacionExcelService {
    private xmlParser = new xml2js.Parser()

    /**
     * Convierte una factura a datos de exportación
     */
    async facturaADatos(factura: Factura): Promise<DatosExportacion> {
        try {
            const xmlData = await this.xmlParser.parseStringPromise(factura.xml)
            const comprobante = xmlData.Comprobante

            const datos: DatosExportacion = {
                uuid: factura.uuid,
                serie: factura.serie,
                folio: factura.folio,
                fecha_emision: factura.fecha_emision,
                tipo_comprobante: this.mapearTipoComprobante(factura.tipo_comprobante),

                rfc_emisor: factura.rfc_emisor,
                nombre_emisor: factura.nombre_emisor,

                rfc_receptor: factura.rfc_receptor,
                nombre_receptor: factura.nombre_receptor,

                subtotal: factura.subtotal || 0,
                descuento: factura.descuento || 0,
                total_impuestos_trasladados: factura.total_impuestos_trasladados || 0,
                total_impuestos_retenidos: factura.total_impuestos_retenidos || 0,
                total: factura.total,

                moneda: factura.moneda || 'MXN',
                tipo_cambio: factura.tipo_cambio || 1,
                forma_pago: factura.forma_pago,
                metodo_pago: factura.metodo_pago,
                estado: factura.estado,

                conceptos: await this.extraerConceptos(comprobante),
                iva_traslado: 0,
                ieps_traslado: 0,
                isr_retenido: 0,
                iva_retenido: 0,
                ieps_retenido: 0
            }

            // Calcular desglose de impuestos
            this.desglosaImpuestos(datos, comprobante)

            return datos
        } catch (error) {
            console.error('Error procesando XML:', error)
            throw new Error(`No se pudo procesar el CFDI ${factura.uuid}`)
        }
    }

    /**
     * Extrae conceptos del XML
     */
    private async extraerConceptos(comprobante: any): Promise<ConceptoExportacion[]> {
        const conceptos: ConceptoExportacion[] = []

        if (!comprobante.Conceptos || !comprobante.Conceptos[0]?.Concepto) {
            return conceptos
        }

        const items = Array.isArray(comprobante.Conceptos[0].Concepto)
            ? comprobante.Conceptos[0].Concepto
            : [comprobante.Conceptos[0].Concepto]

        for (const item of items) {
            conceptos.push({
                clave_producto: item.$.ClaveProdServ || '',
                descripcion: item.$.Descripcion || '',
                cantidad: parseFloat(item.$.Cantidad) || 0,
                unidad: item.$.ClaveUnidad || '',
                precio_unitario: parseFloat(item.$.ValorUnitario) || 0,
                importe: parseFloat(item.$.Importe) || 0,
                descuento_concepto: parseFloat(item.$.Descuento) || 0,
                impuestos_trasladados: 0,
                impuestos_retenidos: 0
            })
        }

        return conceptos
    }

    /**
     * Desglose de impuestos por tipo y tasa
     */
    private desglosaImpuestos(datos: DatosExportacion, comprobante: any): void {
        if (!comprobante.Impuestos || !comprobante.Impuestos[0]) return

        const impuestos = comprobante.Impuestos[0]

        // Impuestos trasladados
        if (impuestos.Traslados && impuestos.Traslados[0]?.Traslado) {
            const traslados = Array.isArray(impuestos.Traslados[0].Traslado)
                ? impuestos.Traslados[0].Traslado
                : [impuestos.Traslados[0].Traslado]

            for (const traslado of traslados) {
                const monto = parseFloat(traslado.$.Importe) || 0
                const tipo = traslado.$.Impuesto

                if (tipo === '002') datos.iva_traslado = (datos.iva_traslado || 0) + monto
                else if (tipo === '003') datos.ieps_traslado = (datos.ieps_traslado || 0) + monto
                else datos.otros_traslados = (datos.otros_traslados || 0) + monto
            }
        }

        // Impuestos retenidos
        if (impuestos.Retenciones && impuestos.Retenciones[0]?.Retencion) {
            const retenciones = Array.isArray(impuestos.Retenciones[0].Retencion)
                ? impuestos.Retenciones[0].Retencion
                : [impuestos.Retenciones[0].Retencion]

            for (const retencion of retenciones) {
                const monto = parseFloat(retencion.$.Importe) || 0
                const tipo = retencion.$.Impuesto

                if (tipo === '001') datos.isr_retenido = (datos.isr_retenido || 0) + monto
                else if (tipo === '002') datos.iva_retenido = (datos.iva_retenido || 0) + monto
                else if (tipo === '003') datos.ieps_retenido = (datos.ieps_retenido || 0) + monto
                else datos.otros_retenidos = (datos.otros_retenidos || 0) + monto
            }
        }
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

    /**
     * Genera archivo Excel a partir de datos
     */
    async generarExcel(datosArray: DatosExportacion[], rutaDestino: string): Promise<void> {
        const workbook = new ExcelJS.Workbook()

        // Hoja 1: Resumen general
        this.crearHojaResumen(workbook, datosArray)

        // Hoja 2: Detalles por CFDI
        this.crearHojaDetalles(workbook, datosArray)

        // Hoja 3: Desglose de conceptos
        this.crearHojaConceptos(workbook, datosArray)

        // Hoja 4: Desglose de impuestos
        this.crearHojaImpuestos(workbook, datosArray)

        await workbook.xlsx.writeFile(rutaDestino)
    }

    /**
     * Crea hoja de resumen general
     */
    private crearHojaResumen(workbook: ExcelJS.Workbook, datos: DatosExportacion[]): void {
        const ws = workbook.addWorksheet('Resumen')

        ws.columns = [
            { header: 'Concepto', key: 'concepto', width: 30 },
            { header: 'Valor', key: 'valor', width: 20 }
        ]

        // Estilos
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } }

        //let row = 2
        const totales = {
            cantidad: datos.length,
            subtotal: datos.reduce((s, d) => s + d.subtotal, 0),
            descuentos: datos.reduce((s, d) => s + d.descuento, 0),
            iva_traslado: datos.reduce((s, d) => s + (d.iva_traslado || 0), 0),
            ieps_traslado: datos.reduce((s, d) => s + (d.ieps_traslado || 0), 0),
            isr_retenido: datos.reduce((s, d) => s + (d.isr_retenido || 0), 0),
            iva_retenido: datos.reduce((s, d) => s + (d.iva_retenido || 0), 0),
            total: datos.reduce((s, d) => s + d.total, 0)
        }

        ws.addRow({ concepto: 'Cantidad de CFDIs', valor: totales.cantidad })
        ws.addRow({ concepto: 'Subtotal', valor: totales.subtotal.toFixed(2) })
        ws.addRow({ concepto: 'Descuentos', valor: totales.descuentos.toFixed(2) })
        ws.addRow({ concepto: 'IVA Trasladado', valor: totales.iva_traslado.toFixed(2) })
        ws.addRow({ concepto: 'IEPS Trasladado', valor: totales.ieps_traslado.toFixed(2) })
        ws.addRow({ concepto: 'ISR Retenido', valor: totales.isr_retenido.toFixed(2) })
        ws.addRow({ concepto: 'IVA Retenido', valor: totales.iva_retenido.toFixed(2) })
        ws.addRow({ concepto: 'Total General', valor: totales.total.toFixed(2) })
    }

    /**
     * Crea hoja de detalles por CFDI
     */
    private crearHojaDetalles(workbook: ExcelJS.Workbook, datos: DatosExportacion[]): void {
        const ws = workbook.addWorksheet('Detalles')

        ws.columns = [
            { header: 'UUID', key: 'uuid', width: 36 },
            { header: 'Serie', key: 'serie', width: 10 },
            { header: 'Folio', key: 'folio', width: 10 },
            { header: 'Fecha Emisión', key: 'fecha_emision', width: 15 },
            { header: 'Tipo', key: 'tipo_comprobante', width: 12 },
            { header: 'RFC Emisor', key: 'rfc_emisor', width: 15 },
            { header: 'Nombre Emisor', key: 'nombre_emisor', width: 30 },
            { header: 'RFC Receptor', key: 'rfc_receptor', width: 15 },
            { header: 'Nombre Receptor', key: 'nombre_receptor', width: 30 },
            { header: 'Subtotal', key: 'subtotal', width: 14 },
            { header: 'Descuento', key: 'descuento', width: 12 },
            { header: 'IVA Trasladado', key: 'iva_traslado', width: 14 },
            { header: 'IEPS Trasladado', key: 'ieps_traslado', width: 14 },
            { header: 'ISR Retenido', key: 'isr_retenido', width: 14 },
            { header: 'IVA Retenido', key: 'iva_retenido', width: 14 },
            { header: 'IEPS Retenido', key: 'ieps_retenido', width: 14 },
            { header: 'Total', key: 'total', width: 14 },
            { header: 'Moneda', key: 'moneda', width: 8 },
            { header: 'Forma Pago', key: 'forma_pago', width: 15 },
            { header: 'Método Pago', key: 'metodo_pago', width: 15 },
            { header: 'Estado', key: 'estado', width: 12 }
        ]

        // Estilos de encabezado
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } }

        // Agregar datos
        for (const dato of datos) {
            ws.addRow({
                uuid: dato.uuid,
                serie: dato.serie || '',
                folio: dato.folio || '',
                fecha_emision: dato.fecha_emision,
                tipo_comprobante: dato.tipo_comprobante,
                rfc_emisor: dato.rfc_emisor,
                nombre_emisor: dato.nombre_emisor,
                rfc_receptor: dato.rfc_receptor,
                nombre_receptor: dato.nombre_receptor,
                subtotal: dato.subtotal,
                descuento: dato.descuento,
                iva_traslado: dato.iva_traslado || 0,
                ieps_traslado: dato.ieps_traslado || 0,
                isr_retenido: dato.isr_retenido || 0,
                iva_retenido: dato.iva_retenido || 0,
                ieps_retenido: dato.ieps_retenido || 0,
                total: dato.total,
                moneda: dato.moneda,
                forma_pago: dato.forma_pago || '',
                metodo_pago: dato.metodo_pago || '',
                estado: dato.estado
            })
        }

        // Formato de moneda para columnas numéricas
        for (let row = 2; row <= datos.length + 1; row++) {
            ws.getCell(`J${row}`).numFmt = '#,##0.00'
            ws.getCell(`K${row}`).numFmt = '#,##0.00'
            ws.getCell(`L${row}`).numFmt = '#,##0.00'
            ws.getCell(`M${row}`).numFmt = '#,##0.00'
            ws.getCell(`N${row}`).numFmt = '#,##0.00'
            ws.getCell(`O${row}`).numFmt = '#,##0.00'
            ws.getCell(`P${row}`).numFmt = '#,##0.00'
            ws.getCell(`Q${row}`).numFmt = '#,##0.00'
        }
    }

    /**
     * Crea hoja de desglose de conceptos
     */
    private crearHojaConceptos(workbook: ExcelJS.Workbook, datos: DatosExportacion[]): void {
        const ws = workbook.addWorksheet('Conceptos')

        ws.columns = [
            { header: 'UUID CFDI', key: 'uuid', width: 36 },
            { header: 'Clave Producto', key: 'clave_producto', width: 15 },
            { header: 'Descripción', key: 'descripcion', width: 40 },
            { header: 'Cantidad', key: 'cantidad', width: 12 },
            { header: 'Unidad', key: 'unidad', width: 10 },
            { header: 'Precio Unitario', key: 'precio_unitario', width: 15 },
            { header: 'Importe', key: 'importe', width: 14 },
            { header: 'Descuento', key: 'descuento', width: 12 },
            { header: 'Impuestos Trasladados', key: 'impuestos_trasladados', width: 18 },
            { header: 'Impuestos Retenidos', key: 'impuestos_retenidos', width: 18 }
        ]

        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } }

        for (const dato of datos) {
            for (const concepto of dato.conceptos) {
                ws.addRow({
                    uuid: dato.uuid,
                    clave_producto: concepto.clave_producto,
                    descripcion: concepto.descripcion,
                    cantidad: concepto.cantidad,
                    unidad: concepto.unidad,
                    precio_unitario: concepto.precio_unitario,
                    importe: concepto.importe,
                    descuento: concepto.descuento_concepto,
                    impuestos_trasladados: concepto.impuestos_trasladados,
                    impuestos_retenidos: concepto.impuestos_retenidos
                })
            }
        }

        // Formato numérico
        for (let row = 2; row <= ws.rowCount; row++) {
            ws.getCell(`E${row}`).numFmt = '#,##0.00'
            ws.getCell(`F${row}`).numFmt = '#,##0.00'
            ws.getCell(`G${row}`).numFmt = '#,##0.00'
            ws.getCell(`H${row}`).numFmt = '#,##0.00'
            ws.getCell(`I${row}`).numFmt = '#,##0.00'
            ws.getCell(`J${row}`).numFmt = '#,##0.00'
        }
    }

    /**
     * Crea hoja de desglose de impuestos
     */
    private crearHojaImpuestos(workbook: ExcelJS.Workbook, datos: DatosExportacion[]): void {
        const ws = workbook.addWorksheet('Impuestos')

        ws.columns = [
            { header: 'Concepto', key: 'concepto', width: 30 },
            { header: 'Tipo', key: 'tipo', width: 15 },
            { header: 'Total', key: 'total', width: 20 }
        ]

        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } }

        // Agrupar impuestos
        const impuestos = {
            'IVA Trasladado': datos.reduce((s, d) => s + (d.iva_traslado || 0), 0),
            'IEPS Trasladado': datos.reduce((s, d) => s + (d.ieps_traslado || 0), 0),
            'ISR Retenido': datos.reduce((s, d) => s + (d.isr_retenido || 0), 0),
            'IVA Retenido': datos.reduce((s, d) => s + (d.iva_retenido || 0), 0),
            'IEPS Retenido': datos.reduce((s, d) => s + (d.ieps_retenido || 0), 0)
        }

        const trasladados = Object.entries(impuestos)
            .filter(([k]) => k.includes('Trasladado'))
            .reduce((s, [, v]) => s + v, 0)

        const retenidos = Object.entries(impuestos)
            .filter(([k]) => k.includes('Retenido'))
            .reduce((s, [, v]) => s + v, 0)

        ws.addRow({ concepto: '--- TRASLADADOS ---', tipo: '', total: '' })
        for (const [concepto, total] of Object.entries(impuestos)) {
            if (concepto.includes('Trasladado')) {
                ws.addRow({ concepto, tipo: '16% / 8%', total: total.toFixed(2) })
            }
        }

        ws.addRow({ concepto: 'Subtotal Trasladados', tipo: '', total: trasladados.toFixed(2) })

        ws.addRow({ concepto: '--- RETENIDOS ---', tipo: '', total: '' })
        for (const [concepto, total] of Object.entries(impuestos)) {
            if (concepto.includes('Retenido')) {
                ws.addRow({ concepto, tipo: '17% / 1.87%', total: total.toFixed(2) })
            }
        }

        ws.addRow({ concepto: 'Subtotal Retenidos', tipo: '', total: retenidos.toFixed(2) })
    }
}
