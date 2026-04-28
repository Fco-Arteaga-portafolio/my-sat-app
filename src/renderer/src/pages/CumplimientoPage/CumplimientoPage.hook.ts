import { useState, useEffect } from 'react'

export interface OpinionCumplimiento {
    resultado: 'positivo' | 'negativo' | 'unknown'
    fecha_emision: string
    fecha_vigencia?: string
    descripcion: string
    rutaArchivo?: string
}

export function useCumplimientoPage() {
    const [captchaBase64, setCaptchaBase64] = useState<string>('')
    const [captchaInput, setCaptchaInput] = useState<string>('')
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
    }, [])

    useEffect(() => {
        window.api.onProgresoCumplimiento((mensaje: string) => {
            setProgreso(mensaje)
        })
    }, [])

    const cargarCaptcha = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await window.api.obtenerCaptcha()
            if (res.success) {
                setCaptchaBase64(res.data.imagenBase64)
            } else {
                setError(res.error ?? 'Error cargando captcha')
            }
        } catch {
            setError('Error de conexión al cargar captcha')
        } finally {
            setLoading(false)
        }
    }

    const obtenerOpinion = async () => {
        setLoading(true)
        setError('')
        setProgreso('')
        try {
            const res = await window.api.obtenerOpinion({
                captcha: tipoLogin === 'ciec' ? captchaInput : undefined
            })

            if (res.success) {
                setResultado(res.data)
                setCaptchaInput('')
                setCaptchaBase64('')
            } else {
                setError(res.error ?? 'Error al obtener la opinión')
            }
        } catch {
            setError('Error de conexión al obtener opinión')
        } finally {
            setLoading(false)
            setProgreso('')
        }
    }

    const reiniciar = async () => {
        setResultado(null)
        setError('')
        setProgreso('')
        setCaptchaBase64('')
        setCaptchaInput('')
        await window.api.cerrarSesion().catch(() => null)
    }

    const abrirArchivo = () => {
        if (resultado?.rutaArchivo) {
            window.api.abrirArchivo(resultado.rutaArchivo)
        }
    }

    const puedeEnviar =
        tipoLogin === 'fiel' || (captchaBase64 !== '' && captchaInput.trim().length > 0)

    return {
        captchaBase64,
        captchaInput,
        setCaptchaInput,
        loading,
        progreso,
        resultado,
        error,
        tipoLogin,
        puedeEnviar,
        cargarCaptcha,
        obtenerOpinion,
        reiniciar,
        abrirArchivo
    }
}