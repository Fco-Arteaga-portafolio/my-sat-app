import { useRef } from 'react'
import { Table, Button, Alert, Space, Tag, Card, Popconfirm, Progress } from 'antd'
import { ReloadOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons'
import { usePendientesPage } from './PendientesPage.hook'
import CaptchaInput, { CaptchaInputRef } from '../../components/CaptchaInput/CaptchaInput'

const tipoColor: Record<string, string> = {
  I: 'green', E: 'red', T: 'blue', N: 'purple', P: 'orange'
}
const tipoLabel: Record<string, string> = {
  I: 'Ingreso', E: 'Egreso', T: 'Traslado', N: 'Nómina', P: 'Pago'
}

const PendientesPage = () => {
  const captchaRef = useRef<CaptchaInputRef>(null)

  const {
    pendientes, loading, reintentando, resultado, error,
    configuracion, progreso, captchaListo,
    setCaptcha, setCaptchaListo,
    cargarPendientes, reintentar, limpiar
  } = usePendientesPage()

  const columnas = [
    { title: 'UUID', dataIndex: 'uuid', key: 'uuid', width: 300, ellipsis: true },
    { title: 'Emisor', dataIndex: 'nombre_emisor', key: 'nombre_emisor', ellipsis: true },
    {
      title: 'Fecha', dataIndex: 'fecha_emision', key: 'fecha_emision', width: 170,
      render: (f: string) => f?.replace('T', ' ')
    },
    {
      title: 'Total', dataIndex: 'total', key: 'total', width: 120,
      render: (t: number) => t?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
    },
    {
      title: 'Tipo', dataIndex: 'tipo_comprobante', key: 'tipo_comprobante', width: 90,
      render: (t: string) => <Tag color={tipoColor[t]}>{tipoLabel[t]}</Tag>
    },
    { title: 'Intentos', dataIndex: 'intentos', key: 'intentos', width: 80 },
    {
      title: 'Último error', dataIndex: 'error', key: 'error', ellipsis: true,
      render: (e: string) => <Tag color="red">{e}</Tag>
    },
    { title: 'Fecha fallo', dataIndex: 'fecha_fallo', key: 'fecha_fallo', width: 160 }
  ]

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1a2332' }}>
          <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
          Descargas Pendientes
          {pendientes.length > 0 && (
            <Tag color="orange" style={{ marginLeft: 12, fontSize: 14 }}>{pendientes.length}</Tag>
          )}
        </h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={cargarPendientes} loading={loading}>
            Actualizar
          </Button>
          {pendientes.length > 0 && (
            <Popconfirm
              title="¿Limpiar todas las pendientes?"
              description="Se eliminarán de la lista"
              onConfirm={limpiar}
              okText="Sí, limpiar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>Limpiar lista</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      {resultado && <Alert message={resultado} type="success" showIcon style={{ marginBottom: 16 }} />}

      {pendientes.length === 0 && !loading ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <WarningOutlined style={{ fontSize: 40, color: '#d9d9d9' }} />
            <p style={{ marginTop: 8 }}>No hay descargas pendientes</p>
          </div>
        </Card>
      ) : (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              {configuracion?.metodoAuth === 'contrasena' && (
                <CaptchaInput
                  ref={captchaRef}
                  disabled={reintentando}
                  onCaptchaChange={(texto, listo) => {
                    setCaptcha(texto)
                    setCaptchaListo(listo)
                  }}
                />
              )}
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                loading={reintentando}
                onClick={() => reintentar(() => captchaRef.current?.limpiar())}
                disabled={configuracion?.metodoAuth === 'contrasena' && !captchaListo}
              >
                Reintentar {pendientes.length} descarga{pendientes.length !== 1 ? 's' : ''}
              </Button>
            </div>

            {reintentando && progreso && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12, color: '#8c9db5', marginBottom: 6 }}>
                  Descargando: {progreso.descargadas} de {progreso.totalFacturas}...
                </p>
                <Progress
                  percent={Math.round(((progreso.descargadas || 0) / (progreso.totalFacturas || 1)) * 100)}
                  status="active"
                  strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
                />
              </div>
            )}
          </Card>

          <Table
            dataSource={pendientes}
            columns={columnas}
            rowKey="uuid"
            loading={loading}
            size="small"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `${total} pendientes`
            }}
          />
        </>
      )}
    </div>
  )
}

export default PendientesPage