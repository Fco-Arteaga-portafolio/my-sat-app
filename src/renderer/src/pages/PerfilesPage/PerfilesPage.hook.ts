import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SlotCarpeta, ConfigNombreArchivo } from '../../../../main/services/ConfiguracionService'
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

export interface Perfil {
  id?: number
  rfc: string
  nombre: string
  metodo_auth: 'contrasena' | 'efirma'
  contrasena?: string
  ruta_cer?: string
  ruta_key?: string
  contrasena_fiel?: string
  // Carpetas
  carpeta_emitidos?: string
  carpeta_recibidos?: string
  estructura_emitidos?: SlotCarpeta[]
  estructura_recibidos?: SlotCarpeta[]
  // PDF
  plantilla_default?: string
  config_nombre_archivo?: ConfigNombreArchivo
}

const formVacio = (): Perfil => ({
  rfc: '',
  nombre: '',
  metodo_auth: 'contrasena',
  contrasena: '',
  carpeta_emitidos: '',
  carpeta_recibidos: '',
  estructura_emitidos: [...ESTRUCTURA_DEFAULT],
  estructura_recibidos: [...ESTRUCTURA_DEFAULT],
  plantilla_default: 'clasica',
  config_nombre_archivo: { ...CONFIG_NOMBRE_DEFAULT }
})

export const usePerfilesPage = (onPerfilSeleccionado?: (perfil: any) => void) => {
  const navigate = useNavigate()
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Perfil>(formVacio())

  useEffect(() => {
    cargarPerfiles()
  }, [])

  const cargarPerfiles = async () => {
    setLoading(true)
    const res = await window.api.obtenerPerfiles()
    if (res.success && res.perfiles) setPerfiles(res.perfiles)
    setLoading(false)
  }

  const seleccionar = async (rfc: string) => {
    const res = await window.api.seleccionarPerfil(rfc)
    if (res.success) {
      onPerfilSeleccionado?.(res.perfil)
      navigate('/inicio')
    }
  }

  const guardar = async () => {
    const err = validarContribuyenteForm(form as any)
    if (err) { setError(err); return }
    setLoading(true)
    const res = await window.api.crearPerfil(form)
    if (res.success) {
      setModalVisible(false)
      setForm(formVacio())
      await cargarPerfiles()
    } else {
      setError(res.error || 'Error al guardar perfil')
    }
    setLoading(false)
  }

  const eliminar = async (rfc: string) => {
    const res = await window.api.eliminarPerfil(rfc)
    if (res.success) await cargarPerfiles()
  }

  // ContribuyenteForm usa camelCase, el perfil usa snake_case
  const CAMPO_MAP: Record<string, keyof Perfil> = {
    metodoAuth: 'metodo_auth',
    rutaCer: 'ruta_cer',
    rutaKey: 'ruta_key',
    contrasenaFiel: 'contrasena_fiel',
    carpetaEmitidos: 'carpeta_emitidos',
    carpetaRecibidos: 'carpeta_recibidos',
    estructuraEmitidos: 'estructura_emitidos',
    estructuraRecibidos: 'estructura_recibidos',
    plantillaDefault: 'plantilla_default',
    configNombreArchivo: 'config_nombre_archivo'
  }

  const cambiarForm = (campo: string, valor: any) => {
    const campoMapeado = CAMPO_MAP[campo] ?? campo
    setForm(prev => ({ ...prev, [campoMapeado]: valor }))
  }

  const seleccionarCarpetaEmitidos = async () => {
    const res = await window.api.seleccionarCarpeta()
    if (res.success && res.ruta) cambiarForm('carpetaEmitidos', res.ruta)
  }

  const seleccionarCarpetaRecibidos = async () => {
    const res = await window.api.seleccionarCarpeta()
    if (res.success && res.ruta) cambiarForm('carpetaRecibidos', res.ruta)
  }

  const seleccionarCer = async () => {
    const res = await window.api.seleccionarArchivo([{ name: 'Certificado', extensions: ['cer'] }])
    if (res.success && res.ruta) cambiarForm('rutaCer', res.ruta)
  }

  const seleccionarKey = async () => {
    const res = await window.api.seleccionarArchivo([{ name: 'Llave privada', extensions: ['key'] }])
    if (res.success && res.ruta) cambiarForm('rutaKey', res.ruta)
  }

  const moverSlot = (tipo: 'emitidos' | 'recibidos', desde: number, hasta: number) => {
    const campo = tipo === 'emitidos' ? 'estructura_emitidos' : 'estructura_recibidos'
    const slots = [...(form[campo] as SlotCarpeta[])]
    const [item] = slots.splice(desde, 1)
    slots.splice(hasta, 0, item)
    setForm(prev => ({ ...prev, [campo]: slots }))
  }

  const toggleSlot = (tipo: 'emitidos' | 'recibidos', id: string, activo: boolean) => {
    const campo = tipo === 'emitidos' ? 'estructura_emitidos' : 'estructura_recibidos'
    const slots = (form[campo] as SlotCarpeta[]).map(s =>
      s.id === id ? { ...s, activo } : s
    )
    setForm(prev => ({ ...prev, [campo]: slots }))
  }

  return {
    perfiles, loading, modalVisible, error, form,
    setModalVisible, seleccionar, guardar, eliminar,
    cambiarForm,
    seleccionarCarpetaEmitidos, seleccionarCarpetaRecibidos,
    seleccionarCer, seleccionarKey,
    moverSlot, toggleSlot
  }
}