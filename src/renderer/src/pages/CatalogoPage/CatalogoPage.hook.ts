import { useState, useEffect } from 'react'
import { useContribuyente } from '../../context/ContribuyenteContext'

export type TipoCatalogo = 'clientes' | 'proveedores' | 'empleados' | 'patrones'

export const useCatalogoPage = (tipo: TipoCatalogo) => {
  const { perfil } = useContribuyente()
  const [datos, setDatos] = useState<any[]>([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (perfil) cargar()
  }, [perfil?.rfc])

  const cargar = async () => {
    setCargando(true)
    const res = await window.api.catalogoObtener(tipo)
    if (res.success) setDatos(res.data)
    setCargando(false)
  }

  const sincronizar = async () => {
    setCargando(true)
    const res = await window.api.catalogoSincronizar()
    console.log('sincronizar res:', res)
    if (res.success) {
      const res2 = await window.api.catalogoObtener(tipo)
      console.log('datos tras sync:', res2)
      if (res2.success) setDatos(res2.data)
    }
    setCargando(false)
  }

  const datosFiltrados = datos.filter(d =>
    d.rfc?.toLowerCase().includes(busqueda.toLowerCase()) ||
    d.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return { datos: datosFiltrados, cargando, busqueda, setBusqueda, sincronizar }
}