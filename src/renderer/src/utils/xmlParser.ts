export interface ImpuestoConcepto {
  tipo: 'traslado' | 'retencion'
  impuesto: string
  tasa: number
  importe: number
}

export interface Concepto {
  claveProdServ: string
  noIdentificacion?: string
  claveUnidad: string
  unidad: string
  descripcion: string
  cantidad: number
  valorUnitario: number
  importe: number
  descuento?: number
  objetoImp?: string
  impuestos?: ImpuestoConcepto[]  // ← nuevo
}

export interface Impuesto {
  tipo: 'traslado' | 'retencion'
  impuesto: string
  importe: number
  tasa?: number
}

export interface TimbreFiscal {
  uuid: string
  fechaTimbrado: string
  rfcProvCertif: string
  selloCFD: string
  noCertificadoSAT: string
  selloSAT: string
}

export interface ComplementoNomina {
  tipoNomina: string
  fechaPago: string
  fechaInicialPago: string
  fechaFinalPago: string
  numDiasPagados: number
  totalPercepciones: number
  totalDeducciones: number
  totalOtrosPagos: number
  percepciones: { clave: string; concepto: string; importeGravado: number; importeExento: number }[]
  deducciones: { clave: string; concepto: string; importe: number }[]
}

export interface ComplementoPago {
  pagos: {
    fechaPago: string
    formaDePago: string
    moneda: string
    monto: number
    doctoRelacionados: { uuid: string; serie?: string; folio?: string; impSaldoAnt: number; impPagado: number }[]
  }[]
}

export interface FacturaParseada {
  serie?: string
  folio?: string
  fecha: string
  formaPago?: string
  metodoPago?: string
  lugarExpedicion: string
  tipoDeComprobante: string
  noCertificado?: string
  exportacion?: string
  subtotal: number
  descuento?: number
  total: number
  moneda: string
  tipoCambio?: number
  rfcEmisor: string
  nombreEmisor: string
  regimenFiscal: string
  rfcReceptor: string
  nombreReceptor: string
  cpReceptor?: string
  regimenFiscalReceptor?: string
  usoCFDI: string
  conceptos: Concepto[]
  impuestos: Impuesto[]
  totalImpuestosTrasladados?: number
  totalImpuestosRetenidos?: number
  complementoNomina?: ComplementoNomina
  complementoPago?: ComplementoPago
  timbre?: TimbreFiscal
}

