import { useState, useEffect } from 'react'
import { Configuracion, SlotCarpeta, ConfigNombreArchivo } from '../../../../main/services/ConfiguracionService'
import { validarContribuyenteForm } from '../../utils/validarContribuyenteForm'

const ESTRUCTURA_DEFAULT: SlotCarpeta[] = [
  { id: 'contribuyente', label: 'Contribuyente', activo: true },
  { id: 'ejercicio', label: 'Ejercicio', activo: true },
  { id: 'periodo', label: 'Periodo', activo: false },
  { id: 'emisor', label: 'Emisor', activo: false },
  { id: 'receptor', label: 'Receptor', activo: false }
]

const CONFIG_NOMBRE_DEFAULT: ConfigNombreArchivo = {
  rfcEmisor: true,
  rfcReceptor: false
}

const configVacia = (): Configuracion => ({
  rfc: '',
  metodoAuth: 'contrasena',
  contrasena: '',
  rutaCer: '',
  rutaKey: '',
  contrasenaFiel: '',
  carpetaDescarga: '',
  plantillaDefault: 'clasica',
  carpetaEmitidos: '',
  carpetaRecibidos: '',
  estructuraEmitidos: [...ESTRUCTURA_DEFAULT],
  estructuraRecibidos: [...ESTRUCTURA_DEFAULT],
  configNombreArchivo: { ...CONFIG_NOMBRE_DEFAULT }
})

export const useConfiguracionPage = () => {
  const [loading, setLoading] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<Configuracion>(configVacia())

  useEffect(() => {
    cargarConfiguracion()
  }, [])

  const cargarConfiguracion = async () => {
    const resultado = await window.api.obtenerConfiguracion()
    if (resultado.success && resultado.config) {
      setConfig({
        ...configVacia(),
        ...resultado.config,
        estructuraEmitidos: resultado.config.estructuraEmitidos?.length ? resultado.config.estructuraEmitidos : [...ESTRUCTURA_DEFAULT],
        estructuraRecibidos: resultado.config.estructuraRecibidos?.length ? resultado.config.estructuraRecibidos : [...ESTRUCTURA_DEFAULT],
        configNombreArchivo: resultado.config.configNombreArchivo ?? { ...CONFIG_NOMBRE_DEFAULT }
      })
    }
  }

  const validar = (): boolean => {
    const err = validarContribuyenteForm(config as any)
    if (err) { setError(err); return false }
    setError(null)
    return true
  }

  const guardar = async () => {
    if (!validar()) return
    setLoading(true)
    const resultado = await window.api.guardarConfiguracion(config)
    if (resultado.success) {
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } else {
      setError(resultado.error || 'Error al guardar')
    }
    setLoading(false)
  }

  const cambiarMetodo = (metodo: 'contrasena' | 'efirma') => {
    setConfig(prev => ({ ...prev, metodoAuth: metodo }))
  }

  const cambiarCampo = (campo: keyof Configuracion, valor: any) => {
    setConfig(prev => ({ ...prev, [campo]: valor }))
  }

  const seleccionarCer = async () => {
    const resultado = await window.api.seleccionarArchivo([{ name: 'Certificado', extensions: ['cer'] }])
    if (resultado.success && resultado.ruta) cambiarCampo('rutaCer', resultado.ruta)
  }

  const seleccionarKey = async () => {
    const resultado = await window.api.seleccionarArchivo([{ name: 'Clave privada', extensions: ['key'] }])
    if (resultado.success && resultado.ruta) cambiarCampo('rutaKey', resultado.ruta)
  }

  const seleccionarCarpeta = async () => {
    const resultado = await window.api.seleccionarCarpeta()
    if (resultado.success && resultado.ruta) cambiarCampo('carpetaDescarga', resultado.ruta)
  }

  const seleccionarCarpetaEmitidos = async () => {
    const resultado = await window.api.seleccionarCarpeta()
    if (resultado.success && resultado.ruta) cambiarCampo('carpetaEmitidos', resultado.ruta)
  }

  const seleccionarCarpetaRecibidos = async () => {
    const resultado = await window.api.seleccionarCarpeta()
    if (resultado.success && resultado.ruta) cambiarCampo('carpetaRecibidos', resultado.ruta)
  }

  const moverSlot = (tipo: 'emitidos' | 'recibidos', desde: number, hasta: number) => {
    const campo = tipo === 'emitidos' ? 'estructuraEmitidos' : 'estructuraRecibidos'
    const slots = [...(config[campo] as SlotCarpeta[])]
    const [item] = slots.splice(desde, 1)
    slots.splice(hasta, 0, item)
    cambiarCampo(campo, slots)
  }

  const toggleSlot = (tipo: 'emitidos' | 'recibidos', id: string, activo: boolean) => {
    const campo = tipo === 'emitidos' ? 'estructuraEmitidos' : 'estructuraRecibidos'
    const slots = (config[campo] as SlotCarpeta[]).map(s =>
      s.id === id ? { ...s, activo } : s
    )
    cambiarCampo(campo, slots)
  }

  return {
    config, loading, guardado, error,
    guardar, cambiarMetodo, cambiarCampo,
    seleccionarCer, seleccionarKey, seleccionarCarpeta,
    seleccionarCarpetaEmitidos, seleccionarCarpetaRecibidos,
    moverSlot, toggleSlot
  }
}