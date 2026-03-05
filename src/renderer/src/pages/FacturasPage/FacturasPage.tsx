import { Table, Input, Select, Button, Popconfirm, Alert, Space, Tag, Card, Tooltip } from 'antd'
import { ReloadOutlined, DeleteOutlined, FileTextOutlined, FileSearchOutlined, FilePdfOutlined, DownloadOutlined, WarningOutlined } from '@ant-design/icons'
import { useFacturasPage } from './FacturasPage.hook'
import { Factura } from '../../../../main/database/repositories/FacturaRepository'
import FacturaDetalleModal from '../../components/FacturaDetalleModal/FacturaDetalleModal'
import SeleccionPlantillaModal from '../../components/SeleccionPlantillaModal/SeleccionPlantillaModal'
import * as XLSX from 'xlsx'
import './FacturasPage.css'

const { Search } = Input
const { Option } = Select

const tipoColor: Record<string, string> = { I: 'green', E: 'red', T: 'blue', N: 'purple', P: 'orange' }
const tipoLabel: Record<string, string> = { I: 'Ingreso', E: 'Egreso', T: 'Traslado', N: 'Nómina', P: 'Pago' }
const formaPagoLabel: Record<string, string> = {
  '01': 'Efectivo', '02': 'Cheque', '03': 'Transferencia', '04': 'Tarjeta de crédito',
  '28': 'Tarjeta de débito', '99': 'Por definir'
}
const metodoPagoLabel: Record<string, string> = { 'PUE': 'PUE - Pago en una sola exhibición', 'PPD': 'PPD - Pago en parcialidades' }

