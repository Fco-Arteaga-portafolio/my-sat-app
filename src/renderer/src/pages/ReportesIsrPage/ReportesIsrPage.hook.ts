import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'

export type RegimenIsr =
    | 'actividad_empresarial'
    | 'honorarios'
    | 'arrendamiento'
    | 'pm_general'
    | 'resico_pf'
    | 'resico_pm'

export const REGIMENES: { value: RegimenIsr; label: string }[] = [
    { value: 'actividad_empresarial', label: 'Actividad empresarial y profesional' },
    { value: 'honorarios', label: 'Servicios profesionales / Honorarios' },
    { value: 'arrendamiento', label: 'Arrendamiento' },
    { value: 'pm_general', label: 'Persona moral – Régimen general (30%)' },
    { value: 'resico_pf', label: 'RESICO Persona Física (2.5%)' },
    { value: 'resico_pm', label: 'RESICO Persona Moral (1%)' },
]

const REGIMEN_SAT_MAP: Record<string, RegimenIsr> = {
    '612': 'actividad_empresarial',
    '606': 'arrendamiento',
    '601': 'pm_general',
    '626': 'resico_pf',
    '625': 'resico_pm',
    '614': 'honorarios',
    '608': 'actividad_empresarial',
    '611': 'actividad_empresarial',
    '615': 'honorarios',
}

export interface FilaIsrMes {
    mes: number
    mes_nombre: string
    ingresos: number
    gastos: number
    base_gravable: number
    isr_causado: number
    isr_retenido: number
    isr_a_pagar: number
}

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const añoActual = new Date().getFullYear()

export const fmt = (n: number) =>
    (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export const useReportesIsrPage = () => {
    const [año, setAño] = useState<number>(añoActual)
    const [regimen, setRegimen] = useState<RegimenIsr | null>(null)
    const [regimenDetectado, setRegimenDetectado] = useState<string | null>(null)
    const [loadingRegimen, setLoadingRegimen] = useState(true)
    const [datos, setDatos] = useState<FilaIsrMes[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Detectar régimen automáticamente al montar
    useEffect(() => {
        const detectar = async () => {
            setLoadingRegimen(true)
            try {
                const res = await window.api.reportesDetectarRegimen()
                if (res.success && res.data) {
                    setRegimenDetectado(res.data)
                    const mapped = REGIMEN_SAT_MAP[res.data] ?? 'actividad_empresarial'
                    setRegimen(mapped)
                } else {
                    setRegimen('actividad_empresarial')
                }
            } catch {
                setRegimen('actividad_empresarial')
            } finally {
                setLoadingRegimen(false)
            }
        }
        detectar()
    }, [])

    const cargar = useCallback(async () => {
        if (!regimen) return
        setLoading(true)
        setError(null)
        try {
            const res = await window.api.reportesIsrAnual(año, regimen)
            if (!res.success) throw new Error(res.error)

            const { meses } = res.data

            const filas: FilaIsrMes[] = MESES.map((nombre, idx) => {
                const m = meses.find((x: any) => x.mes === idx + 1)
                return {
                    mes: idx + 1,
                    mes_nombre: nombre,
                    ingresos: m?.ingresos ?? 0,
                    gastos: m?.gastos ?? 0,
                    base_gravable: m?.base_gravable ?? 0,
                    isr_causado: m?.isr_causado ?? 0,
                    isr_retenido: m?.isr_retenido ?? 0,
                    isr_a_pagar: m?.isr_a_pagar ?? 0,
                }
            })

            setDatos(filas)
        } catch (e) {
            setError(String(e))
        } finally {
            setLoading(false)
        }
    }, [año, regimen])

    useEffect(() => {
        cargar()
    }, [cargar])

    const totales = datos.reduce(
        (acc, f) => ({
            ingresos: acc.ingresos + f.ingresos,
            gastos: acc.gastos + f.gastos,
            base_gravable: acc.base_gravable + f.base_gravable,
            isr_causado: acc.isr_causado + f.isr_causado,
            isr_retenido: acc.isr_retenido + f.isr_retenido,
            isr_a_pagar: acc.isr_a_pagar + f.isr_a_pagar,
        }),
        { ingresos: 0, gastos: 0, base_gravable: 0, isr_causado: 0, isr_retenido: 0, isr_a_pagar: 0 }
    )

    const exportarExcel = () => {
        const datosExcel = datos.map((f) => ({
            'Mes': f.mes_nombre,
            'Ingresos': f.ingresos,
            'Gastos': f.gastos,
            'Base Gravable': f.base_gravable,
            'ISR Causado': f.isr_causado,
            'ISR Retenido': f.isr_retenido,
            'ISR a Pagar Est.': f.isr_a_pagar,
        }))

        datosExcel.push({
            'Mes': 'TOTAL ANUAL',
            'Ingresos': totales.ingresos,
            'Gastos': totales.gastos,
            'Base Gravable': totales.base_gravable,
            'ISR Causado': totales.isr_causado,
            'ISR Retenido': totales.isr_retenido,
            'ISR a Pagar Est.': totales.isr_a_pagar,
        })

        const ws = XLSX.utils.json_to_sheet(datosExcel)
        ws['!cols'] = Object.keys(datosExcel[0]).map((k) => ({ wch: Math.max(k.length, 16) }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, `ISR ${año}`)
        XLSX.writeFile(wb, `Reporte_ISR_${año}_${regimen}.xlsx`)
    }

    const sinDatos = datos.every((f) => f.ingresos === 0)

    return {
        año, setAño,
        regimen,
        regimenDetectado,
        loadingRegimen,
        datos, totales,
        loading, error,
        exportarExcel, sinDatos,
        fmt,
        opcionesAño: Array.from({ length: 5 }, (_, i) => añoActual - i)
    }
}