import { Tooltip, Tag } from 'antd'
import type { FacturaDto } from '../types/FacturaDto'
import type { ColumnType } from 'antd/es/table'

const formaPagoLabel: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia',
  '04': 'Tarjeta de crédito',
  '05': 'Monedero electrónico',
  '06': 'Dinero electrónico',
  '08': 'Vales de despensa',
  '12': 'Dación en pago',
  '13': 'Pago por subrogación',
  '14': 'Pago por consignación',
  '15': 'Condonación',
  '17': 'Compensación',
  '23': 'Novación',
  '24': 'Confusión',
  '25': 'Remisión de deuda',
  '26': 'Prescripción o caducidad',
  '27': 'A satisfacción del acreedor',
  '28': 'Tarjeta de débito',
  '29': 'Tarjeta de servicios',
  '30': 'Aplicación de anticipos',
  '31': 'Intermediario pagos',
  '99': 'Por definir'
}

const fmt = (n: number | undefined | null) =>
  (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const renderFecha = (f: string) => f?.replace('T', ' ').substring(0, 16) ?? '—'

const renderEstado = (e: string) => (
  <Tag color={e === 'vigente' ? 'green' : 'red'}>{e?.charAt(0).toUpperCase() + e?.slice(1)}</Tag>
)

const columnaUuidRep: ColumnType<FacturaDto> = {
  title: 'UUID REP',
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

const columnasFechaMonto: ColumnType<FacturaDto>[] = [
  {
    title: 'Fecha Pago',
    dataIndex: 'fecha_pago',
    key: 'fecha_pago',
    width: 130,
    render: (v: string) => (v ? renderFecha(v) : '—')
  },
  {
    title: 'Monto',
    dataIndex: 'monto',
    key: 'monto',
    width: 120,
    align: 'right',
    render: (n: number) => (n ? <strong>{fmt(n)}</strong> : '—')
  },
  {
    title: 'Moneda Pago',
    dataIndex: 'moneda_p',
    key: 'moneda_p',
    width: 100,
    render: (v: string) => v || '—'
  },
  {
    title: 'Forma Pago',
    dataIndex: 'forma_pago_p',
    key: 'forma_pago_p',
    width: 160,
    render: (v: string) => (v ? `${v} – ${formaPagoLabel[v] ?? v}` : '—')
  },
  {
    title: 'Fecha Timbrado',
    dataIndex: 'fecha_timbrado',
    key: 'fecha_timbrado',
    width: 130,
    render: renderFecha
  }
]

export const columnasPagosRecibidos = (): ColumnType<FacturaDto>[] => [
  columnaUuidRep,
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
  ...columnasFechaMonto,
  columnaEstado
]

export const columnasPagosEmitidos = (): ColumnType<FacturaDto>[] => [
  columnaUuidRep,
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
  ...columnasFechaMonto,
  columnaEstado
]
