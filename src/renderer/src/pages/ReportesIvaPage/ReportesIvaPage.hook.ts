import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const añoActual = new Date().getFullYear()

export interface FilaIva {
    mes: string
    iva_cobrado: number
    iva_acreditable: number
    iva_retenido_cobrado: number
    iva_retenido_pagado: number
}

export interface FilaTabla extends FilaIva {
    mes_nombre: string
    iva_a_pagar: number
}

const fmt = (n: number) =>
    (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export const useReportesIvaPage = () => {
    const [año, setAño] = useState<number>(añoActual)
    const [datos, setDatos] = useState<FilaTabla[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const cargar = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await window.api.reportesIvaAnual(año)
            if (!res.success) throw new Error(res.error)

            const mesesConDatos: Record<string, FilaIva> = {}
            for (const fila of res.data as FilaIva[]) {
                mesesConDatos[fila.mes] = fila
            }

            const filas: FilaTabla[] = MESES.map((nombre, idx) => {
                const mesStr = String(idx + 1).padStart(2, '0')
                const fila = mesesConDatos[mesStr]
                const iva_cobrado = fila?.iva_cobrado ?? 0
                const iva_acreditable = fila?.iva_acreditable ?? 0
                const iva_retenido_cobrado = fila?.iva_retenido_cobrado ?? 0
                const iva_retenido_pagado = fila?.iva_retenido_pagado ?? 0
                return {
                    mes: mesStr,
                    mes_nombre: nombre,
                    iva_cobrado,
                    iva_acreditable,
                    iva_retenido_cobrado,
                    iva_retenido_pagado,
                    iva_a_pagar: iva_cobrado - iva_acreditable
                }
            })

            setDatos(filas)
        } catch (e) {
            setError(String(e))
        } finally {
            setLoading(false)
        }
    }, [año])

    useEffect(() => {
        cargar()
    }, [cargar])

    const totales = datos.reduce(
        (acc, f) => ({
            iva_cobrado: acc.iva_cobrado + f.iva_cobrado,
            iva_acreditable: acc.iva_acreditable + f.iva_acreditable,
            iva_retenido_cobrado: acc.iva_retenido_cobrado + f.iva_retenido_cobrado,
            iva_retenido_pagado: acc.iva_retenido_pagado + f.iva_retenido_pagado,
            iva_a_pagar: acc.iva_a_pagar + f.iva_a_pagar
        }),
        { iva_cobrado: 0, iva_acreditable: 0, iva_retenido_cobrado: 0, iva_retenido_pagado: 0, iva_a_pagar: 0 }
    )

    const exportarExcel = () => {
        const datosExcel = datos.map((f) => ({
            'Mes': f.mes_nombre,
            'IVA Trasladado Cobrado (Emitidas)': f.iva_cobrado,
            'IVA Trasladado Acreditable (Recibidas)': f.iva_acreditable,
            'IVA Retenido Cobrado': f.iva_retenido_cobrado,
            'IVA Retenido Pagado': f.iva_retenido_pagado,
            'IVA Estimado a Pagar': f.iva_a_pagar
        }))

        datosExcel.push({
            'Mes': 'TOTAL ANUAL',
            'IVA Trasladado Cobrado (Emitidas)': totales.iva_cobrado,
            'IVA Trasladado Acreditable (Recibidas)': totales.iva_acreditable,
            'IVA Retenido Cobrado': totales.iva_retenido_cobrado,
            'IVA Retenido Pagado': totales.iva_retenido_pagado,
            'IVA Estimado a Pagar': totales.iva_a_pagar
        })

        const ws = XLSX.utils.json_to_sheet(datosExcel)
        ws['!cols'] = Object.keys(datosExcel[0]).map((k) => ({ wch: Math.max(k.length, 18) }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, `IVA ${año}`)
        XLSX.writeFile(wb, `Reporte_IVA_${año}.xlsx`)
    }

    const sinDatos = datos.every((f) => f.iva_cobrado === 0 && f.iva_acreditable === 0)

    return {
        año, setAño,
        datos, totales,
        loading, error,
        exportarExcel,
        sinDatos,
        fmt,
        opcionesAño: Array.from({ length: 5 }, (_, i) => añoActual - i)
    }
}