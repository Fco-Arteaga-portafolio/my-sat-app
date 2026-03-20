export interface FacturaDto {
    id?: number
    uuid: string
    version?: string
    serie?: string
    folio?: string
    fecha_emision: string
    fecha_timbrado?: string
    rfc_emisor: string
    nombre_emisor: string
    rfc_receptor: string
    nombre_receptor: string
    subtotal: number
    descuento?: number
    total_impuestos_trasladados?: number
    total_impuestos_retenidos?: number
    total: number
    tipo_comprobante: 'I' | 'E' | 'T' | 'N' | 'P'
    forma_pago?: string
    metodo_pago?: string
    moneda?: string
    tipo_cambio?: number
    estado: 'vigente' | 'cancelado'
    estado_cancelacion?: string
    estado_proceso_cancelacion?: string
    fecha_cancelacion?: string
    rfc_pac?: string
    folio_sustitucion?: string
    xml: string
    fecha_descarga?: string
    tipo_descarga?: 'recibida' | 'emitida'
    // Complemento de pago (tipo P)
    fecha_pago?: string
    forma_pago_p?: string
    moneda_p?: string
    tipo_cambio_p?: number
    monto?: number
    documentos?: string
    // Complemento de nómina (tipo N)
    tipo_nomina?: string
    fecha_inicial_pago?: string
    fecha_final_pago?: string
    num_dias_pagados?: number
    total_percepciones?: number
    total_deducciones?: number
    total_otros_pagos?: number
    curp?: string
    num_empleado?: string
    departamento?: string
    puesto?: string
    tipo_regimen?: string
    tipo_contrato?: string
    periodicidad_pago?: string
    salario_diario_integrado?: number
}