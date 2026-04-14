import { useState, useEffect, useCallback } from 'react'

export interface FilaDetalle {
    uuid: string
    tipo_descarga: string
    tipo_comprobante: string
    rfc_emisor: string
    nombre_emisor: string
    rfc_receptor: string
    nombre_receptor: string
    metodo_pago: string
    subtotal: number
    descuento: number
    total_impuestos_retenidos: number
    total_impuestos_trasladados: number
    total: number
    estado: string
    pagado: number
}

export interface ResumenIva {
    iva_cobrado: number
    iva_acreditable: number
    iva_retenido: number
    iva_a_pagar: number
}

export interface ResumenIsr {
    ingresos: number
    gastos: number
    base_gravable: number
    isr_retenido: number
}

export const TIPO_LABEL: Record<string, string> = {
    I: 'Ingreso', E: 'Egreso', T: 'Traslado', N: 'Nómina', P: 'Pago'
}

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export const fmt = (n: number) =>
    (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export const useReporteDetalleMesPage = (año: number, mes: number, origen: string) => {
    const [datos, setDatos] = useState<FilaDetalle[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [facturaSeleccionada, setFacturaSeleccionada] = useState<FilaDetalle | null>(null)
    const [modalVisible, setModalVisible] = useState(false)

    const abrirModal = (fila: FilaDetalle) => {
        setFacturaSeleccionada(fila)
        setModalVisible(true)
    }

    const cerrarModal = () => {
        setModalVisible(false)
        setFacturaSeleccionada(null)
    }

    const cargar = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await window.api.reportesDetalleMes(año, mes)
            if (!res.success) throw new Error(res.error)
            setDatos(res.data ?? [])
        } catch (e) {
            setError(String(e))
        } finally {
            setLoading(false)
        }
    }, [año, mes])

    useEffect(() => {
        cargar()
    }, [cargar])

    const togglePagado = async (uuid: string, pagado: boolean) => {
        setDatos((prev) =>
            prev.map((f) => f.uuid === uuid ? { ...f, pagado: pagado ? 1 : 0 } : f)
        )
        try {
            const res = await window.api.cfdiTogglePagado(uuid, pagado)
            if (!res.success) throw new Error(res.error)
        } catch (e) {
            setDatos((prev) =>
                prev.map((f) => f.uuid === uuid ? { ...f, pagado: pagado ? 0 : 1 } : f)
            )
            setError(String(e))
        }
    }

    const cfdiGenerales = datos.filter((f) => f.tipo_comprobante !== 'N')
    const cfdiNomina = datos.filter((f) => f.tipo_comprobante === 'N')
    const tieneNomina = cfdiNomina.length > 0

    // ── Resumen reactivo — solo CFDIs marcados como pagados ──────────────────
    const pagados = datos.filter((f) => f.pagado === 1)

    const resumenIva: ResumenIva = {
        iva_cobrado: pagados.filter((f) => f.tipo_descarga === 'emitida' && f.tipo_comprobante === 'I')
            .reduce((s, f) => s + f.total_impuestos_trasladados, 0),
        iva_acreditable: pagados.filter((f) => f.tipo_descarga === 'recibida' && f.tipo_comprobante === 'I')
            .reduce((s, f) => s + f.total_impuestos_trasladados, 0),
        iva_retenido: pagados.reduce((s, f) => s + f.total_impuestos_retenidos, 0),
        get iva_a_pagar() { return this.iva_cobrado - this.iva_acreditable }
    }

    const ingresos = pagados.filter((f) => f.tipo_descarga === 'emitida' && f.tipo_comprobante === 'I')
        .reduce((s, f) => s + f.subtotal, 0)
    const gastos = pagados.filter((f) => f.tipo_descarga === 'recibida' && ['I', 'E'].includes(f.tipo_comprobante))
        .reduce((s, f) => s + f.subtotal, 0)

    const resumenIsr: ResumenIsr = {
        ingresos,
        gastos,
        base_gravable: Math.max(0, ingresos - gastos),
        isr_retenido: pagados.filter((f) => f.tipo_descarga === 'emitida')
            .reduce((s, f) => s + f.total_impuestos_retenidos, 0)
    }

    const mesNombre = MESES[mes - 1] ?? ''

    return {
        datos, cfdiGenerales, cfdiNomina,
        tieneNomina,
        loading, error,
        togglePagado,
        resumenIva, resumenIsr,
        mesNombre,
        origen,
        facturaSeleccionada, modalVisible,
        abrirModal, cerrarModal,
    }
}