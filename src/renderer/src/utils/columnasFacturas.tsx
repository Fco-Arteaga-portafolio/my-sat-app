import { Tag, Tooltip } from 'antd'
import type { FacturaDto } from '../types/FacturaDto'
import type { ColumnType } from 'antd/es/table'

const formaPagoLabel: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia',
  '04': 'Tarjeta crédito',
  '05': 'Monedero electrónico',
  '06': 'Dinero electrónico',
  '08': 'Vales de despensa',
  '12': 'Dación en pago',
  '13': 'Por subrogación',
  '14': 'Por consignación',
  '15': 'Condonación',
  '17': 'Compensación',
  '23': 'Novación',
  '24': 'Confusión',
  '25': 'Remisión de deuda',
  '26': 'Prescripción',
  '27': 'A satisfacción',
  '28': 'Tarjeta débito',
  '29': 'Tarjeta servicios',
  '30': 'Anticipos',
  '31': 'Intermediario',
  '99': 'Por definir'
}

const tipoColor: Record<string, string> = {
  I: 'green',
  E: 'red',
  T: 'blue',
  N: 'purple',
  P: 'orange'
}
const tipoLabel: Record<string, string> = {
  I: 'Ingreso',
  E: 'Egreso',
  T: 'Traslado',
  N: 'Nómina',
  P: 'Pago'
}

export const fmt = (n: number | undefined | null) =>
  (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const renderMoneda = (n: number | undefined | null) =>
  n ? fmt(n) : <span className="col-vacio">—</span>

const renderFecha = (f: string) => f?.substring(0, 10) ?? '—'

const renderEstado = (e: string) => (
  <Tag color={e === 'vigente' ? 'green' : 'red'}>{e?.charAt(0).toUpperCase() + e?.slice(1)}</Tag>
)

const columnaUuid: ColumnType<FacturaDto> = {
  title: 'UUID',
  dataIndex: 'uuid',
  key: 'uuid',
  width: 90,
  fixed: 'left',
  render: (uuid: string) => (
    <Tooltip title={uuid}>
      <span className="col-uuid">{uuid.substring(0, 8)}…</span>
    </Tooltip>
  )
}

const columnaSerieFollio: ColumnType<FacturaDto>[] = [
  { title: 'Serie', dataIndex: 'serie', key: 'serie', width: 55, render: (v: string) => v || '—' },
  { title: 'Folio', dataIndex: 'folio', key: 'folio', width: 70, render: (v: string) => v || '—' }
]

const columnasFechasYEfecto: ColumnType<FacturaDto>[] = [
  {
    title: 'Fecha',
    dataIndex: 'fecha_emision',
    key: 'fecha_emision',
    width: 90,
    render: renderFecha
  },
  {
    title: 'Efecto',
    dataIndex: 'tipo_comprobante',
    key: 'tipo_comprobante',
    width: 70,
    render: (t: string) => <Tag color={tipoColor[t]}>{tipoLabel[t]}</Tag>
  }
]

const columnasMontos: ColumnType<FacturaDto>[] = [
  {
    title: 'Subtotal',
    dataIndex: 'subtotal',
    key: 'subtotal',
    width: 95,
    align: 'right',
    render: renderMoneda
  },
  {
    title: 'Desc.',
    dataIndex: 'descuento',
    key: 'descuento',
    width: 85,
    align: 'right',
    render: renderMoneda
  },
  {
    title: 'IVA',
    dataIndex: 'total_impuestos_trasladados',
    key: 'iva',
    width: 95,
    align: 'right',
    render: renderMoneda
  },
  {
    title: 'Ret.',
    dataIndex: 'total_impuestos_retenidos',
    key: 'ret',
    width: 85,
    align: 'right',
    render: renderMoneda
  },
  {
    title: 'Total',
    dataIndex: 'total',
    key: 'total',
    width: 105,
    align: 'right',
    render: (n: number) => <strong>{fmt(n)}</strong>
  }
]

const columnasPago: ColumnType<FacturaDto>[] = [
  {
    title: 'F.Pago',
    dataIndex: 'forma_pago',
    key: 'forma_pago',
    width: 110,
    render: (v: string) =>
      v ? (
        <Tooltip title={`${v} – ${formaPagoLabel[v] ?? v}`}>
          <span>{formaPagoLabel[v] ?? v}</span>
        </Tooltip>
      ) : (
        '—'
      )
  },
  {
    title: 'Método',
    dataIndex: 'metodo_pago',
    key: 'metodo_pago',
    width: 65,
    render: (v: string) => v || '—'
  },
  {
    title: 'Moneda',
    dataIndex: 'moneda',
    key: 'moneda',
    width: 65,
    render: (v: string) => v || '—'
  }
]

const columnaEstado: ColumnType<FacturaDto> = {
  title: 'Estado',
  dataIndex: 'estado',
  key: 'estado',
  width: 80,
  render: renderEstado
}

export const columnasRecibidas = (): ColumnType<FacturaDto>[] => [
  columnaUuid,
  {
    title: 'RFC Emisor',
    dataIndex: 'rfc_emisor',
    key: 'rfc_emisor',
    width: 120,
    render: (v: string) => <span className="col-rfc">{v}</span>
  },
  {
    title: 'Emisor',
    dataIndex: 'nombre_emisor',
    key: 'nombre_emisor',
    width: 160,
    ellipsis: true,
    render: (v: string) => (
      <Tooltip title={v}>
        <span>{v}</span>
      </Tooltip>
    )
  },
  ...columnaSerieFollio,
  ...columnasFechasYEfecto,
  ...columnasMontos,
  ...columnasPago,
  columnaEstado
]

export const columnasEmitidas = (): ColumnType<FacturaDto>[] => [
  columnaUuid,
  {
    title: 'RFC Receptor',
    dataIndex: 'rfc_receptor',
    key: 'rfc_receptor',
    width: 120,
    render: (v: string) => <span className="col-rfc">{v}</span>
  },
  {
    title: 'Receptor',
    dataIndex: 'nombre_receptor',
    key: 'nombre_receptor',
    width: 160,
    ellipsis: true,
    render: (v: string) => (
      <Tooltip title={v}>
        <span>{v}</span>
      </Tooltip>
    )
  },
  ...columnaSerieFollio,
  ...columnasFechasYEfecto,
  ...columnasMontos,
  ...columnasPago,
  columnaEstado
]
