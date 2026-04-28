import { Button, Card, Input, Spin, Alert } from 'antd'
import {
  DownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import PageHeader from '../../components/PageHeader/PageHeader'
import { useConstanciaPage } from './ConstanciaPage.hook'
import './ConstanciaPage.css'

export default function ConstanciaPage() {
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
    obtenerConstancia,
    reiniciar,
    abrirArchivo
  } = useConstanciaPage()

  if (resultado) {
    return (
      <div className="constancia-container">
        <PageHeader titulo="Constancia de Situación Fiscal" rutaAtras="/cumplimiento" />

        <Card className="constancia-resultado-card">
          <div className="constancia-resultado-header">
            <CheckCircleOutlined className="constancia-icono-exito" />
            <h2 className="constancia-resultado-titulo">Constancia Generada</h2>
          </div>

          <div className="constancia-info">
            <div className="constancia-info-fila">
              <span className="constancia-info-label">RFC</span>
              <span className="constancia-info-valor">{resultado.rfc}</span>
            </div>

            <div className="constancia-info-fila">
              <span className="constancia-info-label">Fecha de emisión</span>
              <span className="constancia-info-valor">
                {new Date(resultado.fecha_emision).toLocaleDateString('es-MX', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>

            <div className="constancia-info-fila">
              <span className="constancia-info-label">Descripción</span>
              <span className="constancia-info-valor">{resultado.descripcion}</span>
            </div>
          </div>

          <div className="constancia-resultado-acciones">
            <Button onClick={reiniciar}>Generar otra</Button>
            {resultado.rutaArchivo && (
              <Button type="primary" icon={<FileTextOutlined />} onClick={abrirArchivo}>
                Abrir PDF
              </Button>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="constancia-container">
      <PageHeader titulo="Constancia de Situación Fiscal" rutaAtras="/cumplimiento" />

      <Card className="constancia-card">
        <Spin spinning={loading}>
          {tipoLogin === 'ciec' && (
            <div className="constancia-captcha-seccion">
              {captchaBase64 ? (
                <>
                  <div className="constancia-captcha-imagen-wrapper">
                    <img
                      className="constancia-captcha-imagen"
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
                    className="constancia-captcha-input"
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
              className="constancia-fiel-aviso"
              type="info"
              showIcon
              message="Se usará el certificado e.firma configurado en tu perfil para autenticarse automáticamente."
            />
          )}

          {loading && progreso && (
            <div className="constancia-progreso">
              <LoadingOutlined className="constancia-progreso-icono" />
              <span>{progreso}</span>
            </div>
          )}

          {error && <Alert className="constancia-error" type="error" showIcon message={error} />}

          <Button
            className="constancia-btn-generar"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={obtenerConstancia}
            loading={loading}
            disabled={!puedeEnviar}
            block
          >
            Generar Constancia de Situación Fiscal
          </Button>
        </Spin>
      </Card>
    </div>
  )
}
