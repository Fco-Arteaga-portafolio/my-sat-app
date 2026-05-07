import { Button, Statistic, Table, Tag, Alert, Spin, Tooltip } from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  CheckCircleFilled,
  WarningFilled,
  CloseCircleFilled
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useRadar69B } from './Radar69BPage.hook'
import './Radar69BPage.css'

interface EfosRiesgo {
  rfc: string
  nombre: string
  situacion: 'Definitivo' | 'Presunto'
  total_facturas: number
  monto_total: number
}

const formatMxn = (valor: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor)

const columnas: ColumnsType<EfosRiesgo> = [
  {
    title: 'Emisor',
    key: 'emisor',
    render: (_, r) => (
      <div className="radar69b-rfc-cell">
        <span className="radar69b-rfc-code">{r.rfc}</span>
        <span className="radar69b-rfc-nombre">{r.nombre || '—'}</span>
      </div>
    )
  },
  {
    title: 'Situación',
    dataIndex: 'situacion',
    key: 'situacion',
    width: 130,
    render: (s: string) =>
      s === 'Definitivo' ? (
        <Tag icon={<CloseCircleFilled />} color="error">
          Definitivo
        </Tag>
      ) : (
        <Tag icon={<WarningFilled />} color="warning">
          Presunto
        </Tag>
      )
  },
  {
    title: 'Facturas',
    dataIndex: 'total_facturas',
    key: 'total_facturas',
    width: 100,
    align: 'right'
  },
  {
    title: 'Monto en riesgo',
    dataIndex: 'monto_total',
    key: 'monto_total',
    width: 180,
    align: 'right',
    render: (v: number) => (
      <Tooltip title="Suma del total de las facturas emitidas por este contribuyente">
        <strong>{formatMxn(v)}</strong>
      </Tooltip>
    ),
    sorter: (a, b) => a.monto_total - b.monto_total,
    defaultSortOrder: 'descend'
  }
]

const Radar69BPage = () => {
  const { meta, analisis, sincronizando, progreso, cargando, error, sincronizar } = useRadar69B()

  // const totalRiesgo = (analisis?.definitivos.length ?? 0) + (analisis?.presuntos.length ?? 0)
  const montoTotal = (analisis?.montoDefinitivo ?? 0) + (analisis?.montoPresunto ?? 0)

  const renderContenido = () => {
    if (cargando) return <Spin size="large" />

    if (!meta?.ultima_sync) {
      return (
        <div className="radar69b-empty-lista">
          <EyeOutlined style={{ fontSize: 48, color: 'var(--ant-color-text-quaternary)' }} />
          <p>
            Descarga la lista oficial del SAT para cruzarla contra tus facturas recibidas y detectar
            emisores en el artículo 69-B.
          </p>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={sincronizando}
            onClick={sincronizar}
            size="large"
          >
            Descargar lista del SAT
          </Button>
        </div>
      )
    }

    if (sincronizando) {
      return (
        <div className="radar69b-progreso">
          <Spin size="large" />
          <span className="radar69b-progreso-texto">{progreso || 'Procesando...'}</span>
        </div>
      )
    }

    if (!analisis) return <Spin />

    if (analisis.sinRiesgo) {
      return (
        <div className="radar69b-limpio">
          <CheckCircleFilled style={{ fontSize: 40, color: 'var(--ant-color-success)' }} />
          <p className="radar69b-limpio-titulo">Sin riesgo detectado</p>
          <p className="radar69b-limpio-subtitulo">
            Ninguno de tus emisores de facturas recibidas aparece en la lista 69-B.
          </p>
        </div>
      )
    }

    return (
      <>
        {analisis.definitivos.length > 0 && (
          <Alert
            type="error"
            showIcon
            message="Emisores en situación definitiva"
            description={`Tienes facturas de ${analisis.definitivos.length} emisor(es) que ya fueron confirmados como EFOS. Sus comprobantes no tienen validez fiscal.`}
            style={{ marginBottom: 0 }}
          />
        )}
        {analisis.presuntos.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message="Emisores en situación presunta"
            description={`Tienes facturas de ${analisis.presuntos.length} emisor(es) notificados como posibles EFOS. Aún pueden desvirtuarse.`}
            style={{ marginBottom: 0 }}
          />
        )}

        {analisis.definitivos.length > 0 && (
          <>
            <p className="radar69b-tabla-titulo">
              <CloseCircleFilled style={{ color: 'var(--ant-color-error)', marginRight: 6 }} />
              Definitivos
            </p>
            <Table
              rowKey="rfc"
              columns={columnas}
              dataSource={analisis.definitivos}
              pagination={false}
              size="small"
            />
          </>
        )}

        {analisis.presuntos.length > 0 && (
          <>
            <p className="radar69b-tabla-titulo">
              <WarningFilled style={{ color: 'var(--ant-color-warning)', marginRight: 6 }} />
              Presuntos
            </p>
            <Table
              rowKey="rfc"
              columns={columnas}
              dataSource={analisis.presuntos}
              pagination={false}
              size="small"
            />
          </>
        )}
      </>
    )
  }

  return (
    <div className="radar69b-page">
      <div className="radar69b-header">
        <div className="radar69b-header-info">
          <h1 className="radar69b-header-title">
            <EyeOutlined /> Radar 69-B
          </h1>
          {meta?.ultima_sync && (
            <span className="radar69b-header-meta">
              Lista actualizada: {meta.ultima_sync} &nbsp;·&nbsp;
              {meta.total_registros.toLocaleString('es-MX')} contribuyentes en lista negra
            </span>
          )}
        </div>
        {meta?.ultima_sync && (
          <Button icon={<ReloadOutlined />} onClick={sincronizar} loading={sincronizando}>
            Sincronizar lista
          </Button>
        )}
      </div>

      {error && <Alert type="error" showIcon message={error} closable onClose={() => {}} />}

      {meta?.ultima_sync && analisis && !analisis.sinRiesgo && (
        <div className="radar69b-stats">
          <div className={`radar69b-stat-card ${analisis.definitivos.length > 0 ? 'peligro' : ''}`}>
            <Statistic
              title="Emisores definitivos"
              value={analisis.definitivos.length}
              valueStyle={{
                color: analisis.definitivos.length > 0 ? 'var(--ant-color-error)' : undefined
              }}
            />
          </div>
          <div
            className={`radar69b-stat-card ${analisis.presuntos.length > 0 ? 'advertencia' : ''}`}
          >
            <Statistic
              title="Emisores presuntos"
              value={analisis.presuntos.length}
              valueStyle={{
                color: analisis.presuntos.length > 0 ? 'var(--ant-color-warning)' : undefined
              }}
            />
          </div>
          <div className={`radar69b-stat-card ${montoTotal > 0 ? 'peligro' : ''}`}>
            <Statistic
              title="Monto total en riesgo"
              value={formatMxn(montoTotal)}
              valueStyle={{
                color: montoTotal > 0 ? 'var(--ant-color-error)' : undefined,
                fontSize: 18
              }}
            />
          </div>
        </div>
      )}

      {renderContenido()}
    </div>
  )
}

export default Radar69BPage
