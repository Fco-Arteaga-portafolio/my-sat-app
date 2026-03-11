import { Table, Input, Button, Tag } from 'antd'
import { SearchOutlined, SyncOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useCatalogoPage, TipoCatalogo } from './CatalogoPage.hook'

const formatMXN = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)

interface Props {
  tipo: TipoCatalogo
  titulo: string
  subtitulo: string
}

const CatalogoPage = ({ tipo, titulo, subtitulo }: Props) => {
  const navigate = useNavigate()
  const { datos, cargando, busqueda, setBusqueda, sincronizar } = useCatalogoPage(tipo)

  const columnas = [
    {
      title: 'RFC', dataIndex: 'rfc', key: 'rfc', width: 160,
      render: (rfc: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{rfc}</span>
    },
    {
      title: 'Nombre', dataIndex: 'nombre', key: 'nombre',
      render: (nombre: string) => nombre || <span style={{ color: '#ccc' }}>Sin nombre</span>
    },
    {
      title: 'Facturas', dataIndex: 'total_facturas', key: 'total_facturas', width: 90,
      render: (v: number) => <Tag>{v || 0}</Tag>
    },
    {
      title: 'Total facturado', dataIndex: 'total_facturado', key: 'total_facturado', width: 160,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{formatMXN(v || 0)}</span>
    },
    {
      title: 'Último CFDI', dataIndex: 'ultimo_cfdi', key: 'ultimo_cfdi', width: 130,
      render: (v: string) => v ? v.substring(0, 10) : <span style={{ color: '#ccc' }}>—</span>
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>{titulo}</h2>
          <p style={{ color: '#8c9db5', margin: '4px 0 0', fontSize: 13 }}>{subtitulo}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            placeholder="Buscar por RFC o nombre"
            prefix={<SearchOutlined />}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ width: 260 }}
          />
          <Button icon={<SyncOutlined />} onClick={sincronizar} loading={cargando}>
            Sincronizar
          </Button>
        </div>
      </div>

      <Table
        dataSource={datos}
        columns={columnas}
        rowKey="rfc"
        loading={cargando}
        size="small"
        pagination={{ pageSize: 20, showTotal: t => `${t} registros` }}
        onRow={(record) => ({
          onClick: () => navigate(`/${tipo}/${record.rfc}`),
          style: { cursor: 'pointer' }
        })}
      />
    </div>
  )
}

export default CatalogoPage