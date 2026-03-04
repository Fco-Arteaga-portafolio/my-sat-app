import { useState, useEffect } from 'react'
import { Factura } from '../../../../main/database/repositories/FacturaRepository'

export const useFacturasPage = () => {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [filtroEstado, setFiltroEstado] = useState<string>('')
  const [configuracion, setConfiguracion] = useState<{ rfc: string; nombre: string } | null>(null)
  const [facturaDetalle, setFacturaDetalle] = useState<Factura | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [facturaSeleccionadaPdf, setFacturaSeleccionadaPdf] = useState<Factura | null>(null)
  const [modalPdfVisible, setModalPdfVisible] = useState(false)
  const [paginaActual, setPaginaActual] = useState(1)
  const [tamañoPagina, setTamañoPagina] = useState(20)

  useEffect(() => {
    cargarFacturas()
    cargarConfiguracion()
  }, [])

  const cargarFacturas = async () => {
    setLoading(true)
    const res = await window.api.obtenerFacturas()
    if (res.success && res.facturas) {
      setFacturas(res.facturas)
    } else {
      setError('Error al cargar las facturas')
    }
    setLoading(false)
  }

  const cargarConfiguracion = async () => {
    const res = await window.api.obtenerConfiguracion()
    if (res.success && res.config) {
      setConfiguracion({ rfc: res.config.rfc, nombre: '' })
    }
  }

  const eliminar = async (uuid: string) => {
    const res = await window.api.eliminarFactura(uuid)
    if (res.success) {
      setFacturas((prev) => prev.filter((f) => f.uuid !== uuid))
    }
  }

  const facturasFiltradas = facturas.filter((f) => {
    const coincideBusqueda =
      busqueda === '' ||
      f.uuid.toLowerCase().includes(busqueda.toLowerCase()) ||
      f.nombre_emisor.toLowerCase().includes(busqueda.toLowerCase()) ||
      f.nombre_receptor.toLowerCase().includes(busqueda.toLowerCase()) ||
      f.rfc_emisor.toLowerCase().includes(busqueda.toLowerCase()) ||
      f.rfc_receptor.toLowerCase().includes(busqueda.toLowerCase())

    const coincideTipo = filtroTipo === '' || f.tipo_comprobante === filtroTipo
    const coincideEstado = filtroEstado === '' || f.estado === filtroEstado

    return coincideBusqueda && coincideTipo && coincideEstado
  })

  const verDetalle = (factura: Factura) => {
    setFacturaDetalle(factura)
    setModalVisible(true)
  }

  const cerrarDetalle = () => {
    setModalVisible(false)
    setFacturaDetalle(null)
  }

  const abrirModalPdf = (factura: Factura) => {
    setFacturaSeleccionadaPdf(factura)
    setModalPdfVisible(true)
  }

  const cerrarModalPdf = () => {
    setModalPdfVisible(false)
    setFacturaSeleccionadaPdf(null)
  }

  return {
    facturas: facturasFiltradas,
    loading,
    error,
    busqueda,
    filtroTipo,
    filtroEstado,
    configuracion,
    setBusqueda,
    setFiltroTipo,
    setFiltroEstado,
    cargarFacturas,
    eliminar,
    facturaDetalle,
    modalVisible,
    cerrarDetalle,
    verDetalle,
    facturaSeleccionadaPdf,
    modalPdfVisible,
    abrirModalPdf,
    cerrarModalPdf,
    paginaActual,
    tamañoPagina,
    setPaginaActual,
    setTamañoPagina,
  }
}