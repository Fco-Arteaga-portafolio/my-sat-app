import { useState, useEffect } from 'react'

export interface FormConciliacion {
  tipo: 'emitidas' | 'recibidas'
  ejercicio: string
  periodo: string
}

export interface ResumenConciliacion {
  totalSat: number
  totalLocal: number
  descargadas: number
  actualizadas: number
  errores: { uuid: string; error: string }[]
}

const anioActual = new Date().getFullYear()
const EJERCICIOS = Array.from({ length: anioActual - 2013 }, (_, i) => String(anioActual - i))
const PERIODOS = [
  { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
]

export const useConciliacionPage = () => {
  const mesActual = String(new Date().getMonth() + 1)

  const [form, setForm] = useState<FormConciliacion>({
    tipo: 'recibidas',
    ejercicio: String(anioActual),
    periodo: mesActual
  })
  const [captcha, setCaptcha] = useState('')
  const [captchaListo, setCaptchaListo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [etapa, setEtapa] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<{ descargadas?: number; totalFaltantes?: number } | null>(null)
  const [resumen, setResumen] = useState<ResumenConciliacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [configuracion, setConfiguracion] = useState<any>(null)

  useEffect(() => {
    window.api.obtenerConfiguracion().then((res: any) => {
      if (res.success && res.config) setConfiguracion(res.config)
    })
  }, [])

  const cambiarForm = (campo: keyof FormConciliacion, valor: string) => {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  const iniciar = async (limpiarCaptcha: () => void) => {
    console.log('iniciar llamado', { configuracion, captcha, captchaListo })
    if (configuracion?.metodoAuth === 'contrasena' && !captcha.trim()) {
      setError('Carga y escribe el captcha antes de continuar')
      return
    }
    setLoading(true)
    setError(null)
    setResumen(null)
    setEtapa('autenticando')
    console.log('antes de llamar iniciarConciliacion')
    window.api.onProgresoConciliacion((p: any) => {
      setEtapa(p.etapa)
      if (p.descargadas !== undefined) {
        setProgreso({ descargadas: p.descargadas, totalFaltantes: p.totalFaltantes })
      }
    })

    const res = await window.api.iniciarConciliacion({
      tipo: form.tipo,
      ejercicio: form.ejercicio,
      periodo: form.periodo,
      captcha
    })
    console.log('respuesta iniciarConciliacion', res)

    if (res.success) {
      setResumen(res.resumen)
    } else {
      setError(res.error || 'Error en la conciliación')
    }

    limpiarCaptcha()
    setEtapa(null)
    setProgreso(null)
    setLoading(false)
  }

  const etapaLabel: Record<string, string> = {
    autenticando: 'Autenticando con el SAT...',
    consultando: 'Consultando listado en el SAT...',
    comparando: 'Comparando con registros locales...',
    descargando: 'Descargando facturas faltantes...',
    actualizando: 'Actualizando estados...',
    completado: 'Completado'
  }

  return {
    form, captchaListo, configuracion, loading,
    etapa, etapaLabel, progreso, resumen, error,
    ejercicios: EJERCICIOS, periodos: PERIODOS,
    setCaptcha, setCaptchaListo,
    cambiarForm, iniciar
  }
}