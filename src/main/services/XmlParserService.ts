import * as fs from 'fs'
import { DOMParser } from '@xmldom/xmldom'

export interface ComplementoPago {
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
}

export interface ComplementoNomina {
  tipo_nomina: string
  fecha_pago: string
  fecha_inicial_pago: string
  fecha_final_pago: string
  num_dias_pagados: number
  total_percepciones: number
  total_deducciones: number
  total_otros_pagos: number
  curp: string
  num_empleado: string
  departamento: string
  puesto: string
  tipo_regimen: string
  tipo_contrato: string
  periodicidad_pago: string
  salario_diario_integrado: number
  percepciones: {
    tipo: string
    clave: string
    concepto: string
    importe_gravado: number
    importe_exento: number
  }[]
  deducciones: {
    tipo: string
    clave: string
    concepto: string
    importe: number
  }[]
  otros_pagos: {
    tipo: string
    clave: string
    concepto: string
    importe: number
  }[]
  incapacidades: {
    dias: number
    tipo: string
    importe: number
  }[]
}

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

      const todosLosImpuestos = doc.getElementsByTagNameNS(ns, 'Impuestos')
      const impuestosEl = todosLosImpuestos.length > 0
        ? todosLosImpuestos[todosLosImpuestos.length - 1]
        : null

      const emisor = doc.getElementsByTagNameNS(ns, 'Emisor')[0] || null
      const receptor = doc.getElementsByTagNameNS(ns, 'Receptor')[0] || null

      const getAttr = (el: any, attr: string) => el?.getAttribute(attr) || ''
      const getFloat = (el: any, attr: string) => parseFloat(el?.getAttribute(attr) || '0') || 0

      const tipoTexto = getAttr(cfdi, 'TipoDeComprobante')

      const base = {
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
        total_impuestos_retenidos: getFloat(impuestosEl, 'TotalImpuestosRetenidos'),
        regimen_fiscal_emisor: getAttr(emisor, 'RegimenFiscal'),
        regimen_fiscal_receptor: getAttr(receptor, 'RegimenFiscal'),
        uso_cfdi: getAttr(receptor, 'UsoCFDI')
      }

      if (tipoTexto === 'P') {
        return { ...base, complementoPago: this.extraerComplementoPago(doc) }
      }

      if (tipoTexto === 'N') {
        return { ...base, complementoNomina: this.extraerComplementoNomina(doc) }
      }

      return base
    } catch (err) {
      console.error('Error extrayendo campos XML:', err)
      return {}
    }
  }

  extraerComplementoPago(doc: any): ComplementoPago | null {
    try {
      const nsPago = 'http://www.sat.gob.mx/Pagos20'
      const pagoEl = doc.getElementsByTagNameNS(nsPago, 'Pago')[0] || null
      if (!pagoEl) return null

      const getAttr = (el: any, attr: string) => el?.getAttribute(attr) || ''
      const getFloat = (el: any, attr: string) => parseFloat(el?.getAttribute(attr) || '0') || 0
      const getInt = (el: any, attr: string) => parseInt(el?.getAttribute(attr) || '0', 10) || 0

      const doctosEl = pagoEl.getElementsByTagNameNS(nsPago, 'DoctoRelacionado')
      const documentos = Array.from({ length: doctosEl.length }, (_, i) => {
        const d = doctosEl[i]
        return {
          id_documento: getAttr(d, 'IdDocumento'),
          serie: getAttr(d, 'Serie'),
          folio: getAttr(d, 'Folio'),
          moneda_dr: getAttr(d, 'MonedaDR'),
          tipo_cambio_dr: getFloat(d, 'TipoCambioDR'),
          metodo_pago_dr: getAttr(d, 'MetodoDePagoDR'),
          num_parcialidad: getInt(d, 'NumParcialidad'),
          imp_saldo_anterior: getFloat(d, 'ImpSaldoAnterior'),
          imp_pagado: getFloat(d, 'ImpPagado'),
          imp_saldo_insoluto: getFloat(d, 'ImpSaldoInsoluto')
        }
      })

      return {
        fecha_pago: getAttr(pagoEl, 'FechaPago'),
        forma_pago_p: getAttr(pagoEl, 'FormaDePagoP'),
        moneda_p: getAttr(pagoEl, 'MonedaP'),
        tipo_cambio_p: getFloat(pagoEl, 'TipoCambioP'),
        monto: getFloat(pagoEl, 'Monto'),
        documentos
      }
    } catch (err) {
      console.error('Error extrayendo complemento de pago:', err)
      return null
    }
  }

  extraerComplementoNomina(doc: any): ComplementoNomina | null {
    try {
      const nsNomina = 'http://www.sat.gob.mx/nomina12'
      const nominaEl = doc.getElementsByTagNameNS(nsNomina, 'Nomina')[0] || null
      if (!nominaEl) return null

      const getAttr = (el: any, attr: string) => el?.getAttribute(attr) || ''
      const getFloat = (el: any, attr: string) => parseFloat(el?.getAttribute(attr) || '0') || 0
      const getInt = (el: any, attr: string) => parseInt(el?.getAttribute(attr) || '0', 10) || 0

      const receptorEl = nominaEl.getElementsByTagNameNS(nsNomina, 'Receptor')[0] || null

      // Percepciones
      const percepcionesEls = nominaEl.getElementsByTagNameNS(nsNomina, 'Percepcion')
      const percepciones = Array.from({ length: percepcionesEls.length }, (_, i) => {
        const p = percepcionesEls[i]
        return {
          tipo: getAttr(p, 'TipoPercepcion'),
          clave: getAttr(p, 'Clave'),
          concepto: getAttr(p, 'Concepto'),
          importe_gravado: getFloat(p, 'ImporteGravado'),
          importe_exento: getFloat(p, 'ImporteExento')
        }
      })

      // Deducciones
      const deduccionesEls = nominaEl.getElementsByTagNameNS(nsNomina, 'Deduccion')
      const deducciones = Array.from({ length: deduccionesEls.length }, (_, i) => {
        const d = deduccionesEls[i]
        return {
          tipo: getAttr(d, 'TipoDeduccion'),
          clave: getAttr(d, 'Clave'),
          concepto: getAttr(d, 'Concepto'),
          importe: getFloat(d, 'Importe')
        }
      })

      // Otros pagos
      const otrosPagosEls = nominaEl.getElementsByTagNameNS(nsNomina, 'OtroPago')
      const otros_pagos = Array.from({ length: otrosPagosEls.length }, (_, i) => {
        const o = otrosPagosEls[i]
        return {
          tipo: getAttr(o, 'TipoOtroPago'),
          clave: getAttr(o, 'Clave'),
          concepto: getAttr(o, 'Concepto'),
          importe: getFloat(o, 'Importe')
        }
      })

      // Incapacidades
      const incapacidadesEls = nominaEl.getElementsByTagNameNS(nsNomina, 'Incapacidad')
      const incapacidades = Array.from({ length: incapacidadesEls.length }, (_, i) => {
        const inc = incapacidadesEls[i]
        return {
          dias: getInt(inc, 'DiasIncapacidad'),
          tipo: getAttr(inc, 'TipoIncapacidad'),
          importe: getFloat(inc, 'ImporteMonetario')
        }
      })

      return {
        tipo_nomina: getAttr(nominaEl, 'TipoNomina'),
        fecha_pago: getAttr(nominaEl, 'FechaPago'),
        fecha_inicial_pago: getAttr(nominaEl, 'FechaInicialPago'),
        fecha_final_pago: getAttr(nominaEl, 'FechaFinalPago'),
        num_dias_pagados: getFloat(nominaEl, 'NumDiasPagados'),
        total_percepciones: getFloat(nominaEl, 'TotalPercepciones'),
        total_deducciones: getFloat(nominaEl, 'TotalDeducciones'),
        total_otros_pagos: getFloat(nominaEl, 'TotalOtrosPagos'),
        curp: getAttr(receptorEl, 'Curp'),
        num_empleado: getAttr(receptorEl, 'NumEmpleado'),
        departamento: getAttr(receptorEl, 'Departamento'),
        puesto: getAttr(receptorEl, 'Puesto'),
        tipo_regimen: getAttr(receptorEl, 'TipoRegimen'),
        tipo_contrato: getAttr(receptorEl, 'TipoContrato'),
        periodicidad_pago: getAttr(receptorEl, 'PeriodicidadPago'),
        salario_diario_integrado: getFloat(receptorEl, 'SalarioDiarioIntegrado'),
        percepciones,
        deducciones,
        otros_pagos,
        incapacidades
      }
    } catch (err) {
      console.error('Error extrayendo complemento de nómina:', err)
      return null
    }
  }
}