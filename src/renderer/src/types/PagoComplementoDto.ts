export interface DoctoRelacionadoDto {
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
}

export interface PagoComplementoDto {
    uuid_rep: string
    fecha_pago: string
    forma_pago_p: string
    moneda_p: string
    tipo_cambio_p: number
    monto: number
    documentos: DoctoRelacionadoDto[]
}