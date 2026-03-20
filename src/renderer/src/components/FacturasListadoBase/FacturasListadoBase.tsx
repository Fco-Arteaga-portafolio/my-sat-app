import { useMemo, useState } from 'react'
import { Table, Alert, Button, Tooltip, Popconfirm, Space } from 'antd'
import {
  ReloadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  FileSearchOutlined,
  FilePdfOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import type { ColumnType } from 'antd/es/table'
import type { FacturaDto } from '../../types/FacturaDto'
import { useFacturasListado } from '../../utils/useFacturasListado'
import { fmt } from '../../utils/columnasFacturas'
import FiltrosFacturasBar from '../FiltrosFacturasBar/FiltrosFacturasBar'
import FacturaDetalleModal from '../FacturaDetalleModal/FacturaDetalleModal'
import SeleccionPlantillaModal from '../SeleccionPlantillaModal/SeleccionPlantillaModal'
import * as XLSX from 'xlsx'
import './FacturasListadoBase.css'

interface Props {
  tipoDescarga: 'recibida' | 'emitida'
  titulo: string
  buildColumnas: () => ColumnType<FacturaDto>[]
  tiposComprobante?: string[]
  mostrarEfecto?: boolean
  renderExpanded?: (record: FacturaDto) => React.ReactNode
}

const FacturasListadoBase = ({
  tipoDescarga,
  titulo,
  buildColumnas,
  tiposComprobante,
  mostrarEfecto,
  renderExpanded
}: Props) => {
  const {
    facturas,
    loading,
    error,
    filtros,
    aplicarFiltros,
    limpiarFiltros,
    hayFiltrosActivos,
    cargar,
    eliminar,
    facturaDetalle,
    modalVisible,
    verDetalle,
    cerrarDetalle,
    facturaSeleccionadaPdf,
    modalPdfVisible,
    abrirModalPdf,
    cerrarModalPdf,
    paginaActual,
    tamañoPagina,
    setPaginaActual,
    setTamañoPagina,
    resumen,
    tiempoDesdeActualizacion
  } = useFacturasListado(tipoDescarga, tiposComprobante)

  const [filaSeleccionada, setFilaSeleccionada] = useState<FacturaDto | null>(null)

  const columnas = useMemo(() => buildColumnas(), [buildColumnas])

  const exportarExcel = () => {
    if (!facturas.length) return
    const datos = facturas.map((f) => ({
      UUID: f.uuid,
      'RFC Emisor': f.rfc_emisor,
      'Razón Social Emisor': f.nombre_emisor,
      'RFC Receptor': f.rfc_receptor,
      'Razón Social Receptor': f.nombre_receptor,
      Serie: f.serie ?? '',
      Folio: f.folio ?? '',
      'Fecha Emisión': f.fecha_emision,
      'Fecha Timbrado': f.fecha_timbrado ?? '',
      Efecto: f.tipo_comprobante,
      Estado: f.estado,
      'Forma Pago': f.forma_pago ?? '',
      'Método Pago': f.metodo_pago ?? '',
      Moneda: f.moneda ?? '',
      'Tipo Cambio': f.tipo_cambio ?? 1,
      Subtotal: f.subtotal,
      Descuento: f.descuento ?? 0,
      'IVA Trasladado': f.total_impuestos_trasladados ?? 0,
      Retenciones: f.total_impuestos_retenidos ?? 0,
      Total: f.total,
      'RFC PAC': f.rfc_pac ?? '',
      'Folio Sustitución': f.folio_sustitucion ?? ''
    }))
    const ws = XLSX.utils.json_to_sheet(datos)
    ws['!cols'] = Object.keys(datos[0]).map((k) => ({ wch: Math.max(k.length, 14) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, titulo)
    XLSX.writeFile(wb, `${titulo}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="listado-container">
      <div className="listado-header">
        <h2>{titulo}</h2>
        <div className="listado-header-acciones">
          {tiempoDesdeActualizacion() && (
            <span className="listado-ultima-actualizacion">
              Última actualización: {tiempoDesdeActualizacion()}
            </span>
          )}
          <Tooltip title="Exportar a Excel">
            <Button icon={<DownloadOutlined />} onClick={exportarExcel} disabled={!facturas.length}>
              Excel
            </Button>
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading}>
            Actualizar
          </Button>
        </div>
      </div>

      {facturas.length > 0 && (
        <div className="listado-resumen">
          <span>
            <strong>{resumen.cantidad.toLocaleString()}</strong> registros
          </span>
          <span className="resumen-sep">·</span>
          <span>
            Subtotal <strong>{fmt(resumen.subtotal)}</strong>
          </span>
          {resumen.descuento > 0 && (
            <>
              <span className="resumen-sep">·</span>
              <span>
                Descuento <strong>{fmt(resumen.descuento)}</strong>
              </span>
            </>
          )}
          <span className="resumen-sep">·</span>
          <span>
            IVA <strong>{fmt(resumen.iva)}</strong>
          </span>
          {resumen.retenciones > 0 && (
            <>
              <span className="resumen-sep">·</span>
              <span>
                Ret. <strong>{fmt(resumen.retenciones)}</strong>
              </span>
            </>
          )}
          <span className="resumen-sep">·</span>
          <span>
            Total <strong>{fmt(resumen.total)}</strong>
          </span>
        </div>
      )}

      {error && <Alert message={error} type="error" showIcon className="listado-error" />}

      <FiltrosFacturasBar
        filtros={filtros}
        onChange={aplicarFiltros}
        onLimpiar={limpiarFiltros}
        hayFiltrosActivos={hayFiltrosActivos}
        mostrarEfecto={mostrarEfecto}
      />

      <div className="listado-acciones-barra">
        {filaSeleccionada ? (
          <div className="listado-acciones-seleccion">
            <span className="listado-acciones-label">{filaSeleccionada.uuid.substring(0, 8)}…</span>
            <Space size={6}>
              <Button
                icon={<FileSearchOutlined />}
                size="small"
                onClick={() => verDetalle(filaSeleccionada)}
              >
                Detalle
              </Button>
              <Button
                icon={<FileTextOutlined />}
                size="small"
                onClick={() => window.api.abrirArchivo(filaSeleccionada.xml)}
              >
                XML
              </Button>
              <Button
                icon={<FilePdfOutlined />}
                size="small"
                onClick={() => abrirModalPdf(filaSeleccionada)}
              >
                PDF
              </Button>
              <Popconfirm
                title="¿Eliminar esta factura?"
                description="Esta acción no se puede deshacer"
                onConfirm={() => {
                  eliminar(filaSeleccionada.uuid)
                  setFilaSeleccionada(null)
                }}
                okText="Sí, eliminar"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />} size="small">
                  Eliminar
                </Button>
              </Popconfirm>
            </Space>
          </div>
        ) : (
          <span className="listado-acciones-hint">
            Selecciona un registro para ver las acciones disponibles
          </span>
        )}
      </div>

      <Table
        dataSource={facturas}
        columns={columnas}
        rowKey="uuid"
        loading={loading}
        size="small"
        rowClassName={(record) =>
          filaSeleccionada?.uuid === record.uuid ? 'fila-seleccionada' : ''
        }
        onRow={(record) => ({
          onClick: () =>
            setFilaSeleccionada((prev) => (prev?.uuid === record.uuid ? null : record)),
          onDoubleClick: () => verDetalle(record)
        })}
        expandable={
          renderExpanded
            ? {
                expandedRowRender: renderExpanded,
                rowExpandable: () => true
              }
            : undefined
        }
        pagination={{
          current: paginaActual,
          pageSize: tamañoPagina,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50', '100', '200'],
          showTotal: (total) => `${total.toLocaleString()} registros`,
          onChange: (page, size) => {
            setPaginaActual(page)
            setTamañoPagina(size)
          }
        }}
        locale={{
          emptyText: (
            <div className="listado-empty">
              <FileTextOutlined className="listado-empty-icon" />
              <p>No hay {titulo.toLowerCase()} descargadas</p>
            </div>
          )
        }}
        scroll={{ x: 'max-content' }}
      />

      <FacturaDetalleModal
        factura={facturaDetalle}
        visible={modalVisible}
        onCerrar={cerrarDetalle}
      />
      <SeleccionPlantillaModal
        factura={facturaSeleccionadaPdf}
        visible={modalPdfVisible}
        onCerrar={cerrarModalPdf}
      />
    </div>
  )
}

export default FacturasListadoBase
