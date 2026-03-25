import { useState, useEffect, useCallback } from 'react'
import type { FacturaDto } from '../types/FacturaDto'
import { useContribuyente } from '../context/ContribuyenteContext'

export interface FiltrosFacturas {
    busqueda: string
    fechaDesde: string
    fechaHasta: string
    rfcContraparte: string
    tipoComprobante: string
    formaPago: string
    metodoPago: string
    estado: string
}

const FILTROS_INICIALES: FiltrosFacturas = {
    busqueda: '',
    fechaDesde: '',
    fechaHasta: '',
    rfcContraparte: '',
    tipoComprobante: '',
    formaPago: '',
    metodoPago: '',
    estado: ''
}

export const useFacturasListado = (tipoDescarga: 'recibida' | 'emitida',
    tiposComprobante?: string[]) => {
    const [facturas, setFacturas] = useState<FacturaDto[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [filtros, setFiltros] = useState<FiltrosFacturas>(FILTROS_INICIALES)
    const [paginaActual, setPaginaActual] = useState(1)
    const [tamañoPagina, setTamañoPagina] = useState(10)
    const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)
    const [facturaDetalle, setFacturaDetalle] = useState<FacturaDto | null>(null)
    const [modalVisible, setModalVisible] = useState(false)
    const [facturaSeleccionadaPdf, setFacturaSeleccionadaPdf] = useState<FacturaDto | null>(null)
    const [modalPdfVisible, setModalPdfVisible] = useState(false)
    const { perfil } = useContribuyente()

    useEffect(() => {
        if (perfil) cargar()
    }, [perfil?.rfc])

    const cargar = useCallback(async (filtrosActuales: FiltrosFacturas = filtros) => {
        setLoading(true)
        setError(null)
        const res = await window.api.obtenerFacturasPorTipo({
            tipoDescarga,
            filtros: {
                tiposComprobante: tiposComprobante,
                busqueda: filtrosActuales.busqueda || undefined,
                fechaDesde: filtrosActuales.fechaDesde || undefined,
                fechaHasta: filtrosActuales.fechaHasta || undefined,
                rfcContraparte: filtrosActuales.rfcContraparte || undefined,
                tipoComprobante: filtrosActuales.tipoComprobante || undefined,
                formaPago: filtrosActuales.formaPago || undefined,
                metodoPago: filtrosActuales.metodoPago || undefined,
                estado: filtrosActuales.estado || undefined
            }
        })
        console.log('Facturas obtenidas:', res)
        if (res.success && res.facturas) {
            setFacturas(res.facturas)
            setUltimaActualizacion(new Date())
            setPaginaActual(1)
        } else {
            setError('Error al cargar las facturas')
        }
        setLoading(false)
    }, [tipoDescarga])

    const aplicarFiltros = (nuevosFiltros: Partial<FiltrosFacturas>) => {
        const actualizados = { ...filtros, ...nuevosFiltros }
        setFiltros(actualizados)
        cargar(actualizados)
    }

    const limpiarFiltros = () => {
        setFiltros(FILTROS_INICIALES)
        cargar(FILTROS_INICIALES)
    }

    const hayFiltrosActivos = Object.values(filtros).some(v => v !== '')

    const eliminar = async (uuid: string) => {
        const res = await window.api.eliminarFactura(uuid)
        if (res.success) setFacturas(prev => prev.filter(f => f.uuid !== uuid))
    }

    const verDetalle = (factura: FacturaDto) => {
        setFacturaDetalle(factura)
        setModalVisible(true)
    }

    const cerrarDetalle = () => {
        setModalVisible(false)
        setFacturaDetalle(null)
    }

    const abrirModalPdf = (factura: FacturaDto) => {
        setFacturaSeleccionadaPdf(factura)
        setModalPdfVisible(true)
    }

    const cerrarModalPdf = () => {
        setModalPdfVisible(false)
        setFacturaSeleccionadaPdf(null)
    }

    const tiempoDesdeActualizacion = (): string => {
        if (!ultimaActualizacion) return ''
        const diff = Math.floor((Date.now() - ultimaActualizacion.getTime()) / 60000)
        if (diff === 0) return 'hace un momento'
        if (diff === 1) return 'hace 1 minuto'
        if (diff < 60) return `hace ${diff} minutos`
        const h = Math.floor(diff / 60)
        return h === 1 ? 'hace 1 hora' : `hace ${h} horas`
    }

    const resumen = {
        cantidad: facturas.length,
        subtotal: facturas.reduce((a, f) => a + (f.subtotal || 0), 0),
        descuento: facturas.reduce((a, f) => a + (f.descuento || 0), 0),
        iva: facturas.reduce((a, f) => a + (f.total_impuestos_trasladados || 0), 0),
        retenciones: facturas.reduce((a, f) => a + (f.total_impuestos_retenidos || 0), 0),
        total: facturas.reduce((a, f) => a + (f.total || 0), 0)
    }
    return {
        facturas, loading, error, filtros,
        aplicarFiltros, limpiarFiltros, hayFiltrosActivos,
        cargar: () => cargar(),
        eliminar, verDetalle, cerrarDetalle,
        facturaDetalle, modalVisible,
        abrirModalPdf, cerrarModalPdf,
        facturaSeleccionadaPdf, modalPdfVisible,
        paginaActual, tamañoPagina,
        setPaginaActual, setTamañoPagina,
        resumen, tiempoDesdeActualizacion
    }
}