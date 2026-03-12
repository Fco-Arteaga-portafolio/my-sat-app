import { useState } from 'react'

export const useCaptchaInput = () => {
  const [captchaImg, setCaptchaImg] = useState<string | null>(null)
  const [captchaTexto, setCaptchaTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarCaptcha = async () => {
    setLoading(true)
    setError(null)
    setCaptchaTexto('')
    const res = await window.api.obtenerCaptcha()
    if (res.success && res.imagenBase64) {
      setCaptchaImg(res.imagenBase64)
    } else {
      setError('No se pudo cargar el captcha. Intenta de nuevo.')
    }
    setLoading(false)
  }

  const limpiar = () => {
    setCaptchaImg(null)
    setCaptchaTexto('')
    setError(null)
  }

  return {
    captchaImg,
    captchaTexto,
    setCaptchaTexto,
    loading,
    error,
    listo: !!captchaImg && !!captchaTexto.trim(),
    cargarCaptcha,
    limpiar
  }
}