export function parsearXml(xmlString: string): FacturaParseada {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  const ns = 'http://www.sat.gob.mx/cfd/4'
  const nsNomina = 'http://www.sat.gob.mx/nomina12'
  const nsPago = 'http://www.sat.gob.mx/Pagos20'

  const comprobante = doc.getElementsByTagNameNS(ns, 'Comprobante')[0]
    || doc.getElementsByTagName('cfdi:Comprobante')[0]
    || doc.documentElement

  const getAttr = (el: Element | null, attr: string) => el?.getAttribute(attr) || ''
  const getFloat = (el: Element | null, attr: string) => parseFloat(el?.getAttribute(attr) || '0') || 0

  const emisor = doc.getElementsByTagNameNS(ns, 'Emisor')[0]
    || doc.querySelector('[nodeName="cfdi:Emisor"]')
    || comprobante.querySelector('Emisor')

  const receptor = doc.getElementsByTagNameNS(ns, 'Receptor')[0]
    || comprobante.querySelector('Receptor')

  const conceptosEl = Array.from(
    doc.getElementsByTagNameNS(ns, 'Concepto').length > 0
      ? doc.getElementsByTagNameNS(ns, 'Concepto')
      : doc.querySelectorAll('Concepto')
  )

  const conceptos: Concepto[] = conceptosEl.map((c) => {
    const impuestosConcepto: ImpuestoConcepto[] = []

    const trasladosEl = Array.from(
      c.getElementsByTagNameNS(ns, 'Traslado').length > 0
        ? c.getElementsByTagNameNS(ns, 'Traslado')
        : c.querySelectorAll('Traslado')
    )
    trasladosEl.forEach((t) => {
      impuestosConcepto.push({
        tipo: 'traslado',
        impuesto: getAttr(t, 'Impuesto'),
        tasa: getFloat(t, 'TasaOCuota'),
        importe: getFloat(t, 'Importe')
      })
    })

    const retencionesEl = Array.from(
      c.getElementsByTagNameNS(ns, 'Retencion').length > 0
        ? c.getElementsByTagNameNS(ns, 'Retencion')
        : c.querySelectorAll('Retencion')
    )
    retencionesEl.forEach((r) => {
      impuestosConcepto.push({
        tipo: 'retencion',
        impuesto: getAttr(r, 'Impuesto'),
        tasa: getFloat(r, 'TasaOCuota'),
        importe: getFloat(r, 'Importe')
      })
    })

    return {
      claveProdServ: getAttr(c, 'ClaveProdServ'),
      noIdentificacion: getAttr(c, 'NoIdentificacion'),
      claveUnidad: getAttr(c, 'ClaveUnidad'),
      unidad: getAttr(c, 'Unidad'),
      descripcion: getAttr(c, 'Descripcion'),
      cantidad: getFloat(c, 'Cantidad'),
      valorUnitario: getFloat(c, 'ValorUnitario'),
      importe: getFloat(c, 'Importe'),
      descuento: getFloat(c, 'Descuento'),
      objetoImp: getAttr(c, 'ObjetoImp'),
      impuestos: impuestosConcepto
    }
  })

  const impuestosEl = doc.getElementsByTagNameNS(ns, 'Impuestos')[0]
    || doc.querySelector('Impuestos')

  const impuestos: Impuesto[] = []

  if (impuestosEl) {
    const traslados = Array.from(
      impuestosEl.getElementsByTagNameNS(ns, 'Traslado').length > 0
        ? impuestosEl.getElementsByTagNameNS(ns, 'Traslado')
        : impuestosEl.querySelectorAll('Traslado')
    )
    traslados.forEach((t) => {
      impuestos.push({
        tipo: 'traslado',
        impuesto: getAttr(t, 'Impuesto'),
        importe: getFloat(t, 'Importe'),
        tasa: getFloat(t, 'TasaOCuota')
      })
    })

    const retenciones = Array.from(
      impuestosEl.getElementsByTagNameNS(ns, 'Retencion').length > 0
        ? impuestosEl.getElementsByTagNameNS(ns, 'Retencion')
        : impuestosEl.querySelectorAll('Retencion')
    )
    retenciones.forEach((r) => {
      impuestos.push({
        tipo: 'retencion',
        impuesto: getAttr(r, 'Impuesto'),
        importe: getFloat(r, 'Importe')
      })
    })
  }

  let complementoNomina: ComplementoNomina | undefined
  const nominaEl = doc.getElementsByTagNameNS(nsNomina, 'Nomina')[0]
    || doc.querySelector('nomina12\\:Nomina, Nomina[Version="1.2"]')

  if (nominaEl) {
    const percepcionesEl = Array.from(nominaEl.getElementsByTagNameNS(nsNomina, 'Percepcion').length > 0
      ? nominaEl.getElementsByTagNameNS(nsNomina, 'Percepcion')
      : nominaEl.querySelectorAll('Percepcion'))

    const deduccionesEl = Array.from(nominaEl.getElementsByTagNameNS(nsNomina, 'Deduccion').length > 0
      ? nominaEl.getElementsByTagNameNS(nsNomina, 'Deduccion')
      : nominaEl.querySelectorAll('Deduccion'))

    complementoNomina = {
      tipoNomina: getAttr(nominaEl, 'TipoNomina'),
      fechaPago: getAttr(nominaEl, 'FechaPago'),
      fechaInicialPago: getAttr(nominaEl, 'FechaInicialPago'),
      fechaFinalPago: getAttr(nominaEl, 'FechaFinalPago'),
      numDiasPagados: getFloat(nominaEl, 'NumDiasPagados'),
      totalPercepciones: getFloat(nominaEl, 'TotalPercepciones'),
      totalDeducciones: getFloat(nominaEl, 'TotalDeducciones'),
      totalOtrosPagos: getFloat(nominaEl, 'TotalOtrosPagos'),
      percepciones: percepcionesEl.map((p) => ({
        clave: getAttr(p, 'TipoPercepcion'),
        concepto: getAttr(p, 'Concepto'),
        importeGravado: getFloat(p, 'ImporteGravado'),
        importeExento: getFloat(p, 'ImporteExento')
      })),
      deducciones: deduccionesEl.map((d) => ({
        clave: getAttr(d, 'TipoDeduccion'),
        concepto: getAttr(d, 'Concepto'),
        importe: getFloat(d, 'Importe')
      }))
    }
  }

  let complementoPago: ComplementoPago | undefined
  const pagosEl = doc.getElementsByTagNameNS(nsPago, 'Pagos')[0]
    || doc.querySelector('pago20\\:Pagos, Pagos[Version="2.0"]')

  if (pagosEl) {
    const pagoEls = Array.from(pagosEl.getElementsByTagNameNS(nsPago, 'Pago').length > 0
      ? pagosEl.getElementsByTagNameNS(nsPago, 'Pago')
      : pagosEl.querySelectorAll('Pago'))

    complementoPago = {
      pagos: pagoEls.map((p) => {
        const doctos = Array.from(p.getElementsByTagNameNS(nsPago, 'DoctoRelacionado').length > 0
          ? p.getElementsByTagNameNS(nsPago, 'DoctoRelacionado')
          : p.querySelectorAll('DoctoRelacionado'))
        return {
          fechaPago: getAttr(p, 'FechaPago'),
          formaDePago: getAttr(p, 'FormaDePagoP'),
          moneda: getAttr(p, 'MonedaP'),
          monto: getFloat(p, 'Monto'),
          doctoRelacionados: doctos.map((d) => ({
            uuid: getAttr(d, 'IdDocumento'),
            serie: getAttr(d, 'Serie'),
            folio: getAttr(d, 'Folio'),
            impSaldoAnt: getFloat(d, 'ImpSaldoAnt'),
            impPagado: getFloat(d, 'ImpPagado')
          }))
        }
      })
    }
  }

  const nsTfd = 'http://www.sat.gob.mx/TimbreFiscalDigital'
  const timbreEl = doc.getElementsByTagNameNS(nsTfd, 'TimbreFiscalDigital')[0]
    || doc.querySelector('tfd\\:TimbreFiscalDigital, TimbreFiscalDigital')

  const timbre: TimbreFiscal | undefined = timbreEl ? {
    uuid: getAttr(timbreEl, 'UUID'),
    fechaTimbrado: getAttr(timbreEl, 'FechaTimbrado'),
    rfcProvCertif: getAttr(timbreEl, 'RfcProvCertif'),
    selloCFD: getAttr(timbreEl, 'SelloCFD'),
    noCertificadoSAT: getAttr(timbreEl, 'NoCertificadoSAT'),
    selloSAT: getAttr(timbreEl, 'SelloSAT')
  } : undefined

  return {
    serie: getAttr(comprobante, 'Serie'),
    folio: getAttr(comprobante, 'Folio'),
    fecha: getAttr(comprobante, 'Fecha'),
    formaPago: getAttr(comprobante, 'FormaPago'),
    metodoPago: getAttr(comprobante, 'MetodoPago'),
    lugarExpedicion: getAttr(comprobante, 'LugarExpedicion'),
    tipoDeComprobante: getAttr(comprobante, 'TipoDeComprobante'),
    noCertificado: getAttr(comprobante, 'NoCertificado'),
    exportacion: getAttr(comprobante, 'Exportacion'),
    subtotal: getFloat(comprobante, 'SubTotal'),
    descuento: getFloat(comprobante, 'Descuento'),
    total: getFloat(comprobante, 'Total'),
    moneda: getAttr(comprobante, 'Moneda'),
    tipoCambio: getFloat(comprobante, 'TipoCambio'),
    rfcEmisor: getAttr(emisor, 'Rfc'),
    nombreEmisor: getAttr(emisor, 'Nombre'),
    regimenFiscal: getAttr(emisor, 'RegimenFiscal'),
    rfcReceptor: getAttr(receptor, 'Rfc'),
    nombreReceptor: getAttr(receptor, 'Nombre'),
    cpReceptor: getAttr(receptor, 'DomicilioFiscalReceptor'),
    regimenFiscalReceptor: getAttr(receptor, 'RegimenFiscalReceptor'),
    usoCFDI: getAttr(receptor, 'UsoCFDI'),
    conceptos,
    impuestos,
    totalImpuestosTrasladados: getFloat(impuestosEl, 'TotalImpuestosTrasladados'),
    totalImpuestosRetenidos: getFloat(impuestosEl, 'TotalImpuestosRetenidos'),
    complementoNomina,
    complementoPago,
    timbre
  }
}