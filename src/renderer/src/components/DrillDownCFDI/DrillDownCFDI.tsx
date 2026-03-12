import { useState, useEffect } from 'react'
import { Table, Tag } from 'antd'
import { CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons'
import FacturaDetalleModal from '../FacturaDetalleModal/FacturaDetalleModal'
import { Factura } from '../../../../main/database/repositories/FacturaRepository'

interface Props {
  rfc: string
  tipo: 'clientes' | 'proveedores'
}

const fmt = (n: number) =>
  n?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const DrillDownCFDI = ({ rfc }: Props) => {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [cargado, setCargado] = useState(false)
  const [ejercicioActivo, setEjercicioActivo] = useState<string | null>(null)
  const [periodoActivo, setPeriodoActivo] = useState<string | null>(null)
  const [facturaDetalle, setFacturaDetalle] = useState<Factura | null>(null)
  const [modalVisible, setModalVisible] = useState(false)

  // Cargar al montar
  useEffect(() => {
    const cargar = async () => {
      const res = await window.api.facturasDrillDown(rfc)
      console.log('drilldown res:', res)
      if (res.success) setFacturas(res.data)
      setCargado(true)
    }
    cargar()
  }, [rfc])

  const calcTotal = (items: Factura[]) =>
    items.reduce((acc, f) => {
      // const _rfcActivo = tipo === 'clientes' ? f.rfc_receptor : f.rfc_emisor
      return f.tipo_descarga === 'emitida' ? acc + f.total : acc - f.total
    }, 0)

  // Nivel 1 — por RFC (solo uno en este contexto, pero agrupamos igual)
  /* const _nivel1 = [{
     rfc,
     nombre: facturas[0]?.[tipo === 'clientes' ? 'nombre_receptor' : 'nombre_emisor'] || rfc,
     facturas: facturas.length,
     total: calcTotal(facturas)
   }]
 */
  // Nivel 2 — por ejercicio
  const ejercicios = [...new Set(facturas.map(f => f.fecha_emision?.substring(0, 4)))].sort().reverse()
  const nivel2 = ejercicios.map(año => {
    const items = facturas.filter(f => f.fecha_emision?.startsWith(año))
    return { ejercicio: año, facturas: items.length, total: calcTotal(items), items }
  })

  // Nivel 3 — por periodo del ejercicio activo
  const itemsEjercicio = ejercicioActivo
    ? facturas.filter(f => f.fecha_emision?.startsWith(ejercicioActivo))
    : []
  // const periodos = [...new Set(itemsEjercicio.map(f => f.fecha_emision?.substring(5, 7)))].sort().reverse()
  /*const _nivel3 = periodos.map(mes => {
    const items = itemsEjercicio.filter(f => f.fecha_emision?.substring(5, 7) === mes)
    return { periodo: mes, nombre: MESES[parseInt(mes) - 1], facturas: items.length, total: calcTotal(items), items }
  })*/

  // Nivel 4 — facturas del periodo activo
  const _nivel4 = periodoActivo
    ? itemsEjercicio.filter(f => f.fecha_emision?.substring(5, 7) === periodoActivo)
    : []

  /*  const colsNivel1 = [
      { title: 'RFC', dataIndex: 'rfc', key: 'rfc', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
      { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
      { title: 'Facturas', dataIndex: 'facturas', key: 'facturas', width: 90 },
      { title: 'Total', dataIndex: 'total', key: 'total', width: 160, render: (v: number) => <span style={{ fontWeight: 600, color: v >= 0 ? '#52c41a' : '#f5222d' }}>{fmt(v)}</span> }
    ]*/

  const colsNivel2 = [
    {
      title: 'Ejercicio', dataIndex: 'ejercicio', key: 'ejercicio',
      render: (v: string) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          {ejercicioActivo === v ? <CaretDownOutlined /> : <CaretRightOutlined />}
          {v}
        </span>
      )
    },
    { title: 'Facturas', dataIndex: 'facturas', key: 'facturas', width: 90 },
    { title: 'Total', dataIndex: 'total', key: 'total', width: 160, render: (v: number) => <span style={{ fontWeight: 600, color: v >= 0 ? '#52c41a' : '#f5222d' }}>{fmt(v)}</span> }
  ]

  const colsNivel3 = [
    {
      title: 'Periodo', dataIndex: 'nombre', key: 'nombre',
      render: (v: string, r: any) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          {periodoActivo === r.periodo ? <CaretDownOutlined /> : <CaretRightOutlined />}
          {v}
        </span>
      )
    },
    { title: 'Facturas', dataIndex: 'facturas', key: 'facturas', width: 90 },
    { title: 'Total', dataIndex: 'total', key: 'total', width: 160, render: (v: number) => <span style={{ fontWeight: 600, color: v >= 0 ? '#52c41a' : '#f5222d' }}>{fmt(v)}</span> }
  ]

  const colsNivel4 = [
    { title: 'UUID', dataIndex: 'uuid', key: 'uuid', width: 120, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v?.substring(0, 8)}...</span> },
    { title: 'Tipo', dataIndex: 'tipo_comprobante', key: 'tipo', width: 80, render: (v: string) => <Tag color={v === 'I' ? 'green' : 'red'}>{v === 'I' ? 'Ingreso' : 'Egreso'}</Tag> },
    { title: 'Subtotal', dataIndex: 'subtotal', key: 'subtotal', width: 130, render: fmt },
    { title: 'Traslados', dataIndex: 'total_impuestos_trasladados', key: 'traslados', width: 120, render: (v: number) => fmt(v || 0) },
    { title: 'Retenciones', dataIndex: 'total_impuestos_retenidos', key: 'retenciones', width: 120, render: (v: number) => fmt(v || 0) },
    { title: 'Descuento', dataIndex: 'descuento', key: 'descuento', width: 110, render: (v: number) => fmt(v || 0) },
    { title: 'Total', dataIndex: 'total', key: 'total', width: 130, render: (v: number) => <strong>{fmt(v)}</strong> }
  ]

  if (!cargado) return null

  return (
    <div>
      <Table
        dataSource={nivel2}
        columns={colsNivel2}
        rowKey="ejercicio"
        size="small"
        pagination={false}
        onRow={(record) => ({
          onClick: () => {
            if (ejercicioActivo === record.ejercicio) {
              setEjercicioActivo(null)
              setPeriodoActivo(null)
            } else {
              setEjercicioActivo(record.ejercicio)
              setPeriodoActivo(null)
            }
          },
          style: { cursor: 'pointer', background: ejercicioActivo === record.ejercicio ? '#f0f7ff' : undefined }
        })}
        expandable={{
          expandedRowKeys: ejercicioActivo ? [ejercicioActivo] : [],
          showExpandColumn: false,
          expandedRowRender: (record) => {
            const periodosEjercicio = [...new Set(
              facturas
                .filter(f => f.fecha_emision?.startsWith(record.ejercicio))
                .map(f => f.fecha_emision?.substring(5, 7))
            )].sort().reverse()

            const nivel3Local = periodosEjercicio.map(mes => {
              const items = facturas.filter(f =>
                f.fecha_emision?.startsWith(record.ejercicio) &&
                f.fecha_emision?.substring(5, 7) === mes
              )
              return { periodo: mes, nombre: MESES[parseInt(mes) - 1], facturas: items.length, total: calcTotal(items), items }
            })

            return (
              <div style={{ marginLeft: 24 }}>
                <Table
                  dataSource={nivel3Local}
                  columns={colsNivel3}
                  rowKey="periodo"
                  size="small"
                  pagination={false}
                  onRow={(r) => ({
                    onClick: () => setPeriodoActivo(periodoActivo === r.periodo ? null : r.periodo),
                    style: { cursor: 'pointer', background: periodoActivo === r.periodo ? '#f0f7ff' : undefined }
                  })}
                  expandable={{
                    expandedRowKeys: periodoActivo ? [periodoActivo] : [],
                    showExpandColumn: false,
                    expandedRowRender: () => (
                      <div style={{ marginLeft: 24 }}>
                        <Table
                          dataSource={_nivel4}
                          columns={colsNivel4}
                          rowKey="uuid"
                          size="small"
                          pagination={false}
                          onRow={(row) => ({
                            onClick: () => { setFacturaDetalle(row); setModalVisible(true) },
                            style: { cursor: 'pointer' }
                          })}
                        />
                      </div>
                    )
                  }}
                />
              </div>
            )
          }
        }}
      />

      <FacturaDetalleModal
        factura={facturaDetalle}
        visible={modalVisible}
        onCerrar={() => { setModalVisible(false); setFacturaDetalle(null) }}
      />
    </div>
  )
}

export default DrillDownCFDI