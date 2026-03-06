import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export interface Perfil {
  id?: number
  rfc: string
  nombre: string
  metodo_auth: 'contrasena' | 'efirma'
  contrasena?: string
  ruta_cer?: string
  ruta_key?: string
  contrasena_fiel?: string
  carpeta_descarga?: string
}

export const usePerfilesPage = (onPerfilSeleccionado?: () => void) => {
  const navigate = useNavigate()
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Perfil>({
    rfc: '',
    nombre: '',
    metodo_auth: 'contrasena',
    contrasena: '',
    carpeta_descarga: ''
  })

  useEffect(() => {
    cargarPerfiles()
  }, [])


  const cargarPerfiles = async () => {
    setLoading(true)
    const res = await window.api.obtenerPerfiles()
    if (res.success && res.perfiles) {
      setPerfiles(res.perfiles)
    }
    setLoading(false)
  }

  const seleccionar = async (rfc: string) => {
    const res = await window.api.seleccionarPerfil(rfc)
    if (res.success) {
      onPerfilSeleccionado?.()
      setTimeout(() => navigate('/facturas'), 100)  // ← pequeño delay para que React actualice
    } else {
      setError(res.error || 'Error al seleccionar perfil')
    }
  }

  const guardar = async () => {
    if (!form.rfc || !form.nombre) {
      setError('RFC y nombre son obligatorios')
      return
    }
    setLoading(true)
    const res = await window.api.crearPerfil(form)
    if (res.success) {
      setModalVisible(false)
      setForm({ rfc: '', nombre: '', metodo_auth: 'contrasena', contrasena: '', carpeta_descarga: '' })
      await cargarPerfiles()
    } else {
      setError(res.error || 'Error al guardar perfil')
    }
    setLoading(false)
  }

  const eliminar = async (rfc: string) => {
    const res = await window.api.eliminarPerfil(rfc)
    if (res.success) {
      await cargarPerfiles()
    }
  }

  const cambiarForm = (campo: string, valor: string) => {
    // ContribuyenteForm usa metodoAuth pero el perfil usa metodo_auth
    const campoMapeado = campo === 'metodoAuth' ? 'metodo_auth' : campo
    setForm(prev => ({ ...prev, [campoMapeado]: valor }))
  }

  const seleccionarCarpeta = async () => {
    const res = await window.api.seleccionarCarpeta()
    if (res.success && res.ruta) {
      cambiarForm('carpeta_descarga', res.ruta)
    }
  }

  const seleccionarCer = async () => {
    const res = await window.api.seleccionarArchivo([{ name: 'Certificado', extensions: ['cer'] }])
    if (res.success && res.ruta) cambiarForm('ruta_cer', res.ruta)
  }

  const seleccionarKey = async () => {
    const res = await window.api.seleccionarArchivo([{ name: 'Llave privada', extensions: ['key'] }])
    if (res.success && res.ruta) cambiarForm('ruta_key', res.ruta)
  }

  return {
    perfiles, loading, modalVisible, error, form,
    setModalVisible, seleccionar, guardar, eliminar,
    cambiarForm, seleccionarCarpeta, seleccionarCer, seleccionarKey
  }
}