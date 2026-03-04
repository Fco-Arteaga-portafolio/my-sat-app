import { Table, Input, Select, Button, Popconfirm, Alert, Space, Tag, Card } from 'antd'
import { ReloadOutlined, DeleteOutlined, FileTextOutlined, FileSearchOutlined, FilePdfOutlined } from '@ant-design/icons'
import { useFacturasPage } from './FacturasPage.hook'
import { Factura } from '../../../../main/database/repositories/FacturaRepository'
import FacturaDetalleModal from '../../components/FacturaDetalleModal/FacturaDetalleModal'
import SeleccionPlantillaModal from '../../components/SeleccionPlantillaModal/SeleccionPlantillaModal'
import './FacturasPage.css'

const { Search } = Input
const { Option } = Select

const tipoColor: Record<string, string> = {
  I: 'green', E: 'red', T: 'blue', N: 'purple', P: 'orange'
}

const tipoLabel: Record<string, string> = {
  I: 'Ingreso', E: 'Egreso', T: 'Traslado', N: 'Nómina', P: 'Pago'
}



const FacturasPage = (): JSX.Element => {
  const {
    facturas, loading, error, busqueda, filtroTipo, filtroEstado, configuracion,
    setBusqueda, setFiltroTipo, setFiltroEstado, cargarFacturas, eliminar,
    verDetalle, facturaDetalle, modalVisible, cerrarDetalle,
    facturaSeleccionadaPdf, modalPdfVisible, abrirModalPdf, cerrarModalPdf,
    paginaActual, tamañoPagina, setPaginaActual, setTamañoPagina
  } = useFacturasPage()

  const tieneRecibidas = facturas.some((f) => f.tipo_descarga === 'recibida')
  const tieneEmitidas = facturas.some((f) => f.tipo_descarga === 'emitida')
  const soloRecibidas = tieneRecibidas && !tieneEmitidas
  const soloEmitidas = tieneEmitidas && !tieneRecibidas


  const columnas = [
    { title: 'UUID', dataIndex: 'uuid', key: 'uuid', width: 300, ellipsis: true },
    { title: 'RFC Emisor', dataIndex: 'rfc_emisor', key: 'rfc_emisor', width: 140, ellipsis: true, hidden: soloEmitidas },
    { title: 'Emisor', dataIndex: 'nombre_emisor', key: 'nombre_emisor', ellipsis: true, hidden: soloEmitidas },
    { title: 'RFC Receptor', dataIndex: 'rfc_receptor', key: 'rfc_receptor', width: 140, ellipsis: true, hidden: soloRecibidas },
    { title: 'Receptor', dataIndex: 'nombre_receptor', key: 'nombre_receptor', ellipsis: true, hidden: soloRecibidas },
    {
      title: 'Fecha', dataIndex: 'fecha_emision', key: 'fecha_emision', width: 170,
      render: (fecha: string) => fecha.replace('T', ' ')
    },
    {
      title: 'Total', dataIndex: 'total', key: 'total', width: 120,
      render: (total: number) => total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
    },
    {
      title: 'Tipo', dataIndex: 'tipo_comprobante', key: 'tipo_comprobante', width: 100,
      render: (tipo: string) => <Tag color={tipoColor[tipo]}>{tipoLabel[tipo]}</Tag>
    },
    {
      title: 'Estado', dataIndex: 'estado', key: 'estado', width: 100,
      render: (estado: string) => (
        <Tag color={estado === 'vigente' ? 'green' : 'red'}>
          {estado.charAt(0).toUpperCase() + estado.slice(1)}
        </Tag>
      )
    },
    {
      title: 'Acciones', key: 'acciones', width: 150,
      render: (_: unknown, record: Factura) => (
        <Space>
          <Button icon={<FileSearchOutlined />} size="small" title="Detalle" onClick={() => verDetalle(record)} />
          <Button icon={<FileTextOutlined />} size="small" title="Ver XML" onClick={() => window.api.abrirArchivo(record.xml)} />
          <Button icon={<FilePdfOutlined />} size="small" title="Generar PDF" onClick={() => abrirModalPdf(record)} />
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
  ].filter((col) => !col.hidden)

  return (
    <div className="facturas-container">
      <div className="facturas-header">
        <h2>Facturas</h2>
        <Button icon={<ReloadOutlined />} onClick={cargarFacturas} loading={loading}>
          Actualizar
        </Button>
      </div>

      {configuracion && (soloRecibidas || soloEmitidas) && (
        <Card size="small" style={{ marginBottom: 16, background: '#f6f8fa' }}>
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
        <Select value={filtroTipo} onChange={setFiltroTipo} style={{ width: 160 }} placeholder="Tipo de comprobante">
          <Option value="">Todos los tipos</Option>
          <Option value="I">I - Ingreso</Option>
          <Option value="E">E - Egreso</Option>
          <Option value="T">T - Traslado</Option>
          <Option value="N">N - Nómina</Option>
          <Option value="P">P - Pago</Option>
        </Select>
        <Select value={filtroEstado} onChange={setFiltroEstado} style={{ width: 140 }} placeholder="Estado">
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
        scroll={{ x: 1000 }}
      />

      <FacturaDetalleModal factura={facturaDetalle} visible={modalVisible} onCerrar={cerrarDetalle} />
      <SeleccionPlantillaModal factura={facturaSeleccionadaPdf} visible={modalPdfVisible} onCerrar={cerrarModalPdf} />
    </div>
  )
}

export default FacturasPage