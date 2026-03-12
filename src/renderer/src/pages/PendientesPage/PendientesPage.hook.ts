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
  const [captcha, setCaptcha] = useState('')
  const [captchaListo, setCaptchaListo] = useState(false)
  const { perfil } = useContribuyente()

  useEffect(() => {
    cargarConfiguracion()
    window.api.onProgresoDescarga((p: ProgresoDescarga) => setProgreso(p))
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

  const reintentar = async (limpiarCaptcha: () => void) => {
    if (configuracion?.metodoAuth === 'contrasena' && !captcha.trim()) {
      setError('Carga y escribe el captcha antes de continuar')
      return
    }
    setReintentando(true)
    setResultado(null)
    setError(null)
    setProgreso(null)

    const res = await window.api.reintentarPendientes({ captcha })

    if (res.success) {
      const errores = res.errores || []
      setResultado(`Se descargaron ${res.total} facturas. ${errores.length > 0 ? `${errores.length} siguen pendientes.` : 'Todas exitosas.'}`)
      limpiarCaptcha()
      await cargarPendientes()
    } else {
      setError(res.error || 'Error al reintentar')
      limpiarCaptcha()
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
    configuracion, progreso, captchaListo,
    setCaptcha, setCaptchaListo,
    cargarPendientes, reintentar, limpiar
  }
}