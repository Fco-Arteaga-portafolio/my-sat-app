import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Select, DatePicker, Table, Space, message, Spin, Empty } from 'antd'
import { DownloadOutlined, EyeOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import './ExportacionPage.css'

interface FiltersExportacion {
  tipoDescarga: 'emitida' | 'recibida'
  tiposComprobante: string[]
  fechaDesde: string
  fechaHasta: string
}

interface DatosExportacion {
  uuid: string
  serie?: string
  folio?: string
  fecha_emision: string
  tipo_comprobante: string
  rfc_emisor: string
  nombre_emisor: string
  rfc_receptor: string
  nombre_receptor: string
  subtotal: number
  descuento: number
  total_impuestos_trasladados: number
  total_impuestos_retenidos: number
  total: number
  [key: string]: any
}

export default function ExportacionPage() {
  const navigate = useNavigate()
  const [tipoDescarga, setTipoDescarga] = useState<'emitida' | 'recibida'>('emitida')
  const [tiposComprobante, setTiposComprobante] = useState<string[]>(['I', 'E', 'N', 'P', 'T'])
  const [fechaDesde, setFechaDesde] = useState<Dayjs | null>(dayjs().subtract(30, 'days'))
  const [fechaHasta, setFechaHasta] = useState<Dayjs | null>(dayjs())

  const [tiposCfdi, setTiposCfdi] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [previewData, setPreviewData] = useState<DatosExportacion[]>([])
  const [totales, setTotales] = useState<any>(null)
  const [generandoExcel, setGenerandoExcel] = useState(false)

  useEffect(() => {
    cargarTiposCfdi()
  }, [])

  const cargarTiposCfdi = async () => {
    try {
      const resultado = await window.api.obtenerTiposCfdi()
      if (resultado.success) {
        setTiposCfdi(resultado.tipos || [])
      }
    } catch (error) {
      console.error('Error cargando tipos CFDI:', error)
    }
  }

  const obtenerPreview = async () => {
    if (!fechaDesde || !fechaHasta) {
      message.error('Por favor selecciona rango de fechas')
      return
    }

    setLoading(true)
    try {
      const filtros: FiltersExportacion = {
        tipoDescarga,
        tiposComprobante:
          tiposComprobante.length > 0 ? tiposComprobante : ['I', 'E', 'N', 'P', 'T'],
        fechaDesde: fechaDesde.format('YYYY-MM-DD'),
        fechaHasta: fechaHasta.format('YYYY-MM-DD')
      }

      const resultado = await window.api.obtenerPreview(filtros)
      if (resultado.success) {
        setPreviewData(resultado.datos || [])
        setTotales(resultado.totales)
        message.success(`${resultado.datos?.length || 0} CFDIs cargados`)
      } else {
        message.error(resultado.error || 'Error cargando preview')
        setPreviewData([])
        setTotales(null)
      }
    } catch (error) {
      console.error('Error:', error)
      message.error('Error al obtener preview')
    } finally {
      setLoading(false)
    }
  }

  const generarExcel = async () => {
    if (previewData.length === 0) {
      message.error('No hay datos para exportar')
      return
    }

    setGenerandoExcel(true)
    try {
      const filtros: FiltersExportacion = {
        tipoDescarga,
        tiposComprobante:
          tiposComprobante.length > 0 ? tiposComprobante : ['I', 'E', 'N', 'P', 'T'],
        fechaDesde: fechaDesde!.format('YYYY-MM-DD'),
        fechaHasta: fechaHasta!.format('YYYY-MM-DD')
      }

      // Usar invoke para el dialog desde el main process
      const result = await (window as any).electron?.ipcRenderer?.invoke(
        'exportacion-seleccionar-carpeta'
      )

      if (!result?.success || result?.cancelled) {
        setGenerandoExcel(false)
        return
      }

      const rutaDestino = result.filePath
      const resultado = await window.api.generarExcel(filtros, rutaDestino)

      if (resultado.success) {
        message.success(`Excel generado exitosamente: ${resultado.cantidad} CFDIs exportados`)
      } else {
        message.error(resultado.error || 'Error generando Excel')
      }
    } catch (error) {
      console.error('Error:', error)
      message.error('Error al generar Excel')
    } finally {
      setGenerandoExcel(false)
    }
  }

  const columnas = [
    {
      title: 'UUID',
      dataIndex: 'uuid',
      key: 'uuid',
      width: 100,
      ellipsis: true,
      render: (text: string) => <span title={text}>{text.substring(0, 8)}...</span>
    },
    { title: 'Serie', dataIndex: 'serie', key: 'serie', width: 60 },
    { title: 'Folio', dataIndex: 'folio', key: 'folio', width: 60 },
    { title: 'Fecha', dataIndex: 'fecha_emision', key: 'fecha_emision', width: 100 },
    { title: 'Tipo', dataIndex: 'tipo_comprobante', key: 'tipo_comprobante', width: 80 },
    { title: 'RFC Emisor', dataIndex: 'rfc_emisor', key: 'rfc_emisor', width: 100 },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 90,
      align: 'right' as const,
      render: (val: number) => `$${val.toFixed(2)}`
    },
    {
      title: 'IVA Trasl.',
      dataIndex: 'iva_traslado',
      key: 'iva_traslado',
      width: 90,
      align: 'right' as const,
      render: (val: number) => `$${(val || 0).toFixed(2)}`
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      align: 'right' as const,
      render: (val: number) => `$${val.toFixed(2)}`
    }
  ]

  return (
    <div className="exportacion-page">
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/reportes')}
        style={{ marginBottom: '16px' }}
      >
        Regresar
      </Button>

      <Card title="Exportar a Excel" className="filters-card">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Tipo de CFDI</label>
            <Select
              mode="multiple"
              placeholder="Selecciona tipos..."
              value={tiposComprobante}
              onChange={setTiposComprobante}
              options={tiposCfdi.map((t) => ({ label: t.label, value: t.code }))}
            />
          </div>

          <div className="filter-group">
            <label>Emitidos / Recibidos</label>
            <Select
              value={tipoDescarga}
              onChange={setTipoDescarga}
              options={[
                { label: 'Emitidos', value: 'emitida' },
                { label: 'Recibidos', value: 'recibida' }
              ]}
            />
          </div>

          <div className="filter-group">
            <label>Desde</label>
            <DatePicker value={fechaDesde} onChange={setFechaDesde} style={{ width: '100%' }} />
          </div>

          <div className="filter-group">
            <label>Hasta</label>
            <DatePicker value={fechaHasta} onChange={setFechaHasta} style={{ width: '100%' }} />
          </div>
        </div>

        <Space style={{ marginTop: '16px' }}>
          <Button type="primary" icon={<EyeOutlined />} onClick={obtenerPreview} loading={loading}>
            Preview
          </Button>
        </Space>
      </Card>

      {totales && (
        <Card title="Resumen de Exportación" className="totales-card">
          <div className="totales-grid">
            <div className="total-item">
              <span className="total-label">Cantidad CFDIs:</span>
              <span className="total-value">{totales.cantidad_cfdis}</span>
            </div>
            <div className="total-item">
              <span className="total-label">Subtotal:</span>
              <span className="total-value">${(totales?.subtotal ?? 0).toFixed(2)}</span>
            </div>
            <div className="total-item">
              <span className="total-label">IVA Trasladado:</span>
              <span className="total-value">${(totales?.iva_trasladado ?? 0).toFixed(2)}</span>
            </div>
            <div className="total-item">
              <span className="total-label">ISR Retenido:</span>
              <span className="total-value">
                ${(totales?.total_impuestos_retenidos ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="total-item highlight">
              <span className="total-label">Total General:</span>
              <span className="total-value">${(totales?.total_general ?? 0).toFixed(2)}</span>
            </div>
          </div>

          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            onClick={generarExcel}
            loading={generandoExcel}
            style={{ marginTop: '16px', width: '100%' }}
          >
            Descargar Excel
          </Button>
        </Card>
      )}

      {previewData.length > 0 ? (
        <Card title={`Preview: ${previewData.length} CFDIs`} className="preview-card">
          <Spin spinning={loading}>
            <Table
              columns={columnas}
              dataSource={previewData.map((d, i) => ({ ...d, key: i }))}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1200 }}
              size="small"
            />
          </Spin>
        </Card>
      ) : previewData.length === 0 && totales ? (
        <Card>
          <Empty description="No hay datos para mostrar" />
        </Card>
      ) : null}
    </div>
  )
}
