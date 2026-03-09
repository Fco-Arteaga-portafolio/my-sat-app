import { useState, useEffect } from 'react'
import { DescargaPendiente } from '../../../../main/database/repositories/DescargaPendienteRepository'
import { ProgresoDescarga } from '../../../../main/scraper/SatScraper'
import { useContribuyente } from '@renderer/context/ContribuyenteContext'

export const usePendientesPage = () => {
  const [pendientes, setPendientes] = useState<DescargaPendiente[]>([])
  const [loading, setLoading] = useState(false)
  const [reintentando, setReintentando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [configuracion, setConfiguracion] = useState<any>(null)
  const [progreso, setProgreso] = useState<ProgresoDescarga | null>(null)
  const [captchaBase64, setCaptchaBase64] = useState<string | null>(null)
  const [captchaTexto, setCaptchaTexto] = useState('')
  const [cargandoCaptcha, setCargandoCaptcha] = useState(false)
  const { perfil } = useContribuyente()

  useEffect(() => {
    cargarConfiguracion()
    window.api.onProgresoDescarga((p: ProgresoDescarga) => {
      setProgreso(p)
    })
    if (perfil) cargarPendientes()
  }, [perfil?.rfc])

  const cargarConfiguracion = async () => {
    const res = await window.api.obtenerConfiguracion()
    if (res.success && res.config) setConfiguracion(res.config)
  }

  const cargarPendientes = async () => {
    setLoading(true)
    const res = await window.api.obtenerPendientes()
    if (res.success && res.pendientes) setPendientes(res.pendientes)
    setLoading(false)
  }

  const obtenerCaptcha = async () => {
    setCargandoCaptcha(true)
    setError(null)
    const res = await window.api.obtenerCaptcha()
    if (res.success && res.imagenBase64) {
      setCaptchaBase64(res.imagenBase64)
    } else {
      setError('No se pudo cargar el captcha. Intenta de nuevo.')
    }
    setCargandoCaptcha(false)
  }

  const reintentar = async () => {
    if (configuracion?.metodoAuth === 'contrasena' && !captchaTexto.trim()) {
      setError('Debes escribir el captcha')
      return
    }

    setReintentando(true)
    setResultado(null)
    setError(null)
    setProgreso(null)

    const res = await window.api.reintentarPendientes({
      captcha: captchaTexto
    })

    if (res.success) {
      const errores = res.errores || []
      setResultado(`Se descargaron ${res.total} facturas. ${errores.length > 0 ? `${errores.length} siguen pendientes.` : 'Todas exitosas.'}`)
      setCaptchaBase64(null)
      setCaptchaTexto('')
      await cargarPendientes()
    } else {
      setCaptchaBase64(null)
      setCaptchaTexto('')
      setError(res.error || 'Error al reintentar')
    }

    setReintentando(false)
    setProgreso(null)
  }

  const limpiar = async () => {
    await window.api.limpiarPendientes()
    setPendientes([])
    setResultado(null)
  }

  return {
    pendientes, loading, reintentando, resultado, error,
    configuracion, progreso, captchaBase64, captchaTexto, cargandoCaptcha,
    cargarPendientes, reintentar, limpiar, obtenerCaptcha, setCaptchaTexto
  }
}