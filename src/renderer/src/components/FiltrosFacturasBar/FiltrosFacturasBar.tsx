import { Input, Select, Button, Space } from 'antd'
import { SearchOutlined, ClearOutlined } from '@ant-design/icons'
import { DatePicker } from 'antd'
import type { FiltrosFacturas } from '../../utils/useFacturasListado'
import dayjs from 'dayjs'
import './FiltrosFacturasBar.css'

const { RangePicker } = DatePicker
const { Option } = Select

interface Props {
  filtros: FiltrosFacturas
  onChange: (f: Partial<FiltrosFacturas>) => void
  onLimpiar: () => void
  hayFiltrosActivos: boolean
  mostrarEfecto?: boolean
}

const FiltrosFacturasBar = ({
  filtros,
  onChange,
  onLimpiar,
  hayFiltrosActivos,
  mostrarEfecto = true
}: Props) => {
  const rangoFechas =
    filtros.fechaDesde && filtros.fechaHasta
      ? ([dayjs(filtros.fechaDesde), dayjs(filtros.fechaHasta)] as [dayjs.Dayjs, dayjs.Dayjs])
      : null

  return (
    <div className="filtros-bar">
      <Space wrap size={8}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="UUID, RFC, nombre, serie, folio…"
          value={filtros.busqueda}
          onChange={(e) => onChange({ busqueda: e.target.value })}
          onPressEnter={() => onChange({})}
          allowClear
          className="filtros-busqueda"
        />

        <RangePicker
          value={rangoFechas}
          onChange={(dates) =>
            onChange({
              fechaDesde: dates?.[0]?.format('YYYY-MM-DD') ?? '',
              fechaHasta: dates?.[1]?.format('YYYY-MM-DD') ?? ''
            })
          }
          format="DD/MM/YYYY"
          placeholder={['Fecha desde', 'Fecha hasta']}
          className="filtros-rango-fecha"
          allowClear
        />

        <Input
          placeholder="RFC contraparte"
          value={filtros.rfcContraparte}
          onChange={(e) => onChange({ rfcContraparte: e.target.value.toUpperCase() })}
          onPressEnter={() => onChange({})}
          allowClear
          className="filtros-rfc"
        />

        {mostrarEfecto && (
          <Select
            value={filtros.tipoComprobante}
            onChange={(v) => onChange({ tipoComprobante: v })}
            className="filtros-select"
            placeholder="Efecto"
          >
            <Option value="">Todos los efectos</Option>
            <Option value="I">Ingreso</Option>
            <Option value="E">Egreso</Option>
            <Option value="T">Traslado</Option>
          </Select>
        )}

        <Select
          value={filtros.formaPago}
          onChange={(v) => onChange({ formaPago: v })}
          className="filtros-select"
          placeholder="Forma de pago"
        >
          <Option value="">Todas las formas</Option>
          <Option value="01">01 – Efectivo</Option>
          <Option value="02">02 – Cheque</Option>
          <Option value="03">03 – Transferencia</Option>
          <Option value="04">04 – Tarjeta crédito</Option>
          <Option value="28">28 – Tarjeta débito</Option>
          <Option value="99">99 – Por definir</Option>
        </Select>

        <Select
          value={filtros.metodoPago}
          onChange={(v) => onChange({ metodoPago: v })}
          className="filtros-select"
          placeholder="Método de pago"
        >
          <Option value="">Todos los métodos</Option>
          <Option value="PUE">PUE</Option>
          <Option value="PPD">PPD</Option>
        </Select>

        <Select
          value={filtros.estado}
          onChange={(v) => onChange({ estado: v })}
          className="filtros-select"
          placeholder="Estado"
        >
          <Option value="">Todos los estados</Option>
          <Option value="vigente">Vigente</Option>
          <Option value="cancelado">Cancelado</Option>
        </Select>

        {hayFiltrosActivos && (
          <Button icon={<ClearOutlined />} onClick={onLimpiar} size="small">
            Limpiar filtros
          </Button>
        )}
      </Space>
    </div>
  )
}

export default FiltrosFacturasBar
