import { Tooltip, Tag } from 'antd'
import type { FacturaDto } from '../types/FacturaDto'
import type { ColumnType } from 'antd/es/table'

const fmt = (n: number | undefined | null) =>
  (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const renderEstado = (e: string) => (
  <Tag color={e === 'vigente' ? 'green' : 'red'}>{e?.charAt(0).toUpperCase() + e?.slice(1)}</Tag>
)

const renderTipoNomina = (v: string) =>
  v === 'O' ? (
    <Tag color="blue">Ordinaria</Tag>
  ) : v === 'E' ? (
    <Tag color="orange">Extraordinaria</Tag>
  ) : (
    '—'
  )

const columnaUuid: ColumnType<FacturaDto> = {
  title: 'UUID',
  dataIndex: 'uuid',
  key: 'uuid',
  width: 100,
  fixed: 'left',
  render: (uuid: string) => (
    <Tooltip title={uuid}>
      <span className="col-uuid">{uuid.substring(0, 8)}…</span>
    </Tooltip>
  )
}

const columnaEstado: ColumnType<FacturaDto> = {
  title: 'Estado',
  dataIndex: 'estado',
  key: 'estado',
  width: 90,
  render: renderEstado
}

const columnasNominaBase: ColumnType<FacturaDto>[] = [
  {
    title: 'Tipo',
    dataIndex: 'tipo_nomina',
    key: 'tipo_nomina',
    width: 110,
    render: renderTipoNomina
  },
  {
    title: 'Fecha Pago',
    dataIndex: 'fecha_pago',
    key: 'fecha_pago',
    width: 110,
    render: (v: string) => v || '—'
  },
  {
    title: 'Período Inicio',
    dataIndex: 'fecha_inicial_pago',
    key: 'fecha_inicial_pago',
    width: 110,
    render: (v: string) => v || '—'
  },
  {
    title: 'Período Fin',
    dataIndex: 'fecha_final_pago',
    key: 'fecha_final_pago',
    width: 110,
    render: (v: string) => v || '—'
  },
  {
    title: 'Días',
    dataIndex: 'num_dias_pagados',
    key: 'num_dias_pagados',
    width: 70,
    align: 'right',
    render: (v: number) => v ?? '—'
  },
  {
    title: 'Percepciones',
    dataIndex: 'total_percepciones',
    key: 'total_percepciones',
    width: 120,
    align: 'right',
    render: (n: number) => (n ? <span style={{ color: '#389e0d' }}>{fmt(n)}</span> : '—')
  },
  {
    title: 'Deducciones',
    dataIndex: 'total_deducciones',
    key: 'total_deducciones',
    width: 120,
    align: 'right',
    render: (n: number) => (n ? <span style={{ color: '#cf1322' }}>{fmt(n)}</span> : '—')
  },
  {
    title: 'Otros Pagos',
    dataIndex: 'total_otros_pagos',
    key: 'total_otros_pagos',
    width: 110,
    align: 'right',
    render: (n: number) => (n ? fmt(n) : '—')
  },
  {
    title: 'Neto',
    dataIndex: 'total',
    key: 'total',
    width: 120,
    align: 'right',
    render: (n: number) => <strong>{fmt(n)}</strong>
  },
  {
    title: 'Num. Empleado',
    dataIndex: 'num_empleado',
    key: 'num_empleado',
    width: 110,
    render: (v: string) => v || '—'
  },
  {
    title: 'Puesto',
    dataIndex: 'puesto',
    key: 'puesto',
    width: 140,
    ellipsis: true,
    render: (v: string) =>
      v ? (
        <Tooltip title={v}>
          <span>{v}</span>
        </Tooltip>
      ) : (
        '—'
      )
  },
  {
    title: 'Departamento',
    dataIndex: 'departamento',
    key: 'departamento',
    width: 140,
    ellipsis: true,
    render: (v: string) =>
      v ? (
        <Tooltip title={v}>
          <span>{v}</span>
        </Tooltip>
      ) : (
        '—'
      )
  }
]

export const columnasNominaRecibida = (): ColumnType<FacturaDto>[] => [
  columnaUuid,
  {
    title: 'RFC Emisor',
    dataIndex: 'rfc_emisor',
    key: 'rfc_emisor',
    width: 130,
    render: (v: string) => <span className="col-rfc">{v}</span>
  },
  {
    title: 'Emisor',
    dataIndex: 'nombre_emisor',
    key: 'nombre_emisor',
    width: 180,
    ellipsis: true,
    render: (v: string) => (
      <Tooltip title={v}>
        <span>{v}</span>
      </Tooltip>
    )
  },
  ...columnasNominaBase,
  columnaEstado
]

export const columnasNominaEmitida = (): ColumnType<FacturaDto>[] => [
  columnaUuid,
  {
    title: 'RFC Receptor',
    dataIndex: 'rfc_receptor',
    key: 'rfc_receptor',
    width: 130,
    render: (v: string) => <span className="col-rfc">{v}</span>
  },
  {
    title: 'Receptor',
    dataIndex: 'nombre_receptor',
    key: 'nombre_receptor',
    width: 180,
    ellipsis: true,
    render: (v: string) => (
      <Tooltip title={v}>
        <span>{v}</span>
      </Tooltip>
    )
  },
  ...columnasNominaBase,
  columnaEstado
]
