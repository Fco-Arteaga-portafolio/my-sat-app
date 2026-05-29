import { useRef } from 'react'
import { Button, Card, Spin, Alert } from 'antd'
import {
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import PageHeader from '../../components/PageHeader/PageHeader'
import CaptchaInput, { CaptchaInputRef } from '../../components/CaptchaInput/CaptchaInput'
import { useCumplimientoPage } from './CumplimientoPage.hook'
import './CumplimientoPage.css'

export default function CumplimientoPage() {
  const captchaRef = useRef<CaptchaInputRef>(null)

  const {
    setCaptcha,
    setCaptchaListo,
    loading,
    progreso,
    resultado,
    error,
    tipoLogin,
    puedeEnviar,
    obtenerOpinion,
    reiniciar,
    abrirArchivo
  } = useCumplimientoPage()

  if (resultado) {
    const iconoResultado = {
      positivo: <CheckCircleOutlined className="cumplimiento-icono-positivo" />,
      negativo: <CloseCircleOutlined className="cumplimiento-icono-negativo" />,
      unknown: <QuestionCircleOutlined className="cumplimiento-icono-unknown" />
    }[resultado.resultado]

    return (
      <div className="cumplimiento-container">
        <PageHeader title="Opinión de Cumplimiento" backTo="/cumplimiento" />
        <Card className="cumplimiento-resultado-card">
          <div className="cumplimiento-resultado-header">
            {iconoResultado}
            <h2
              className={`cumplimiento-resultado-titulo cumplimiento-resultado-${resultado.resultado}`}
            >
              Opinión {resultado.resultado.toUpperCase()}
            </h2>
          </div>
          <p className="cumplimiento-resultado-descripcion">{resultado.descripcion}</p>
          {resultado.fecha_emision && (
            <p className="cumplimiento-resultado-fecha">
              Fecha de emisión:{' '}
              {new Date(resultado.fecha_emision).toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )}
          <div className="cumplimiento-resultado-acciones">
            <Button onClick={() => reiniciar(() => captchaRef.current?.limpiar())}>
              Consultar otra
            </Button>
            {resultado.rutaArchivo && (
              <Button type="primary" icon={<DownloadOutlined />} onClick={abrirArchivo}>
                Abrir PDF
              </Button>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="cumplimiento-container">
      <PageHeader title="Opinión de Cumplimiento" backTo="/cumplimiento" />
      <Card className="cumplimiento-card">
        <Spin spinning={loading}>
          {tipoLogin === 'ciec' && (
            <CaptchaInput
              ref={captchaRef}
              portalId="cumplimiento"
              disabled={loading}
              onCaptchaChange={(texto, listo) => {
                setCaptcha(texto)
                setCaptchaListo(listo)
              }}
            />
          )}

          {tipoLogin === 'fiel' && (
            <Alert
              className="cumplimiento-fiel-aviso"
              type="info"
              showIcon
              message="Se usará el certificado e.firma configurado en tu perfil para autenticarse automáticamente."
            />
          )}

          {loading && progreso && (
            <div className="cumplimiento-progreso">
              <LoadingOutlined className="cumplimiento-progreso-icono" />
              <span>{progreso}</span>
            </div>
          )}

          {error && <Alert className="cumplimiento-error" type="error" showIcon message={error} />}

          <Button
            className="cumplimiento-btn-descargar"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => obtenerOpinion(() => captchaRef.current?.limpiar())}
            loading={loading}
            disabled={!puedeEnviar}
            block
          >
            Obtener Opinión de Cumplimiento
          </Button>
        </Spin>
      </Card>
    </div>
  )
}
