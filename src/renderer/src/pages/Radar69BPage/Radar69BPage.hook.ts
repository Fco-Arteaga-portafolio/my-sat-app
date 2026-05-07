import { useState, useEffect } from 'react'

interface EfosRiesgo {
    rfc: string
    nombre: string
    situacion: 'Definitivo' | 'Presunto'
    total_facturas: number
    monto_total: number
}

interface Analisis {
    definitivos: EfosRiesgo[]
    presuntos: EfosRiesgo[]
    montoDefinitivo: number
    montoPresunto: number
    sinRiesgo: boolean
}

interface Meta {
    ultima_sync: string | null
    total_registros: number
}

interface EstadoRadar69B {
    meta: Meta | null
    analisis: Analisis | null
    sincronizando: boolean
    progreso: string
    cargando: boolean
    error: string | null
    sincronizar: () => Promise<void>
}

export const useRadar69B = (): EstadoRadar69B => {
    const [meta, setMeta] = useState<Meta | null>(null)
    const [analisis, setAnalisis] = useState<Analisis | null>(null)
    const [sincronizando, setSincronizando] = useState(false)
    const [progreso, setProgreso] = useState('')
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const ejecutarAnalisis = async (): Promise<void> => {
        const res = await window.api.lista69bAnalizar()
        if (res.success && res.data) setAnalisis(res.data as Analisis)
    }

    const sincronizar = async (): Promise<void> => {
        setSincronizando(true)
        setError(null)
        setAnalisis(null)

        const res = await window.api.lista69bSincronizar()

        if (res.success) {
            const resMeta = await window.api.lista69bObtenerMeta()
            if (resMeta.success && resMeta.data) setMeta(resMeta.data)
            await ejecutarAnalisis()
        } else {
            setError(res.error ?? 'Error al sincronizar la lista 69-B')
        }

        setProgreso('')
        setSincronizando(false)
    }

    useEffect(() => {
        window.api.onProgresoLista69B(setProgreso)
    }, [])

    useEffect(() => {
        const inicializar = async (): Promise<void> => {
            const resMeta = await window.api.lista69bObtenerMeta()
            if (resMeta.success && resMeta.data) {
                setMeta(resMeta.data)
                if (resMeta.data.ultima_sync) await ejecutarAnalisis()
            }
            setCargando(false)
        }
        inicializar()
    }, [])

    return { meta, analisis, sincronizando, progreso, cargando, error, sincronizar }
}