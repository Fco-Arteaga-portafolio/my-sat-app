import { useRef } from 'react'
import { Alert, Button, Select, Spin, Card, Statistic, Row, Col, Tag } from 'antd'
import { SyncOutlined } from '@ant-design/icons'
import { useConciliacionPage } from './ConciliacionPage.hook'
import CaptchaInput, { CaptchaInputRef } from '../../components/CaptchaInput/CaptchaInput'
import './ConciliacionPage.css'

const ConciliacionPage = () => {
  const captchaRef = useRef<CaptchaInputRef>(null)

  const {
    form, captchaListo, configuracion, loading,
    etapa, etapaLabel, progreso, resumen, error,
    ejercicios, periodos,
    setCaptcha, setCaptchaListo,
    cambiarForm, iniciar
  } = useConciliacionPage()

  return (
    <div className="conciliacion-container">
      <div className="conciliacion-header">
        <h2 className="conciliacion-titulo">Conciliación SAT</h2>
        <p className="conciliacion-subtitulo">Verifica que tu información local esté sincronizada con el SAT</p>
      </div>

      {error && <Alert message={error} type="error" showIcon className="conciliacion-alert" closable />}

      <div className="conciliacion-form">
        <div className="conciliacion-row">
          <div className="conciliacion-field">
            <label>Tipo</label>
            <Select
              value={form.tipo}
              onChange={(v) => cambiarForm('tipo', v)}
              disabled={loading}
              className="conciliacion-select"
              options={[
                { value: 'recibidas', label: 'Recibidas' },
                { value: 'emitidas', label: 'Emitidas' }
              ]}
            />
          </div>
          <div className="conciliacion-field">
            <label>Ejercicio</label>
            <Select
              value={form.ejercicio}
              onChange={(v) => cambiarForm('ejercicio', v)}
              disabled={loading}
              className="conciliacion-select"
              options={ejercicios.map(e => ({ value: e, label: e }))}
            />
          </div>
          <div className="conciliacion-field">
            <label>Periodo</label>
            <Select
              value={form.periodo}
              onChange={(v) => cambiarForm('periodo', v)}
              disabled={loading}
              className="conciliacion-select"
              options={periodos.map(p => ({ value: p.value, label: p.label }))}
            />
          </div>
        </div>

        {configuracion?.metodoAuth === 'contrasena' && (
          <CaptchaInput
            ref={captchaRef}
            disabled={loading}
            onCaptchaChange={(texto, listo) => {
              setCaptcha(texto)
              setCaptchaListo(listo)
            }}
          />
        )}

        <Button
          type="primary"
          icon={<SyncOutlined spin={loading} />}
          onClick={() => iniciar(() => captchaRef.current?.limpiar())}
          loading={loading}
          disabled={configuracion?.metodoAuth === 'contrasena' && !captchaListo}
          size="large"
          className="conciliacion-btn-iniciar"
        >
          Iniciar conciliación
        </Button>
      </div>

      {loading && etapa && (
        <div className="conciliacion-progreso">
          <Spin />
          <span className="conciliacion-etapa">{etapaLabel[etapa] || etapa}</span>
          {etapa === 'descargando' && progreso?.totalFaltantes && (
            <span className="conciliacion-etapa-detalle">
              {progreso.descargadas} / {progreso.totalFaltantes}
            </span>
          )}
        </div>
      )}

      {resumen && (
        <div className="conciliacion-resumen">
          <h3 className="conciliacion-resumen-titulo">Resultado de la conciliación</h3>
          <Row gutter={16}>
            <Col span={6}>
              <Card><Statistic title="Total en SAT" value={resumen.totalSat} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Total local (antes)" value={resumen.totalLocal} /></Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Descargadas"
                  value={resumen.descargadas}
                  valueStyle={{ color: resumen.descargadas > 0 ? '#3f8600' : undefined }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Estados actualizados"
                  value={resumen.actualizadas}
                  valueStyle={{ color: resumen.actualizadas > 0 ? '#cf1322' : undefined }}
                />
              </Card>
            </Col>
          </Row>

          {resumen.errores.length > 0 && (
            <div className="conciliacion-errores">
              <h4>Errores ({resumen.errores.length})</h4>
              {resumen.errores.map((e, i) => (
                <div key={i} className="conciliacion-error-item">
                  <Tag color="red">{e.uuid.slice(0, 8)}...</Tag>
                  <span>{e.error}</span>
                </div>
              ))}
            </div>
          )}

          {resumen.descargadas === 0 && resumen.actualizadas === 0 && resumen.errores.length === 0 && (
            <Alert
              message="Todo en orden"
              description="Tu información local está sincronizada con el SAT para este periodo."
              type="success"
              showIcon
              className="conciliacion-ok"
            />
          )}
        </div>
      )}
    </div>
  )
}

export default ConciliacionPage