import { Button, Card, Input, Spin, Alert } from 'antd'
import {
  DownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import PageHeader from '../../components/PageHeader/PageHeader'
import { useCumplimientoPage } from './CumplimientoPage.hook'
import './CumplimientoPage.css'

export default function CumplimientoPage() {
  const {
    captchaBase64,
    captchaInput,
    setCaptchaInput,
    loading,
    progreso,
    resultado,
    error,
    tipoLogin,
    puedeEnviar,
    cargarCaptcha,
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
            <Button onClick={reiniciar}>Consultar otra</Button>
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
            <div className="cumplimiento-captcha-seccion">
              {captchaBase64 ? (
                <>
                  <div className="cumplimiento-captcha-imagen-wrapper">
                    <img
                      className="cumplimiento-captcha-imagen"
                      src={captchaBase64}
                      alt="Captcha SAT"
                    />
                    <Button
                      type="text"
                      icon={<ReloadOutlined />}
                      onClick={cargarCaptcha}
                      disabled={loading}
                    >
                      Recargar
                    </Button>
                  </div>

                  <Input
                    className="cumplimiento-captcha-input"
                    placeholder="Texto del captcha"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                    maxLength={6}
                    autoComplete="off"
                  />
                </>
              ) : (
                <Button onClick={cargarCaptcha} loading={loading} block>
                  Cargar captcha del SAT
                </Button>
              )}
            </div>
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
            onClick={obtenerOpinion}
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
