import { useNavigate } from 'react-router-dom'
import { Table, Select, Button, Alert, Typography, Space, Tooltip } from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useReportesIsrPage, FilaIsrMes, REGIMENES } from './ReportesIsrPage.hook'
import './ReportesIsrPage.css'

const { Title, Text } = Typography
const { Option } = Select

const columnas = (fmt: (n: number) => string) => [
  {
    title: 'Mes',
    dataIndex: 'mes_nombre',
    key: 'mes',
    width: 120,
    render: (v: string) => <strong>{v}</strong>
  },
  {
    title: 'Ingresos',
    dataIndex: 'ingresos',
    key: 'ingresos',
    width: 150,
    render: (n: number) => <span className={n > 0 ? 'isr-ingreso' : 'isr-cero'}>{fmt(n)}</span>
  },
  {
    title: 'Gastos',
    dataIndex: 'gastos',
    key: 'gastos',
    width: 150,
    render: (n: number) => <span className={n > 0 ? 'isr-gasto' : 'isr-cero'}>{fmt(n)}</span>
  },
  {
    title: 'Base Gravable',
    dataIndex: 'base_gravable',
    key: 'base_gravable',
    width: 150,
    render: (n: number) => <span className={n > 0 ? 'isr-base' : 'isr-cero'}>{fmt(n)}</span>
  },
  {
    title: 'ISR Causado',
    dataIndex: 'isr_causado',
    key: 'isr_causado',
    width: 140,
    render: (n: number) => <span className={n > 0 ? 'isr-causado' : 'isr-cero'}>{fmt(n)}</span>
  },
  {
    title: 'ISR Retenido',
    dataIndex: 'isr_retenido',
    key: 'isr_retenido',
    width: 140,
    render: (n: number) => <span className={n > 0 ? 'isr-retenido' : 'isr-cero'}>{fmt(n)}</span>
  },
  {
    title: () => (
      <Space size={4}>
        ISR a Pagar Est.
        <Tooltip title="ISR Causado − ISR Retenido. Estimado referencial; la determinación definitiva corresponde a tu contador.">
          <InfoCircleOutlined className="isr-info-icon" />
        </Tooltip>
      </Space>
    ),
    dataIndex: 'isr_a_pagar',
    key: 'isr_a_pagar',
    width: 160,
    render: (n: number) => (
      <span className={n > 0 ? 'isr-pagar' : n < 0 ? 'isr-favor' : 'isr-cero'}>{fmt(n)}</span>
    )
  }
]

const ReportesIsrPage = () => {
  const navigate = useNavigate()
  const {
    año,
    setAño,
    regimen,
    regimenDetectado,
    loadingRegimen,
    datos,
    totales,
    loading,
    error,
    exportarExcel,
    sinDatos,
    fmt,
    opcionesAño
  } = useReportesIsrPage()

  const regimenLabel = REGIMENES.find((r) => r.value === regimen)?.label ?? 'Detectando...'

  const filaTotal: FilaIsrMes = {
    mes: 0,
    mes_nombre: 'Total anual',
    ...totales
  }

  return (
    <div className="isr-container">
      <div className="isr-header">
        <div className="isr-header-left">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => navigate('/reportes')}
            className="isr-back-btn"
          />
          <div>
            <Title level={4} className="isr-title">
              Reporte de ISR
            </Title>
            <Text className="isr-subtitle">Estimado de pagos provisionales mensuales</Text>
          </div>
        </div>
        <Space>
          <Tooltip
            title={
              regimenDetectado
                ? `Régimen detectado automáticamente desde tus XMLs. Clave SAT: ${regimenDetectado}`
                : 'No se encontró clave de régimen en los XMLs descargados'
            }
          >
            <span className="isr-regimen-badge">
              {loadingRegimen ? 'Detectando régimen...' : regimenLabel}
            </span>
          </Tooltip>
          <Select value={año} onChange={setAño} style={{ width: 100 }}>
            {opcionesAño.map((a) => (
              <Option key={a} value={a}>
                {a}
              </Option>
            ))}
          </Select>
          <Button icon={<DownloadOutlined />} onClick={exportarExcel} disabled={sinDatos}>
            Exportar Excel
          </Button>
        </Space>
      </div>

      <div className="isr-kpis">
        <div className="isr-kpi">
          <span className="isr-kpi-label">Ingresos acumulados</span>
          <span className="isr-kpi-valor isr-ingreso">{fmt(totales.ingresos)}</span>
        </div>
        <div className="isr-kpi">
          <span className="isr-kpi-label">Gastos acumulados</span>
          <span className="isr-kpi-valor isr-gasto">{fmt(totales.gastos)}</span>
        </div>
        <div className="isr-kpi">
          <span className="isr-kpi-label">Base gravable</span>
          <span className="isr-kpi-valor isr-base">{fmt(totales.base_gravable)}</span>
        </div>
        <div className="isr-kpi isr-kpi-destacado">
          <span className="isr-kpi-label">
            ISR Estimado a Pagar
            <Tooltip title="Suma de pagos provisionales estimados. Referencial — consulta a tu contador.">
              <InfoCircleOutlined className="isr-info-icon" />
            </Tooltip>
          </span>
          <span className={`isr-kpi-valor ${totales.isr_a_pagar > 0 ? 'isr-pagar' : 'isr-favor'}`}>
            {fmt(totales.isr_a_pagar)}
          </span>
        </div>
      </div>

      {error && <Alert type="error" showIcon className="isr-alert" description={error} />}

      <Alert
        type="info"
        showIcon
        className="isr-disclaimer"
        description="Este reporte es referencial. Los gastos mostrados son todos los CFDI recibidos — excluye manualmente los no deducibles desde el detalle. La determinación definitiva del ISR corresponde a tu contador."
      />

      <Table
        dataSource={[...datos, filaTotal]}
        columns={columnas(fmt)}
        rowKey="mes"
        loading={loading || loadingRegimen}
        pagination={false}
        size="small"
        rowClassName={(record) => (record.mes === 0 ? 'isr-row-total' : '')}
        className="isr-tabla"
        onRow={(record) => ({
          onDoubleClick: () => {
            if (record.mes === 0) return
            navigate(`/reportes/isr/${año}/${record.mes}`)
          },
          style: { cursor: record.mes === 0 ? 'default' : 'pointer' }
        })}
      />
    </div>
  )
}

export default ReportesIsrPage
