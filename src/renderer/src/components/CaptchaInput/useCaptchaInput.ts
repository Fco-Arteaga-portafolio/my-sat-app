import { useState } from 'react'

export const useCaptchaInput = (portalId: string) => {
  const [captchaImg, setCaptchaImg] = useState<string | null>(null)
  const [captchaTexto, setCaptchaTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sesionActiva, setSesionActiva] = useState(false)

  const cargarCaptcha = async () => {
    setLoading(true)
    setError(null)
    setCaptchaTexto('')
    const res = await window.api.obtenerCaptchaDinamico(portalId)
    if (res.success && res.data?.sesionActiva) {
      // El SAT ya tiene sesión vigente (cookies reanudadas): no hay captcha.
      setCaptchaImg(null)
      setSesionActiva(true)
      setLoading(false)
      return
    }
    setSesionActiva(false)
    if (res.success && res.data?.imagenBase64) {
      setCaptchaImg(res.data.imagenBase64)
    } else {
      setError('No se pudo cargar el captcha. Intenta de nuevo.')
    }
    setLoading(false)
  }

  const limpiar = () => {
    setCaptchaImg(null)
    setCaptchaTexto('')
    setError(null)
    setSesionActiva(false)
  }

  return {
    captchaImg,
    captchaTexto,
    setCaptchaTexto,
    loading,
    error,
    sesionActiva,
    listo: !!captchaImg && !!captchaTexto.trim(),
    cargarCaptcha,
    limpiar
  }
}
