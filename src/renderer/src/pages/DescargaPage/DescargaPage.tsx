import { Form, Input, Button, Card, Radio, Alert, Divider, DatePicker, Select, Progress } from 'antd'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { useDescargaPage } from './DescargaPage.hook'
import ErroresDescargaTable from '../../components/ErroresDescargaTable/ErroresDescargaTable'
import './DescargaPage.css'
import dayjs from 'dayjs'

const { Option } = Select

const DescargaPage = (): JSX.Element => {
  const {
    form, loading, cargandoCaptcha, captchaBase64, captchaTexto,
    error, resultado, configuracion, progreso, erroresDescarga,
    obtenerCaptcha, descargar, cambiarForm, setCaptchaTexto
  } = useDescargaPage()

  const mensajeProgreso = () => {
    if (!progreso) return ''
    if (progreso.etapa === 'buscando') return `Buscando: mes ${progreso.mesActual} de ${progreso.totalMeses}...`
    if (progreso.etapa === 'descargando') return `Descargando: ${progreso.descargadas} de ${progreso.totalFacturas}...`
    return 'Completado'
  }

  const porcentajeProgreso = () => {
    if (!progreso) return 0
    if (progreso.etapa === 'buscando') return Math.round(((progreso.mesActual || 0) / (progreso.totalMeses || 1)) * 30)
    if (progreso.etapa === 'descargando') return 30 + Math.round(((progreso.descargadas || 0) / (progreso.totalFacturas || 1)) * 70)
    return 100
  }

  return (
    <div className="descarga-container">
      <div className="descarga-titulo">Descargar Facturas</div>
      <Divider style={{ margin: '0 0 16px 0' }} />

      <div className="descarga-layout">

        {/* COLUMNA IZQUIERDA */}
        <div className="descarga-columna">
          <Card title="Tipo de facturas" size="small" className="descarga-card">
            <Radio.Group value={form.tipo} onChange={(e) => cambiarForm('tipo', e.target.value)}>
              <Radio value="recibidas">Recibidas</Radio>
              <Radio value="emitidas">Emitidas</Radio>
            </Radio.Group>
          </Card>

          <Card title="Criterio de búsqueda" size="small" className="descarga-card">
            <Form layout="vertical" size="small">
              <Form.Item style={{ marginBottom: 12 }}>
                <Radio.Group value={form.buscarPor} onChange={(e) => cambiarForm('buscarPor', e.target.value)}>
                  <Radio value="fecha">Por rango de fechas</Radio>
                  <Radio value="folio">Por folio fiscal</Radio>
                </Radio.Group>
              </Form.Item>
              {form.buscarPor === 'fecha' ? (
                <Form.Item label="Rango de fechas" required style={{ marginBottom: 0 }}>
                  <DatePicker.RangePicker
                    style={{ width: '100%' }}
                    format="DD/MM/YYYY"
                    onChange={(_, dateStrings) => {
                      cambiarForm('fechaInicio', dateStrings[0])
                      cambiarForm('fechaFin', dateStrings[1])
                    }}
                    disabledDate={(current) => {
                      if (!current) return false
                      if (current > dayjs().endOf('day')) return true
                      return false
                    }}
                    onCalendarChange={(dates) => {
                      if (dates && dates[0] && dates[1]) {
                        const diff = dates[1].diff(dates[0], 'month', true)
                        if (diff > 3) {
                          cambiarForm('fechaInicio', '')
                          cambiarForm('fechaFin', '')
                        }
                      }
                    }}
                  />
                  <p style={{ fontSize: 11, color: '#8c9db5', marginTop: 6, marginBottom: 0 }}>
                    Puedes consultar hasta 3 meses por solicitud para una descarga más rápida y estable.
                  </p>
                </Form.Item>
              ) : (
                <Form.Item label="Folio Fiscal (UUID)" required style={{ marginBottom: 0 }}>
                  <Input
                    value={form.folioFiscal}
                    onChange={(e) => cambiarForm('folioFiscal', e.target.value.toUpperCase())}
                    placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                    maxLength={36}
                  />
                </Form.Item>
              )}
            </Form>
          </Card>

          <Card title="Filtros adicionales" size="small" className="descarga-card">
            <Form layout="vertical" size="small">
              <Form.Item label={form.tipo === 'recibidas' ? 'RFC Emisor' : 'RFC Receptor'} style={{ marginBottom: 10 }}>
                <Input
                  value={form.rfcTercero}
                  onChange={(e) => cambiarForm('rfcTercero', e.target.value.toUpperCase())}
                  placeholder="Opcional"
                  maxLength={13}
                />
              </Form.Item>
              <Form.Item label="Estado" style={{ marginBottom: 10 }}>
                <Select value={form.estadoComprobante} onChange={(val) => cambiarForm('estadoComprobante', val)} style={{ width: '100%' }}>
                  <Option value="">Todos</Option>
                  <Option value="vigente">Vigente</Option>
                  <Option value="cancelado">Cancelado</Option>
                </Select>
              </Form.Item>
              <Form.Item label="Tipo de comprobante" style={{ marginBottom: 0 }}>
                <Select value={form.tipoComprobante} onChange={(val) => cambiarForm('tipoComprobante', val)} style={{ width: '100%' }}>
                  <Option value="">Todos</Option>
                  <Option value="I">I - Ingreso</Option>
                  <Option value="E">E - Egreso</Option>
                  <Option value="T">T - Traslado</Option>
                  <Option value="N">N - Nómina</Option>
                  <Option value="P">P - Pago</Option>
                </Select>
              </Form.Item>
            </Form>
          </Card>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="descarga-columna">
          {configuracion?.metodoAuth === 'contrasena' && (
            <Card title="Verificación de seguridad" size="small" className="descarga-card">
              {!captchaBase64 ? (
                <Button icon={<ReloadOutlined />} loading={cargandoCaptcha} onClick={obtenerCaptcha} block>
                  Cargar captcha
                </Button>
              ) : (
                <Form layout="vertical" size="small">
                  <Form.Item label="Escribe los caracteres de la imagen" style={{ marginBottom: 0 }}>
                    <div style={{ marginBottom: 8 }}>
                      <img src={captchaBase64} alt="captcha" className="descarga-captcha-img" />
                    </div>
                    <Input.Group compact>
                      <Input
                        style={{ width: 'calc(100% - 40px)', textTransform: 'uppercase' }}
                        value={captchaTexto}
                        onChange={(e) => setCaptchaTexto(e.target.value.toUpperCase())}
                        placeholder="Escribe el captcha"
                        maxLength={6}
                      />
                      <Button icon={<ReloadOutlined />} onClick={obtenerCaptcha} loading={cargandoCaptcha} />
                    </Input.Group>
                  </Form.Item>
                </Form>
              )}
            </Card>
          )}

          {error && <Alert message={error} type="error" showIcon />}
          {resultado && (
            <Alert
              message={resultado}
              type={erroresDescarga.length > 0 ? 'warning' : 'success'}
              showIcon
            />
          )}

          {loading && progreso && (
            <Card size="small" className="descarga-card">
              <p style={{ marginBottom: 8, color: '#8c9db5', fontSize: 12 }}>{mensajeProgreso()}</p>
              <Progress
                percent={porcentajeProgreso()}
                status={progreso.etapa === 'completado' ? 'success' : 'active'}
                strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
              />
            </Card>
          )}

          <ErroresDescargaTable errores={erroresDescarga} />

          {/* Botón siempre al final */}
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="large"
            loading={loading}
            onClick={descargar}
            disabled={configuracion?.metodoAuth === 'contrasena' && !captchaBase64}
            className="descarga-boton"
          >
            {loading ? 'Descargando...' : 'Descargar facturas'}
          </Button>
        </div>

      </div>
    </div>
  )
}

export default DescargaPage