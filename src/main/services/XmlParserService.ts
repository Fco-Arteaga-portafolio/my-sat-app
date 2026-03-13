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

      //obtenemos el último nodo de impuestos, ya que en algunos casos hay más de uno (por ejemplo, en facturas con complementos de pago)
      const todosLosImpuestos = doc.getElementsByTagNameNS(ns, 'Impuestos')
      const impuestosEl = todosLosImpuestos.length > 0 ? todosLosImpuestos[todosLosImpuestos.length - 1] : null;

      //   const impuestosEl = doc.getElementsByTagNameNS(ns, 'Impuestos')[0] || null
      const emisor = doc.getElementsByTagNameNS(ns, 'Emisor')[0] || null
      const receptor = doc.getElementsByTagNameNS(ns, 'Receptor')[0] || null

      const getAttr = (el: any, attr: string) => el?.getAttribute(attr) || ''
      const getFloat = (el: any, attr: string) => parseFloat(el?.getAttribute(attr) || '0') || 0

      // Tipo comprobante
      const tipoTexto = getAttr(cfdi, 'TipoDeComprobante')

      return {
        uuid: getAttr(tfd, 'UUID'),
        version: getAttr(cfdi, 'Version'),
        serie: getAttr(cfdi, 'Serie'),
        folio: getAttr(cfdi, 'Folio'),
        fecha_emision: getAttr(cfdi, 'Fecha'),
        forma_pago: getAttr(cfdi, 'FormaPago'),
        metodo_pago: getAttr(cfdi, 'MetodoPago'),
        moneda: getAttr(cfdi, 'Moneda'),
        tipo_cambio: getFloat(cfdi, 'TipoCambio'),
        descuento: getFloat(cfdi, 'Descuento'),
        subtotal: getFloat(cfdi, 'SubTotal'),
        total: getFloat(cfdi, 'Total'),
        tipo_comprobante: tipoTexto,
        rfc_emisor: getAttr(emisor, 'Rfc'),
        nombre_emisor: getAttr(emisor, 'Nombre'),
        rfc_receptor: getAttr(receptor, 'Rfc'),
        nombre_receptor: getAttr(receptor, 'Nombre'),
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