import { useNavigate } from 'react-router-dom'
import { Table, Select, Button, Alert, Typography, Space, Tooltip } from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useReportesIvaPage, FilaTabla } from './ReportesIvaPage.hook'
import './ReportesIvaPage.css'

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
    title: 'IVA Cobrado',
    dataIndex: 'iva_cobrado',
    key: 'iva_cobrado',
    width: 160,
    render: (n: number) => <span className={n > 0 ? 'iva-positivo' : 'iva-cero'}>{fmt(n)}</span>
  },
  {
    title: 'IVA Acreditable',
    dataIndex: 'iva_acreditable',
    key: 'iva_acreditable',
    width: 160,
    render: (n: number) => <span className={n > 0 ? 'iva-neutro' : 'iva-cero'}>{fmt(n)}</span>
  },
  {
    title: 'Ret. Cobrado',
    dataIndex: 'iva_retenido_cobrado',
    key: 'iva_retenido_cobrado',
    width: 140,
    render: (n: number) => <span className={n > 0 ? 'iva-neutro' : 'iva-cero'}>{fmt(n)}</span>
  },
  {
    title: 'Ret. Pagado',
    dataIndex: 'iva_retenido_pagado',
    key: 'iva_retenido_pagado',
    width: 140,
    render: (n: number) => <span className={n > 0 ? 'iva-neutro' : 'iva-cero'}>{fmt(n)}</span>
  },
  {
    title: () => (
      <Space size={4}>
        IVA a Pagar Est.
        <Tooltip title="IVA Cobrado − IVA Acreditable. Este cálculo es referencial; la determinación definitiva corresponde a tu contador.">
          <InfoCircleOutlined className="iva-info-icon" />
        </Tooltip>
      </Space>
    ),
    dataIndex: 'iva_a_pagar',
    key: 'iva_a_pagar',
    width: 170,
    render: (n: number) => (
      <span className={n > 0 ? 'iva-pagar' : n < 0 ? 'iva-favor' : 'iva-cero'}>{fmt(n)}</span>
    )
  }
]

const ReportesIvaPage = () => {
  const navigate = useNavigate()
  const { año, setAño, datos, totales, loading, error, exportarExcel, sinDatos, fmt, opcionesAño } =
    useReportesIvaPage()

  const filaTotal: FilaTabla = {
    mes: 'total',
    mes_nombre: 'Total anual',
    ...totales
  }

  return (
    <div className="iva-container">
      <div className="iva-header">
        <div className="iva-header-left">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => navigate('/reportes')}
            className="iva-back-btn"
          />
          <div>
            <Title level={4} className="iva-title">
              Reporte de IVA
            </Title>
            <Text className="iva-subtitle">Desglose mensual de IVA trasladado y retenido</Text>
          </div>
        </div>
        <Space>
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

      <div className="iva-kpis">
        <div className="iva-kpi">
          <span className="iva-kpi-label">IVA Cobrado anual</span>
          <span className="iva-kpi-valor iva-positivo">{fmt(totales.iva_cobrado)}</span>
        </div>
        <div className="iva-kpi">
          <span className="iva-kpi-label">IVA Acreditable anual</span>
          <span className="iva-kpi-valor iva-neutro">{fmt(totales.iva_acreditable)}</span>
        </div>
        <div className="iva-kpi iva-kpi-destacado">
          <span className="iva-kpi-label">
            IVA Estimado a Pagar
            <Tooltip title="Cálculo referencial. La determinación definitiva corresponde a tu contador.">
              <InfoCircleOutlined className="iva-info-icon" />
            </Tooltip>
          </span>
          <span className={`iva-kpi-valor ${totales.iva_a_pagar >= 0 ? 'iva-pagar' : 'iva-favor'}`}>
            {fmt(totales.iva_a_pagar)}
          </span>
        </div>
      </div>

      {error && <Alert message={error} type="error" showIcon className="iva-alert" />}

      <Alert
        type="info"
        showIcon
        className="iva-disclaimer"
        message="Este reporte es referencial y se basa únicamente en los CFDI descargados. La determinación definitiva del IVA a cargo o a favor debe realizarla tu contador considerando criterios adicionales."
      />

      <Table
        dataSource={[...datos, filaTotal]}
        columns={columnas(fmt)}
        rowKey="mes"
        loading={loading}
        pagination={false}
        size="small"
        rowClassName={(record) => (record.mes === 'total' ? 'iva-row-total' : '')}
        className="iva-tabla"
        onRow={(record) => ({
          onDoubleClick: () => {
            if (record.mes === 'total') return
            navigate(`/reportes/iva/${año}/${record.mes}`)
          },
          style: { cursor: record.mes === 'total' ? 'default' : 'pointer' }
        })}
      />
    </div>
  )
}

export default ReportesIvaPage
