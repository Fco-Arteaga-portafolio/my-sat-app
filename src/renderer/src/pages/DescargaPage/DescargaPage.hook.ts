import { useState, useEffect } from 'react'
import { Configuracion } from '../../../../main/services/ConfiguracionService'
import { ProgresoDescarga } from '../../../../main/scraper/SatScraper'

export interface DescargaForm {
  buscarPor: 'fecha' | 'folio'
  fechaInicio: string
  fechaFin: string
  folioFiscal: string
  tipo: 'emitidas' | 'recibidas'
  rfcTercero: string
  estadoComprobante: '' | 'vigente' | 'cancelado'
  tipoComprobante: '' | 'I' | 'E' | 'T' | 'N' | 'P'
}

export const useDescargaPage = () => {
  const [loading, setLoading] = useState(false)
  const [captcha, setCaptcha] = useState('')
  const [captchaListo, setCaptchaListo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null)
  const [progreso, setProgreso] = useState<ProgresoDescarga | null>(null)
  const [erroresDescarga, setErroresDescarga] = useState<{ uuid: string; error: string }[]>([])
  const [form, setForm] = useState<DescargaForm>({
    buscarPor: 'fecha',
    fechaInicio: '',
    fechaFin: '',
    folioFiscal: '',
    tipo: 'recibidas',
    rfcTercero: '',
    estadoComprobante: '',
    tipoComprobante: ''
  })

  useEffect(() => {
    cargarConfiguracion()
    window.api.onProgresoDescarga((p: ProgresoDescarga) => setProgreso(p))
  }, [])

  const cargarConfiguracion = async () => {
    const res = await window.api.obtenerConfiguracion()
    if (res.success && res.config) {
      setConfiguracion(res.config)
      return res.config
    }
    return null
  }

  const validar = (): boolean => {
    if (form.buscarPor === 'fecha') {
      if (!form.fechaInicio) { setError('La fecha de inicio es obligatoria'); return false }
      if (!form.fechaFin) { setError('La fecha fin es obligatoria'); return false }
      const [dI, mI, aI] = form.fechaInicio.split('/').map(Number)
      const [dF, mF, aF] = form.fechaFin.split('/').map(Number)
      const inicio = new Date(aI, mI - 1, dI)
      const fin = new Date(aF, mF - 1, dF)
      const diffMeses = (fin.getFullYear() - inicio.getFullYear()) * 12 + (fin.getMonth() - inicio.getMonth())
      if (diffMeses > 3) { setError('El rango máximo de búsqueda es 3 meses.'); return false }
    } else {
      if (!form.folioFiscal.trim()) { setError('El folio fiscal es obligatorio'); return false }
    }
    if (configuracion?.metodoAuth === 'contrasena' && !captcha.trim()) {
      setError('Carga y escribe el captcha antes de continuar')
      return false
    }
    setError(null)
    return true
  }

  const descargar = async (limpiarCaptcha: () => void) => {
    if (!validar() || !configuracion) return
    setLoading(true)
    setResultado(null)
    setProgreso(null)
    setErroresDescarga([])

    const res = await window.api.descargarFacturas({
      captcha,
      params: {
        tipo: form.tipo,
        buscarPor: form.buscarPor,
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        folioFiscal: form.folioFiscal,
        rfcTercero: form.rfcTercero,
        estadoComprobante: form.estadoComprobante,
        tipoComprobante: form.tipoComprobante
      }
    })

    if (res.success) {
      const errores = res.errores || []
      setErroresDescarga(errores)
      setResultado(`Se descargaron ${res.total} facturas.${errores.length > 0 ? ` ${errores.length} fallaron.` : ''}`)
      limpiarCaptcha()
    } else {
      setError(`Error al descargar: ${res.error}`)
    }

    setLoading(false)
    setProgreso(null)
  }

  const cambiarForm = <K extends keyof DescargaForm>(campo: K, valor: DescargaForm[K]) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  return {
    form, loading, captchaListo, error, resultado,
    configuracion, progreso, erroresDescarga,
    setCaptcha, setCaptchaListo,
    descargar, cambiarForm
  }
}