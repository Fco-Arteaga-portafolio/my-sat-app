import { useNavigate, useParams } from 'react-router-dom'
import { Table, Tabs, Button, Alert, Typography, Space, Tag, Checkbox, Tooltip } from 'antd'
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { Factura } from '../../../../main/database/repositories/FacturaRepository'
import FacturaDetalleModal from '../../components/FacturaDetalleModal/FacturaDetalleModal'
import {
  useReporteDetalleMesPage,
  FilaDetalle,
  ResumenIva,
  ResumenIsr,
  TIPO_LABEL,
  fmt
} from './ReporteDetalleMesPage.hook'
import './ReporteDetalleMesPage.css'

const { Title, Text } = Typography

const TIPO_COLOR: Record<string, string> = {
  I: 'green',
  E: 'red',
  T: 'blue',
  N: 'purple',
  P: 'orange'
}

const gridColumnas = (
  togglePagado: (uuid: string, pagado: boolean) => void,
  mostrarPagado: boolean
) => [
  {
    title: 'Tipo',
    key: 'tipo_descarga',
    width: 95,
    render: (_: unknown, r: FilaDetalle) => (
      <Tag color={r.tipo_descarga === 'emitida' ? 'blue' : 'orange'}>
        {r.tipo_descarga === 'emitida' ? 'Emitido' : 'Recibido'}
      </Tag>
    )
  },
  {
    title: 'Razón Social',
    key: 'razon_social',
    ellipsis: true,
    width: 200,
    render: (_: unknown, r: FilaDetalle) => {
      const nombre = r.tipo_descarga === 'emitida' ? r.nombre_receptor : r.nombre_emisor
      const rfc = r.tipo_descarga === 'emitida' ? r.rfc_receptor : r.rfc_emisor
      return (
        <Tooltip title={rfc}>
          <span>{nombre || rfc}</span>
        </Tooltip>
      )
    }
  },
  {
    title: 'Tipo CFDI',
    dataIndex: 'tipo_comprobante',
    key: 'tipo_comprobante',
    width: 100,
    render: (t: string) => <Tag color={TIPO_COLOR[t]}>{TIPO_LABEL[t] ?? t}</Tag>
  },
  {
    title: 'Método',
    dataIndex: 'metodo_pago',
    key: 'metodo_pago',
    width: 80,
    render: (v: string) => v || '-'
  },
  {
    title: 'Subtotal',
    dataIndex: 'subtotal',
    key: 'subtotal',
    width: 130,
    align: 'right' as const,
    render: (n: number) => fmt(n)
  },
  {
    title: 'Descuento',
    dataIndex: 'descuento',
    key: 'descuento',
    width: 110,
    align: 'right' as const,
    render: (n: number) => (n ? fmt(n) : '-')
  },
  {
    title: 'Imp. Retenido',
    dataIndex: 'total_impuestos_retenidos',
    key: 'ret',
    width: 130,
    align: 'right' as const,
    render: (n: number) => (n ? fmt(n) : '-')
  },
  {
    title: 'Imp. Trasladado',
    dataIndex: 'total_impuestos_trasladados',
    key: 'tras',
    width: 135,
    align: 'right' as const,
    render: (n: number) => (n ? fmt(n) : '-')
  },
  {
    title: 'Total',
    dataIndex: 'total',
    key: 'total',
    width: 130,
    align: 'right' as const,
    render: (n: number) => <strong>{fmt(n)}</strong>
  },
  ...(mostrarPagado
    ? [
        {
          title: () => (
            <Space size={4}>
              Pagado
              <Tooltip title="Marca el CFDI como cobrado/pagado. Afecta los totales del resumen y los módulos de Cuentas por Cobrar/Pagar.">
                <InfoCircleOutlined style={{ color: '#8c9db5', fontSize: 12 }} />
              </Tooltip>
            </Space>
          ),
          key: 'pagado',
          width: 80,
          align: 'center' as const,
          render: (_: unknown, r: FilaDetalle) => {
            const esPagable = r.tipo_comprobante === 'I' || r.tipo_comprobante === 'E'
            if (!esPagable) return <span className="detalle-cero">—</span>
            return (
              <Checkbox
                checked={r.pagado === 1}
                onChange={(e) => {
                  e.stopPropagation()
                  togglePagado(r.uuid, e.target.checked)
                }}
              />
            )
          }
        }
      ]
    : [])
]