const FacturasPage = (): JSX.Element => {
  const {
    facturas, loading, error, busqueda, filtroTipo, filtroEstado, configuracion,
    setBusqueda, setFiltroTipo, setFiltroEstado, cargarFacturas, eliminar,
    verDetalle, facturaDetalle, modalVisible, cerrarDetalle,
    facturaSeleccionadaPdf, modalPdfVisible, abrirModalPdf, cerrarModalPdf,
    paginaActual, tamañoPagina, setPaginaActual, setTamañoPagina,
    resumen, tiempoDesdeActualizacion
  } = useFacturasPage()

  const tieneRecibidas = facturas.some((f) => f.tipo_descarga === 'recibida')
  const tieneEmitidas = facturas.some((f) => f.tipo_descarga === 'emitida')
  const soloRecibidas = tieneRecibidas && !tieneEmitidas
  const soloEmitidas = tieneEmitidas && !tieneRecibidas

  const fmt = (n: number) => (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

  const exportarExcel = () => {
    const datos = facturas.map((f) => ({
      'Tipo': f.tipo_descarga === 'recibida' ? 'Recibido' : 'Emitido',
      'Versión CFDI': f.version || '',
      'Folio Fiscal (UUID)': f.uuid,
      'RFC Emisor': f.rfc_emisor,
      'Razón Social Emisor': f.nombre_emisor,
      'RFC Receptor': f.rfc_receptor,
      'Razón Social Receptor': f.nombre_receptor,
      'Serie': f.serie || '',
      'Folio': f.folio || '',
      'Fecha Emisión': f.fecha_emision,
      'Fecha Timbrado': f.fecha_timbrado || '',
      'Efecto': tipoLabel[f.tipo_comprobante] || f.tipo_comprobante,
      'Estado': f.estado,
      'Estado Cancelación': f.estado_cancelacion || '',
      'Estado Proceso Cancelación': f.estado_proceso_cancelacion || '',
      'Fecha Cancelación': f.fecha_cancelacion || '',
      'Forma de Pago': f.forma_pago ? `${f.forma_pago} - ${formaPagoLabel[f.forma_pago] || ''}` : '',
      'Método de Pago': f.metodo_pago || '',
      'Moneda': f.moneda || '',
      'Tipo de Cambio': f.tipo_cambio || 1,
      'Subtotal': f.subtotal,
      'Descuento': f.descuento || 0,
      'Total Impuestos Trasladados': f.total_impuestos_trasladados || 0,
      'Total Impuestos Retenidos': f.total_impuestos_retenidos || 0,
      'Total': f.total,
      'RFC PAC': f.rfc_pac || '',
      'Folio Sustitución': f.folio_sustitucion || ''
    }))

    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas')

    // Ajustar ancho de columnas
    const colWidths = Object.keys(datos[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }))
    ws['!cols'] = colWidths

    XLSX.writeFile(wb, `Facturas_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const columnas = [
    {
      title: 'UUID', dataIndex: 'uuid', key: 'uuid', width: 120, fixed: 'left' as const,
      render: (uuid: string) => (
        <Tooltip title={uuid}>
          <span style={{ fontFamily: 'monospace', fontSize: 11, cursor: 'default' }}>
            {uuid.substring(0, 8)}...
          </span>
        </Tooltip>
      )
    },
    {
      title: soloRecibidas ? 'RFC Emisor' : 'RFC Receptor',
      dataIndex: soloRecibidas ? 'rfc_emisor' : 'rfc_receptor',
      key: 'rfc', width: 140, ellipsis: true
    },
    {
      title: soloRecibidas ? 'Emisor' : 'Receptor',
      dataIndex: soloRecibidas ? 'nombre_emisor' : 'nombre_receptor',
      key: 'nombre', ellipsis: true, width: 180,
      render: (nombre: string) => <Tooltip title={nombre}><span>{nombre}</span></Tooltip>
    },
    {
      title: 'Serie', dataIndex: 'serie', key: 'serie', width: 70,
      render: (v: string) => v || '-'
    },
    {
      title: 'Folio', dataIndex: 'folio', key: 'folio', width: 80,
      render: (v: string) => v || '-'
    },
    {
      title: 'Fecha Emisión', dataIndex: 'fecha_emision', key: 'fecha_emision', width: 150,
      render: (f: string) => f?.replace('T', ' ')
    },
    {
      title: 'Fecha Timbrado', dataIndex: 'fecha_timbrado', key: 'fecha_timbrado', width: 150,
      render: (f: string) => f ? f.replace('T', ' ') : '-'
    },
    {
      title: 'Efecto', dataIndex: 'tipo_comprobante', key: 'tipo_comprobante', width: 90,
      render: (t: string) => <Tag color={tipoColor[t]}>{tipoLabel[t]}</Tag>
    },
    {
      title: 'Estado', dataIndex: 'estado', key: 'estado', width: 90,
      render: (e: string) => (
        <Tag color={e === 'vigente' ? 'green' : 'red'}>
          {e?.charAt(0).toUpperCase() + e?.slice(1)}
        </Tag>
      )
    },
    {
      title: 'Forma Pago', dataIndex: 'forma_pago', key: 'forma_pago', width: 100,
      render: (v: string) => v ? <Tooltip title={formaPagoLabel[v]}><span>{v}</span></Tooltip> : '-'
    },
    {
      title: 'Método', dataIndex: 'metodo_pago', key: 'metodo_pago', width: 80,
      render: (v: string) => v ? <Tooltip title={metodoPagoLabel[v]}><span>{v}</span></Tooltip> : '-'
    },
    {
      title: 'Moneda', dataIndex: 'moneda', key: 'moneda', width: 80,
      render: (v: string) => v || '-'
    },
    {
      title: 'Subtotal', dataIndex: 'subtotal', key: 'subtotal', width: 120,
      render: (n: number) => fmt(n)
    },
    {
      title: 'Descuento', dataIndex: 'descuento', key: 'descuento', width: 110,
      render: (n: number) => n ? fmt(n) : '-'
    },
    {
      title: 'IVA', dataIndex: 'total_impuestos_trasladados', key: 'iva', width: 110,
      render: (n: number) => n ? fmt(n) : '-'
    },
    {
      title: 'Retenciones', dataIndex: 'total_impuestos_retenidos', key: 'ret', width: 110,
      render: (n: number) => n ? fmt(n) : '-'
    },
    {
      title: 'Total', dataIndex: 'total', key: 'total', width: 120,
      render: (n: number) => <strong>{fmt(n)}</strong>
    },
    {
      title: 'Acciones', key: 'acciones', width: 140, fixed: 'right' as const,
      render: (_: unknown, record: Factura) => (
        <Space>
          <Tooltip title="Ver detalle">
            <Button icon={<FileSearchOutlined />} size="small" onClick={() => verDetalle(record)} />
          </Tooltip>
          <Tooltip title="Ver XML">
            <Button icon={<FileTextOutlined />} size="small" onClick={() => window.api.abrirArchivo(record.xml)} />
          </Tooltip>
          <Tooltip title="Generar PDF">
            <Button icon={<FilePdfOutlined />} size="small" onClick={() => abrirModalPdf(record)} />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar esta factura?"
            description="Esta acción no se puede deshacer"
            onConfirm={() => eliminar(record.uuid)}
            okText="Sí, eliminar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="facturas-container">
      <div className="facturas-header">
        <h2>Facturas</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {tiempoDesdeActualizacion() && (
            <span style={{ fontSize: 12, color: '#8c9db5' }}>
              Última actualización: {tiempoDesdeActualizacion()}
            </span>
          )}
          <Button icon={<DownloadOutlined />} onClick={exportarExcel} disabled={facturas.length === 0}>
            Exportar Excel
          </Button>
          <Button icon={<ReloadOutlined />} onClick={cargarFacturas} loading={loading}>
            Actualizar
          </Button>
        </div>
      </div>

      {facturas.length > 0 && (
        <div className="facturas-resumen">
          <span><strong>{resumen.total.toLocaleString()}</strong> facturas</span>
          <span className="resumen-sep">·</span>
          <span><strong>{resumen.monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</strong> total</span>
          {resumen.pendientes > 0 && (
            <>
              <span className="resumen-sep">·</span>
              <span style={{ color: '#faad14' }}>
                <WarningOutlined style={{ marginRight: 4 }} />
                <strong>{resumen.pendientes}</strong> pendientes de descarga
              </span>
            </>
          )}
        </div>
      )}

      {configuracion && (soloRecibidas || soloEmitidas) && (
        <Card size="small" style={{ marginBottom: 16, background: '#f6f8fa', border: 'none' }}>
          {soloRecibidas && <span><strong>Receptor:</strong> {configuracion.rfc}</span>}
          {soloEmitidas && <span><strong>Emisor:</strong> {configuracion.rfc}</span>}
        </Card>
      )}

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Search
          placeholder="Buscar por UUID, emisor, receptor o RFC..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ width: 350 }}
          allowClear
        />
        <Select value={filtroTipo} onChange={setFiltroTipo} style={{ width: 160 }}>
          <Option value="">Todos los tipos</Option>
          <Option value="I">I - Ingreso</Option>
          <Option value="E">E - Egreso</Option>
          <Option value="T">T - Traslado</Option>
          <Option value="N">N - Nómina</Option>
          <Option value="P">P - Pago</Option>
        </Select>
        <Select value={filtroEstado} onChange={setFiltroEstado} style={{ width: 140 }}>
          <Option value="">Todos los estados</Option>
          <Option value="vigente">Vigente</Option>
          <Option value="cancelado">Cancelado</Option>
        </Select>
      </Space>

      <Table
        dataSource={facturas}
        columns={columnas}
        rowKey="uuid"
        loading={loading}
        size="small"
        pagination={{
          current: paginaActual,
          pageSize: tamañoPagina,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `${total} facturas`,
          onChange: (page, size) => {
            setPaginaActual(page)
            setTamañoPagina(size)
          }
        }}
        locale={{
          emptyText: (
            <div style={{ padding: 40 }}>
              <FileTextOutlined style={{ fontSize: 40, color: '#ccc' }} />
              <p style={{ color: '#999', marginTop: 8 }}>No hay facturas descargadas</p>
            </div>
          )
        }}
        scroll={{ x: 1800 }}
      />

      <FacturaDetalleModal factura={facturaDetalle} visible={modalVisible} onCerrar={cerrarDetalle} />
      <SeleccionPlantillaModal factura={facturaSeleccionadaPdf} visible={modalPdfVisible} onCerrar={cerrarModalPdf} />
    </div>
  )
}

export default FacturasPage