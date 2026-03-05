import * as fs from 'fs'
import { DOMParser } from '@xmldom/xmldom'

export class XmlParserService {
  extraerCampos(rutaXml: string): Record<string, any> {
    try {
      const contenido = fs.readFileSync(rutaXml, 'utf-8')
      const parser = new DOMParser()
      const doc = parser.parseFromString(contenido, 'text/xml')

      const ns = 'http://www.sat.gob.mx/cfd/4'
      const nsTfd = 'http://www.sat.gob.mx/TimbreFiscalDigital'

      const cfdi = doc.getElementsByTagNameNS(ns, 'Comprobante')[0] || doc.documentElement
      const tfd = doc.getElementsByTagNameNS(nsTfd, 'TimbreFiscalDigital')[0] || null
      const cfdiRelacionado = doc.getElementsByTagNameNS(ns, 'CfdiRelacionado')[0] || null
      const impuestosEl = doc.getElementsByTagNameNS(ns, 'Impuestos')[0] || null

      const getAttr = (el: any, attr: string) => el?.getAttribute(attr) || ''
      const getFloat = (el: any, attr: string) => parseFloat(el?.getAttribute(attr) || '0') || 0

      return {
        version: getAttr(cfdi, 'Version'),
        serie: getAttr(cfdi, 'Serie'),
        folio: getAttr(cfdi, 'Folio'),
        forma_pago: getAttr(cfdi, 'FormaPago'),
        metodo_pago: getAttr(cfdi, 'MetodoPago'),
        moneda: getAttr(cfdi, 'Moneda'),
        tipo_cambio: getFloat(cfdi, 'TipoCambio'),
        descuento: getFloat(cfdi, 'Descuento'),
        fecha_timbrado: getAttr(tfd, 'FechaTimbrado'),
        rfc_pac: getAttr(tfd, 'RfcProvCertif'),
        folio_sustitucion: getAttr(cfdiRelacionado, 'UUID'),
        total_impuestos_trasladados: getFloat(impuestosEl, 'TotalImpuestosTrasladados'),
        total_impuestos_retenidos: getFloat(impuestosEl, 'TotalImpuestosRetenidos')
      }
    } catch (err) {
      console.error('Error extrayendo campos XML:', err)
      return {}
    }
  }
}