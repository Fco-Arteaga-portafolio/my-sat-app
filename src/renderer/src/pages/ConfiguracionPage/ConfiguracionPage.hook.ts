import { useState, useEffect } from 'react'
import { Configuracion } from '../../../../main/services/ConfiguracionService'

export const useConfiguracionPage = () => {
  const [loading, setLoading] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<Configuracion>({
    rfc: '',
    metodoAuth: 'contrasena',
    contrasena: '',
    rutaCer: '',
    rutaKey: '',
    contrasenaFiel: '',
    carpetaDescarga: ''
  })

  useEffect(() => {
    cargarConfiguracion()
  }, [])

  const cargarConfiguracion = async () => {
    const resultado = await window.api.obtenerConfiguracion()
    if (resultado.success && resultado.config) {
      setConfig(resultado.config)
    }
  }

  const guardar = async () => {
    if (!validar()) return

    setLoading(true)
    const resultado = await window.api.guardarConfiguracion(config)
    if (resultado.success) {
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    }
    setLoading(false)
  }

  const cambiarMetodo = (metodo: 'contrasena' | 'efirma') => {
    setConfig({ ...config, metodoAuth: metodo })
  }

  const cambiarCampo = (campo: string, valor: string) => {
    setConfig(prev => ({ ...prev, [campo]: valor }))
  }

  const seleccionarCer = async () => {
    const resultado = await window.api.seleccionarArchivo([
      { name: 'Certificado', extensions: ['cer'] }
    ])
    if (resultado.success && resultado.ruta) {
      cambiarCampo('rutaCer', resultado.ruta)
    }
  }

  const seleccionarKey = async () => {
    const resultado = await window.api.seleccionarArchivo([
      { name: 'Clave privada', extensions: ['key'] }
    ])
    if (resultado.success && resultado.ruta) {
      cambiarCampo('rutaKey', resultado.ruta)
    }
  }

  const validar = (): boolean => {
    if (!config.rfc.trim()) {
      setError('El RFC es obligatorio')
      return false
    }

    if (config.metodoAuth === 'contrasena' && !config.contrasena?.trim()) {
      setError('La contraseña es obligatoria')
      return false
    }

    if (config.metodoAuth === 'efirma') {
      if (!config.rutaCer?.trim()) {
        setError('El archivo .cer es obligatorio')
        return false
      }
      if (!config.rutaKey?.trim()) {
        setError('El archivo .key es obligatorio')
        return false
      }
      if (!config.contrasenaFiel?.trim()) {
        setError('La contraseña de la e.firma es obligatoria')
        return false
      }
    }

    setError(null)
    return true
  }

  const seleccionarCarpeta = async () => {
    const resultado = await window.api.seleccionarCarpeta()
    if (resultado.success && resultado.ruta) {
      cambiarCampo('carpetaDescarga', resultado.ruta)
    }
  }

  return {
    config,
    loading,
    guardado,
    error,
    guardar,
    cambiarMetodo,
    cambiarCampo,
    seleccionarCer,
    seleccionarKey,
    seleccionarCarpeta
  }
}