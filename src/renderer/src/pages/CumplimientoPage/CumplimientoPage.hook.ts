import { useState, useEffect } from 'react'

export interface OpinionCumplimiento {
    resultado: 'positivo' | 'negativo' | 'unknown'
    fecha_emision: string
    fecha_vigencia?: string
    descripcion: string
    rutaArchivo?: string
}

export function useCumplimientoPage() {
    const [captcha, setCaptcha] = useState('')
    const [captchaListo, setCaptchaListo] = useState(false)
    const [loading, setLoading] = useState(false)
    const [progreso, setProgreso] = useState<string>('')
    const [resultado, setResultado] = useState<OpinionCumplimiento | null>(null)
    const [error, setError] = useState<string>('')
    const [tipoLogin, setTipoLogin] = useState<'ciec' | 'fiel'>('ciec')

    useEffect(() => {
        window.api.obtenerConfiguracion().then((res) => {
            if (res.success && res.config?.metodoAuth) {
                setTipoLogin(res.config.metodoAuth === 'efirma' ? 'fiel' : 'ciec')
            }
        })
        window.api.onProgresoCumplimiento((mensaje: string) => setProgreso(mensaje))
    }, [])

    const obtenerOpinion = async (limpiarCaptcha: () => void) => {
        setLoading(true)
        setError('')
        setProgreso('')
        try {
            const res = await window.api.obtenerOpinion({
                captcha: tipoLogin === 'ciec' ? captcha : undefined
            })
            if (res.success) {
                setResultado(res.data)
                limpiarCaptcha()
            } else {
                setError(res.error ?? 'Error al obtener la opinión')
            }
        } catch {
            setError('Error de conexión al obtener opinión')
        } finally {
            setLoading(false)
            setProgreso('')
            await window.api.cerrarSesion().catch(() => null)
        }
    }

    const reiniciar = async (limpiarCaptcha: () => void) => {
        setResultado(null)
        setError('')
        setProgreso('')
        limpiarCaptcha()
        await window.api.cerrarSesion().catch(() => null)
    }

    const abrirArchivo = () => {
        if (resultado?.rutaArchivo) window.api.abrirArchivo(resultado.rutaArchivo)
    }

    const puedeEnviar = tipoLogin === 'fiel' || captchaListo

    return {
        captchaListo,
        setCaptcha,
        setCaptchaListo,
        loading,
        progreso,
        resultado,
        error,
        tipoLogin,
        puedeEnviar,
        obtenerOpinion,
        reiniciar,
        abrirArchivo
    }
}