const CardsIva = ({ resumen }: { resumen: ResumenIva }) => (
  <div className="detalle-kpis">
    <div className="detalle-kpi">
      <span className="detalle-kpi-label">IVA Cobrado</span>
      <span className="detalle-kpi-valor detalle-positivo">{fmt(resumen.iva_cobrado)}</span>
    </div>
    <div className="detalle-kpi">
      <span className="detalle-kpi-label">IVA Acreditable</span>
      <span className="detalle-kpi-valor detalle-neutro">{fmt(resumen.iva_acreditable)}</span>
    </div>
    <div className="detalle-kpi">
      <span className="detalle-kpi-label">IVA Retenido</span>
      <span className="detalle-kpi-valor detalle-neutro">{fmt(resumen.iva_retenido)}</span>
    </div>
    <div className="detalle-kpi detalle-kpi-destacado">
      <span className="detalle-kpi-label">IVA a Pagar Est.</span>
      <span
        className={`detalle-kpi-valor ${resumen.iva_a_pagar >= 0 ? 'detalle-pagar' : 'detalle-favor'}`}
      >
        {fmt(resumen.iva_a_pagar)}
      </span>
    </div>
  </div>
)

const CardsIsr = ({ resumen }: { resumen: ResumenIsr }) => (
  <div className="detalle-kpis">
    <div className="detalle-kpi">
      <span className="detalle-kpi-label">Ingresos</span>
      <span className="detalle-kpi-valor detalle-positivo">{fmt(resumen.ingresos)}</span>
    </div>
    <div className="detalle-kpi">
      <span className="detalle-kpi-label">Gastos</span>
      <span className="detalle-kpi-valor detalle-neutro">{fmt(resumen.gastos)}</span>
    </div>
    <div className="detalle-kpi">
      <span className="detalle-kpi-label">Base Gravable</span>
      <span className="detalle-kpi-valor detalle-base">{fmt(resumen.base_gravable)}</span>
    </div>
    <div className="detalle-kpi detalle-kpi-destacado">
      <span className="detalle-kpi-label">ISR Retenido</span>
      <span className="detalle-kpi-valor detalle-pagar">{fmt(resumen.isr_retenido)}</span>
    </div>
  </div>
)

const ReporteDetalleMesPage = () => {
  const navigate = useNavigate()
  const {
    origen,
    anio,
    mes: mesParam
  } = useParams<{
    origen: string
    anio: string
    mes: string
  }>()

  const año = parseInt(anio ?? '0')
  const mes = parseInt(mesParam ?? '0')

  const {
    cfdiGenerales,
    cfdiNomina,
    tieneNomina,
    loading,
    error,
    togglePagado,
    resumenIva,
    resumenIsr,
    mesNombre,
    facturaSeleccionada,
    modalVisible,
    abrirModal,
    cerrarModal
  } = useReporteDetalleMesPage(año, mes, origen ?? 'iva')

  const backPath = origen === 'isr' ? '/reportes/isr' : '/reportes/iva'

  const cols = gridColumnas(togglePagado, true)
  const colsNomina = gridColumnas(togglePagado, false)

  const tablaProps = (data: FilaDetalle[], columnas: any[]) => ({
    dataSource: data,
    columns: columnas,
    rowKey: 'uuid' as const,
    loading,
    size: 'small' as const,
    pagination: false as const,
    scroll: { x: 1150, y: 'calc(100vh - 440px)' },
    sticky: true,
    onRow: (record: FilaDetalle) => ({
      onClick: () => abrirModal(record),
      style: { cursor: 'pointer' }
    })
  })

  const tabItems = [
    {
      key: 'general',
      label: `CFDIs (${cfdiGenerales.length})`,
      children: <Table {...tablaProps(cfdiGenerales, cols)} />
    },
    ...(tieneNomina
      ? [
          {
            key: 'nomina',
            label: `Nómina (${cfdiNomina.length})`,
            children: <Table {...tablaProps(cfdiNomina, colsNomina)} />
          }
        ]
      : [])
  ]

  // FilaDetalle → Factura (cast parcial, el modal solo usa uuid y xml)
  const facturaParaModal = facturaSeleccionada ? (facturaSeleccionada as unknown as Factura) : null

  return (
    <div className="detalle-container">
      <div className="detalle-header">
        <div className="detalle-header-left">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => navigate(backPath)}
            className="detalle-back-btn"
          />
          <div>
            <Title level={4} className="detalle-title">
              {mesNombre} {año}
            </Title>
            <Text className="detalle-subtitle">
              {origen === 'isr' ? 'Reporte ISR' : 'Reporte IVA'} · {mesNombre} {año}
            </Text>
          </div>
        </div>
      </div>

      {origen === 'iva' ? <CardsIva resumen={resumenIva} /> : <CardsIsr resumen={resumenIsr} />}

      {error && <Alert type="error" showIcon className="detalle-alert" description={error} />}

      <Tabs items={tabItems} className="detalle-tabs" />

      <FacturaDetalleModal
        factura={facturaParaModal}
        visible={modalVisible}
        onCerrar={cerrarModal}
      />
    </div>
  )
}

export default ReporteDetalleMesPage
