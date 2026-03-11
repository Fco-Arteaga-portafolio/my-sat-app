import { Select, Spin } from 'antd'
import {
  ArrowUpOutlined, ArrowDownOutlined,
  DashboardOutlined
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { useDashboardPage } from './DashboardPage.hook'

const COLORES = ['#001529', '#1890ff', '#52c41a', '#faad14', '#f5222d']

const formatMXN = (valor: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor)

const KpiCard = ({ titulo, valor, variacion, color }: {
  titulo: string
  valor: number
  variacion?: number
  color?: string
}) => (
  <div style={{
    background: '#fff', borderRadius: 10, padding: '20px 24px',
    border: '1px solid #e8ecf0', flex: 1, minWidth: 0
  }}>
    <div style={{ fontSize: 12, color: '#8c9db5', marginBottom: 8 }}>{titulo}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color: color || '#1a2332' }}>
      {formatMXN(valor)}
    </div>
    {variacion !== undefined && (
      <div style={{
        fontSize: 12, marginTop: 6,
        color: variacion >= 0 ? '#52c41a' : '#f5222d'
      }}>
        {variacion >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        {' '}{Math.abs(variacion)}% vs mes anterior
      </div>
    )}
  </div>
)

const DashboardPage = () => {
  const { año, mes, kpis, flujo, topClientes, topProveedores, cargando, setAño, setMes } = useDashboardPage()

  const años = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const meses = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DashboardOutlined /> Dashboard
          </h2>
          <p style={{ color: '#8c9db5', margin: '4px 0 0', fontSize: 13 }}>
            Resumen fiscal del contribuyente activo
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select value={mes} onChange={setMes} style={{ width: 130 }}
            options={meses.map(m => ({ value: m.value, label: m.label }))} />
          <Select value={año} onChange={setAño} style={{ width: 90 }}
            options={años.map(a => ({ value: a, label: String(a) }))} />
        </div>
      </div>

      <Spin spinning={cargando}>
        {/* KPIs */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <KpiCard titulo="Ingresos del mes" valor={kpis?.ingresos || 0}
            variacion={kpis?.variacion_ingresos} color="#52c41a" />
          <KpiCard titulo="Egresos del mes" valor={kpis?.egresos || 0}
            variacion={kpis?.variacion_egresos} color="#f5222d" />
          <KpiCard titulo="Balance neto" valor={kpis?.balance || 0}
            variacion={kpis?.variacion_balance}
            color={(kpis?.balance || 0) >= 0 ? '#1890ff' : '#f5222d'} />
          <KpiCard titulo="IVA estimado a pagar" valor={kpis?.iva_estimado || 0} />
        </div>

        {/* Gráficas */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {/* Flujo anual */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: 20,
            border: '1px solid #e8ecf0', flex: 2
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
              Flujo anual {año}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={flujo} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatMXN(v)} />
                <Legend />
                <Bar dataKey="ingresos" name="Ingresos" fill="#52c41a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="egresos" name="Egresos" fill="#f5222d" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top proveedores dona */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: 20,
            border: '1px solid #e8ecf0', flex: 1
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
              Top proveedores del mes
            </div>
            {topProveedores.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={topProveedores} dataKey="total" nameKey="nombre"
                      cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                      {topProveedores.map((_, i) => (
                        <Cell key={i} fill={COLORES[i % COLORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatMXN(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 8 }}>
                  {topProveedores.map((p, i) => (
                    <div key={p.rfc} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORES[i], display: 'inline-block' }} />
                        <span style={{ color: '#8c9db5', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.nombre}
                        </span>
                      </span>
                      <span style={{ fontWeight: 600 }}>{formatMXN(p.total)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#8c9db5', paddingTop: 40 }}>Sin datos</div>
            )}
          </div>
        </div>

        {/* Tablas top clientes y proveedores */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { titulo: 'Top clientes', data: topClientes, tipo: 'cliente' },
            { titulo: 'Top proveedores', data: topProveedores, tipo: 'proveedor' }
          ].map(({ titulo, data }) => (
            <div key={titulo} style={{
              background: '#fff', borderRadius: 10, padding: 20,
              border: '1px solid #e8ecf0', flex: 1
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{titulo}</div>
              {data.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#8c9db5', padding: 20 }}>Sin datos</div>
              ) : (
                data.map((item, i) => (
                  <div key={item.rfc} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 0', borderBottom: i < data.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', background: COLORES[i],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: '#fff', fontWeight: 700, flexShrink: 0
                    }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.nombre}
                      </div>
                      <div style={{ fontSize: 11, color: '#8c9db5' }}>{item.facturas} facturas</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {formatMXN(item.total)}
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>

        {/* Nota IVA */}
        <div style={{ marginTop: 16, fontSize: 11, color: '#8c9db5', textAlign: 'right' }}>
          ⚠️ IVA estimado — los cálculos son referenciales. Consulta a tu contador para tu declaración oficial.
        </div>
      </Spin>
    </div>
  )
}

export default DashboardPage