import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { TipoCatalogo } from './CatalogoPage.hook'

export const useCatalogoPerfilPage = (tipo: TipoCatalogo) => {
  const { rfc } = useParams<{ rfc: string }>()
  const [datos, setDatos] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [cargando, setCargando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    if (rfc) cargar()
  }, [rfc])

  const cargar = async () => {
    setCargando(true)
    const res = await window.api.catalogoObtenerPorRfc(tipo, rfc!)
    if (res.success && res.data) {
      setDatos(res.data)
      setForm(res.data)
    }
    setCargando(false)
  }

  const cambiarCampo = (campo: string, valor: string) => {
    setForm((prev: any) => ({ ...prev, [campo]: valor }))
  }

  const guardar = async () => {
    setCargando(true)
    const res = await window.api.catalogoActualizar(tipo, rfc!, form)
    if (res.success) {
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    }
    setCargando(false)
  }

  return { datos, form, cargando, guardado, cambiarCampo, guardar }
}