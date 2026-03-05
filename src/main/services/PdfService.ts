import * as fs from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { FacturaParseada } from '../../renderer/src/utils/xmlParser'
import { regimenFiscal, usoCFDI, formaPago, metodoPago, impuesto, tipoPercepcion, tipoDeduccion, cat } from '../../renderer/src/utils/catalogosSat'
import { BrowserManager } from '../scraper/BrowserManager'

export type Plantilla = 'clasica' | 'moderna' | 'minimalista'

export class PdfService {

    async generarPdf(
        _xmlContenido: string,
        parseada: FacturaParseada,
        uuid: string,
        plantilla: Plantilla,
        rutaDestino: string
    ): Promise<void> {
        const html = this.construirHtml(parseada, uuid, plantilla)
        await this.htmlAPdf(html, rutaDestino)
    }

    private construirHtml(parseada: FacturaParseada, uuid: string, plantilla: Plantilla): string {
        const templatePath = join(app.getAppPath(), 'src', 'main', 'templates', `${plantilla}.html`)
        let html = fs.readFileSync(templatePath, 'utf-8')

        const fmt = (n: number) => (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

        // Datos básicos
        // Datos básicos
        html = this.reemplazar(html, 'UUID', uuid)
        html = this.reemplazar(html, 'NOMBRE_EMISOR', parseada.nombreEmisor)
        html = this.reemplazar(html, 'RFC_EMISOR', parseada.rfcEmisor)
        html = this.reemplazar(html, 'REGIMEN_FISCAL', cat(regimenFiscal, parseada.regimenFiscal))
        html = this.reemplazar(html, 'LUGAR_EXPEDICION', parseada.lugarExpedicion)
        html = this.reemplazar(html, 'FECHA', parseada.fecha?.replace('T', ' '))
        html = this.reemplazar(html, 'NO_CERTIFICADO', parseada.noCertificado || '')
        html = this.reemplazar(html, 'EXPORTACION', parseada.exportacion === '01' ? 'No aplica' : parseada.exportacion || '')
        html = this.reemplazar(html, 'RFC_RECEPTOR', parseada.rfcReceptor)
        html = this.reemplazar(html, 'NOMBRE_RECEPTOR', parseada.nombreReceptor)
        html = this.reemplazar(html, 'CP_RECEPTOR', parseada.cpReceptor || '')
        html = this.reemplazar(html, 'REGIMEN_FISCAL_RECEPTOR', cat(regimenFiscal, parseada.regimenFiscalReceptor || ''))
        html = this.reemplazar(html, 'USO_CFDI', cat(usoCFDI, parseada.usoCFDI))
        html = this.reemplazar(html, 'MONEDA', parseada.moneda)

        // Tipo comprobante
        const tipoLabel: Record<string, string> = { I: 'Ingreso', E: 'Egreso', T: 'Traslado', N: 'Nómina', P: 'Pago' }
        html = this.reemplazar(html, 'TIPO_COMPROBANTE_LABEL', tipoLabel[parseada.tipoDeComprobante] || parseada.tipoDeComprobante)

        // Serie y folio
        const serieFolio = [parseada.serie, parseada.folio].filter(Boolean).join('-')
        html = this.bloque(html, 'SERIE_FOLIO', !!serieFolio, serieFolio)

        // Forma y método de pago
        html = this.bloque(html, 'FORMA_PAGO', !!parseada.formaPago, cat(formaPago, parseada.formaPago || ''))
        html = this.bloque(html, 'METODO_PAGO', !!parseada.metodoPago, cat(metodoPago, parseada.metodoPago || ''))

        // Conceptos
        const conceptosRows = parseada.conceptos.map((c) => {
            const impuestosHtml = c.impuestos && c.impuestos.length > 0
                ? `<tr class="impuesto-concepto">
                    <td colspan="2"></td>
                    <td colspan="6" style="padding: 2px 6px; font-size: 9px; color: #666;">
          ${c.impuestos.map(imp =>
                    `${imp.tipo === 'traslado' ? 'Traslado' : 'Retención'} 
                    ${cat(impuesto, imp.impuesto)} 
                    ${(imp.tasa * 100).toFixed(0)}% = 
                    ${fmt(imp.importe)}`).join(' | ')}
                    </td> </tr>` : ''

            return `
            <tr>
            <td>${c.claveProdServ}</td>
            <td>${c.noIdentificacion || '-'}</td>
            <td>${c.descripcion}</td>
            <td class="text-right">${c.cantidad}</td>
            <td>${c.claveUnidad}</td>
            <td class="text-right">${fmt(c.valorUnitario)}</td>
            <td class="text-right">${fmt(c.importe)}</td>
            <td>${c.objetoImp === '02' ? 'Sí objeto' : c.objetoImp === '01' ? 'No objeto' : c.objetoImp || ''}</td>
            </tr>
            ${impuestosHtml}`
        }).join('')

        html = this.reemplazar(html, 'CONCEPTOS_ROWS', conceptosRows)

        // Impuestos
        const tieneImpuestos = parseada.impuestos.length > 0
        const impuestosRows = parseada.impuestos.map((i) => `
      <tr>
        <td>${i.tipo === 'traslado' ? 'Traslado' : 'Retención'}</td>
        <td>${cat(impuesto, i.impuesto)}</td>
        <td class="text-right">${i.tasa ? (i.tasa * 100).toFixed(0) + '%' : '-'}</td>
        <td class="text-right">${fmt(i.importe)}</td>
      </tr>`).join('')
        html = this.bloqueContenido(html, 'TIENE_IMPUESTOS', tieneImpuestos)
        html = this.reemplazar(html, 'IMPUESTOS_ROWS', impuestosRows)

        // Totales
        html = this.reemplazar(html, 'SUBTOTAL', fmt(parseada.subtotal))
        html = this.reemplazar(html, 'TOTAL', fmt(parseada.total))
        html = this.bloque(html, 'DESCUENTO', !!parseada.descuento, fmt(parseada.descuento || 0))
        html = this.bloque(html, 'IVA', !!parseada.totalImpuestosTrasladados, fmt(parseada.totalImpuestosTrasladados || 0))
        html = this.bloque(html, 'RETENCION', !!parseada.totalImpuestosRetenidos, fmt(parseada.totalImpuestosRetenidos || 0))

        // Nómina
        const esNomina = !!parseada.complementoNomina
        html = this.bloqueContenido(html, 'ES_NOMINA', esNomina)
        if (esNomina && parseada.complementoNomina) {
            const n = parseada.complementoNomina
            html = this.reemplazar(html, 'TIPO_NOMINA', n.tipoNomina === 'O' ? 'Ordinaria' : 'Extraordinaria')
            html = this.reemplazar(html, 'FECHA_PAGO_NOMINA', n.fechaPago)
            html = this.reemplazar(html, 'PERIODO_NOMINA', `${n.fechaInicialPago} - ${n.fechaFinalPago}`)
            html = this.reemplazar(html, 'DIAS_PAGADOS', String(n.numDiasPagados))
            html = this.reemplazar(html, 'TOTAL_PERCEPCIONES', fmt(n.totalPercepciones))
            html = this.reemplazar(html, 'TOTAL_DEDUCCIONES', fmt(n.totalDeducciones))

            const percRows = n.percepciones.map((p) => `
        <tr>
          <td>${p.clave}</td>
          <td>${cat(tipoPercepcion, p.clave)}</td>
          <td class="text-right">${fmt(p.importeGravado)}</td>
          <td class="text-right">${fmt(p.importeExento)}</td>
        </tr>`).join('')
            html = this.reemplazar(html, 'PERCEPCIONES_ROWS', percRows)

            const dedRows = n.deducciones.map((d) => `
        <tr>
          <td>${d.clave}</td>
          <td>${cat(tipoDeduccion, d.clave)}</td>
          <td class="text-right">${fmt(d.importe)}</td>
        </tr>`).join('')
            html = this.reemplazar(html, 'DEDUCCIONES_ROWS', dedRows)
        }

        // Pagos
        const esPago = !!parseada.complementoPago
        html = this.bloqueContenido(html, 'ES_PAGO', esPago)
        if (esPago && parseada.complementoPago) {
            const pagosHtml = parseada.complementoPago.pagos.map((p) => `
        <div style="margin-bottom:8px;padding:8px;border:1px solid #ddd;">
          <div><strong>Fecha:</strong> ${p.fechaPago} &nbsp;
               <strong>Forma:</strong> ${cat(formaPago, p.formaDePago)} &nbsp;
               <strong>Monto:</strong> ${fmt(p.monto)}</div>
          <table style="margin-top:6px">
            <thead><tr><th>UUID Relacionado</th><th class="text-right">Saldo Anterior</th><th class="text-right">Importe Pagado</th></tr></thead>
            <tbody>${p.doctoRelacionados.map((d) => `
              <tr>
                <td style="font-size:8px">${d.uuid}</td>
                <td class="text-right">${fmt(d.impSaldoAnt)}</td>
                <td class="text-right">${fmt(d.impPagado)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`).join('')
            html = this.reemplazar(html, 'PAGOS_ROWS', pagosHtml)
        }

        // Timbre fiscal
        const t = parseada.timbre
        html = this.reemplazar(html, 'FECHA_TIMBRADO', t?.fechaTimbrado || '')
        html = this.reemplazar(html, 'RFC_PAC', t?.rfcProvCertif || '')
        html = this.reemplazar(html, 'NO_CERT_SAT', t?.noCertificadoSAT || '')
        html = this.reemplazar(html, 'SELLO_CFD', t?.selloCFD || '')
        html = this.reemplazar(html, 'SELLO_SAT', t?.selloSAT || '')

        // QR
        const qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${parseada.rfcEmisor}&rr=${parseada.rfcReceptor}&tt=${parseada.total}&fe=${(t?.selloCFD || '').slice(-8)}`
        const qrDataUrl = this.generarQrSvg(qrUrl)
        html = this.reemplazar(html, 'QR_DATA_URL', qrDataUrl)

        return html
    }

    private async htmlAPdf(html: string, rutaDestino: string): Promise<void> {
        const context = await BrowserManager.newContext()
        const page = await context.newPage()
        await page.setContent(html, { waitUntil: 'networkidle' })
        await page.pdf({
            path: rutaDestino,
            format: 'Letter',
            margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
            printBackground: true
        })
         await context.close()
    }

    private reemplazar(html: string, clave: string, valor: string): string {
        return html.replace(new RegExp(`{{${clave}}}`, 'g'), valor || '')
    }

    private bloque(html: string, clave: string, mostrar: boolean, valor: string): string {
        if (mostrar) {
            html = html.replace(new RegExp(`{{#${clave}}}`, 'g'), '')
            html = html.replace(new RegExp(`{{/${clave}}}`, 'g'), '')
            html = this.reemplazar(html, clave, valor)
        } else {
            html = html.replace(new RegExp(`{{#${clave}}}[\\s\\S]*?{{/${clave}}}`, 'g'), '')
        }
        return html
    }

    private bloqueContenido(html: string, clave: string, mostrar: boolean): string {
        if (mostrar) {
            html = html.replace(new RegExp(`{{#${clave}}}`, 'g'), '')
            html = html.replace(new RegExp(`{{/${clave}}}`, 'g'), '')
        } else {
            html = html.replace(new RegExp(`{{#${clave}}}[\\s\\S]*?{{/${clave}}}`, 'g'), '')
        }
        return html
    }

    // QR simple en SVG (sin dependencias externas)
    private generarQrSvg(url: string): string {
        // Usamos una URL de API pública para generar el QR como data URL
        return `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(url)}`
    }
}