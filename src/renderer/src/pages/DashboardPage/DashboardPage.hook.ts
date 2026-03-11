import { useState, useEffect } from 'react'
import { useContribuyente } from '../../context/ContribuyenteContext'

interface Kpis {
  ingresos: number
  egresos: number
  balance: number
  iva_estimado: number
  variacion_ingresos: number
  variacion_egresos: number
  variacion_balance: number
}

interface FlujoMes {
  mes: string
  ingresos: number
  egresos: number
}

interface TopItem {
  rfc: string
  nombre: string
  facturas: number
  total: number
}

export const useDashboardPage = () => {
  const { perfil } = useContribuyente()
  const ahora = new Date()
  const [año, setAño] = useState(ahora.getFullYear())
  const [mes, setMes] = useState(ahora.getMonth() + 1)
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [flujo, setFlujo] = useState<FlujoMes[]>([])
  const [topClientes, setTopClientes] = useState<TopItem[]>([])
  const [topProveedores, setTopProveedores] = useState<TopItem[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (perfil) cargar()
  }, [perfil?.rfc, año, mes])

  const cargar = async () => {
    setCargando(true)
    const [resKpis, resFlujo, resClientes, resProveedores] = await Promise.all([
      window.api.dashboardKpis(año, mes),
      window.api.dashboardFlujoAnual(año),
      window.api.dashboardTopClientes(año, mes),
      window.api.dashboardTopProveedores(año, mes)
    ])
    if (resKpis.success) setKpis(resKpis.data)
    if (resFlujo.success) setFlujo(normalizarFlujo(resFlujo.data))
    if (resClientes.success) setTopClientes(resClientes.data)
    if (resProveedores.success) setTopProveedores(resProveedores.data)
    setCargando(false)
  }

  const normalizarFlujo = (data: FlujoMes[]): FlujoMes[] => {
    const meses = ['01','02','03','04','05','06','07','08','09','10','11','12']
    const nombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return meses.map((m, i) => {
      const encontrado = data.find(d => d.mes === m)
      return {
        mes: nombres[i],
        ingresos: encontrado?.ingresos || 0,
        egresos: encontrado?.egresos || 0
      }
    })
  }

  return {
    año, mes, kpis, flujo, topClientes, topProveedores, cargando,
    setAño, setMes
  }
}