import { useRef, useState, useEffect } from 'react'
import { CaptchaInputRef } from '../../components/CaptchaInput/CaptchaInput'

export interface ConstanciaSituacionFiscal {
  rfc: string
  fecha_emision: string
  rutaArchivo?: string
  descripcion: string
}

export function useConstanciaPage() {
  const captchaRef = useRef<CaptchaInputRef>(null)
  const [captcha, setCaptcha] = useState('')
  const [captchaListo, setCaptchaListo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progreso, setProgreso] = useState<string>('')
  const [resultado, setResultado] = useState<ConstanciaSituacionFiscal | null>(null)
  const [error, setError] = useState<string>('')
  const [tipoLogin, setTipoLogin] = useState<'ciec' | 'fiel'>('ciec')

  useEffect(() => {
    window.api.obtenerConfiguracion().then((res) => {
      if (res.success && res.config?.metodoAuth) {
        setTipoLogin(res.config.metodoAuth === 'efirma' ? 'fiel' : 'ciec')
      }
    })
    window.api.onProgresoConstancia((mensaje: string) => setProgreso(mensaje))
  }, [])

  const obtenerConstancia = async () => {
    setLoading(true)
    setError('')
    setProgreso('')
    try {
      const res = await window.api.constanciaObtenerConstancia({
        captcha: tipoLogin === 'ciec' ? captcha : undefined
      })
      if (res.success) {
        setResultado(res.data)
        captchaRef.current?.limpiar()
      } else {
        setError(res.error ?? 'Error al obtener la constancia')
      }
    } catch {
      setError('Error de conexión al obtener constancia')
    } finally {
      setLoading(false)
      setProgreso('')
      await window.api.constanciaCerrarSesion().catch(() => null)
    }
  }

  const reiniciar = async () => {
    setResultado(null)
    setError('')
    setProgreso('')
    captchaRef.current?.limpiar()
    await window.api.constanciaCerrarSesion().catch(() => null)
  }

  const abrirArchivo = () => {
    if (resultado?.rutaArchivo) window.api.abrirArchivo(resultado.rutaArchivo)
  }

  const puedeEnviar = tipoLogin === 'fiel' || captchaListo

  return {
    captchaRef,
    captchaListo,
    setCaptcha,
    setCaptchaListo,
    loading,
    progreso,
    resultado,
    error,
    tipoLogin,
    puedeEnviar,
    obtenerConstancia,
    reiniciar,
    abrirArchivo
  }
}