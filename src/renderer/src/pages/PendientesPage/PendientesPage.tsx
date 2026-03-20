import { useRef } from 'react'
import { Table, Button, Alert, Space, Tag, Card, Popconfirm, Progress } from 'antd'
import { ReloadOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons'
import { usePendientesPage } from './PendientesPage.hook'
import CaptchaInput, { CaptchaInputRef } from '../../components/CaptchaInput/CaptchaInput'
import PageHeader from '@renderer/components/PageHeader/PageHeader'
import './PendientesPage.css'

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

const PendientesPage = () => {
  const captchaRef = useRef<CaptchaInputRef>(null)

  const {
    pendientes,
    loading,
    reintentando,
    resultado,
    error,
    configuracion,
    progreso,
    captchaListo,
    setCaptcha,
    setCaptchaListo,
    cargarPendientes,
    reintentar,
    limpiar
  } = usePendientesPage()

  const columnas = [
    { title: 'UUID', dataIndex: 'uuid', key: 'uuid', width: 300, ellipsis: true },
    { title: 'Emisor', dataIndex: 'nombre_emisor', key: 'nombre_emisor', ellipsis: true },
    {
      title: 'Fecha',
      dataIndex: 'fecha_emision',
      key: 'fecha_emision',
      width: 170,
      render: (f: string) => f?.replace('T', ' ')
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 120,
      render: (t: number) => t?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo_comprobante',
      key: 'tipo_comprobante',
      width: 90,
      render: (t: string) => <Tag color={tipoColor[t]}>{tipoLabel[t]}</Tag>
    },
    { title: 'Intentos', dataIndex: 'intentos', key: 'intentos', width: 80 },
    {
      title: 'Último error',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (e: string) => <Tag color="red">{e}</Tag>
    },
    { title: 'Fecha fallo', dataIndex: 'fecha_fallo', key: 'fecha_fallo', width: 160 }
  ]

  return (
    <div className="pendientes-container">
      <PageHeader
        title="Descargas Pendientes"
        subtitle="Descargas que no se han podido completar y requieren atención"
        backTo="/cfdi"
      />

      <div className="pendientes-acciones">
        <Space>
          {pendientes.length > 0 && (
            <Tag color="orange" className="pendientes-badge">
              {pendientes.length}
            </Tag>
          )}
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
              <Button danger icon={<DeleteOutlined />}>
                Limpiar lista
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {error && <Alert message={error} type="error" showIcon className="pendientes-alert" />}
      {resultado && (
        <Alert message={resultado} type="success" showIcon className="pendientes-alert" />
      )}

      {pendientes.length === 0 && !loading ? (
        <Card>
          <div className="pendientes-empty">
            <WarningOutlined className="pendientes-empty-icon" />
            <p className="pendientes-empty-text">No hay descargas pendientes</p>
          </div>
        </Card>
      ) : (
        <>
          <Card size="small" className="pendientes-reintentar-card">
            <div className="pendientes-reintentar-row">
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
              <div className="pendientes-progreso">
                <p className="pendientes-progreso-texto">
                  Descargando: {progreso.descargadas} de {progreso.totalFacturas}...
                </p>
                <Progress
                  percent={Math.round(
                    ((progreso.descargadas || 0) / (progreso.totalFacturas || 1)) * 100
                  )}
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
