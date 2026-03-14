export interface FacturaExtraida {
    uuid: string
    rfc_emisor: string
    nombre_emisor: string
    rfc_receptor: string
    nombre_receptor: string
    fecha_emision: string
    total: number
    tipo_comprobante: string
    estado: string
    urlDescarga: string
    tipo_descarga?: string
}

export interface ParametrosBusqueda {
    tipo: 'emitidas' | 'recibidas'
    buscarPor: 'fecha' | 'folio'
    fechaInicio?: string
    fechaFin?: string
    folioFiscal?: string
    rfcTercero?: string
    estadoComprobante?: string
    tipoComprobante?: string
}

export interface ProgresoDescarga {
    etapa: 'buscando' | 'descargando' | 'completado'
    mesActual?: number
    totalMeses?: number
    descargadas?: number
    totalFacturas?: number
    uuid?: string
}

export interface ErrorDescarga {
    uuid: string
    error: string
    fila: {
        rfc_emisor: string
        nombre_emisor: string
        rfc_receptor: string
        nombre_receptor: string
        fecha_emision: string
        total: number
        tipo_comprobante: string
        estado: string
        urlDescarga: string
    }
}

export interface MetaCfdi {
    uuid: string
    rfc_emisor: string
    nombre_emisor: string
    rfc_receptor: string
    nombre_receptor: string
    fecha_emision: string
    total: number
    tipo_comprobante: string
    estado: string
    tipo_descarga: 'recibida' | 'emitida'
}