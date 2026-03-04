import { Form, Input, Button, Card, Radio, Alert, Divider, Space } from 'antd'
import { SaveOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { useConfiguracionPage } from './ConfiguracionPage.hook'
import './ConfiguracionPage.css'

const ConfiguracionPage = (): JSX.Element => {
  const { config, loading, guardado, error, guardar, cambiarMetodo, cambiarCampo, seleccionarCer, seleccionarKey, seleccionarCarpeta } =
    useConfiguracionPage()

  return (
    <div className="configuracion-container">
      <h2>Configuración</h2>
      <Divider />

      {guardado && (
        <Alert
          message="Configuración guardada correctamente"
          type="success"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card title="Método de autenticación" style={{ marginBottom: 24 }}>
        <Radio.Group
          value={config.metodoAuth}
          onChange={(e) => cambiarMetodo(e.target.value)}
        >
          <Radio value="contrasena">RFC + Contraseña</Radio>
          <Radio value="efirma">e.firma (FIEL)</Radio>
        </Radio.Group>

        {config.metodoAuth === 'contrasena' && (
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            showIcon
            message="Al usar RFC + Contraseña se solicitará un captcha cada vez que descargues facturas."
          />
        )}
        {config.metodoAuth === 'efirma' && (
          <Alert
            style={{ marginTop: 12 }}
            type="success"
            showIcon
            message="Con e.firma no se requiere captcha. Las descargas son más rápidas y sin interrupciones."
          />
        )}
      </Card>

      <Card title="Datos de acceso">
        <Form layout="vertical">
          <Form.Item label="RFC" required>
            <Input
              value={config.rfc}
              onChange={(e) => cambiarCampo('rfc', e.target.value.toUpperCase())}
              placeholder="Ej. XAXX010101000"
              maxLength={13}
            />
          </Form.Item>

          {config.metodoAuth === 'contrasena' && (
            <Form.Item label="Contraseña del SAT" required>
              <Input.Password
                value={config.contrasena}
                onChange={(e) => cambiarCampo('contrasena', e.target.value)}
                placeholder="Contraseña del portal del SAT"
              />
            </Form.Item>
          )}

          {config.metodoAuth === 'efirma' && (
            <>
              <Form.Item label="Archivo .cer" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    value={config.rutaCer}
                    placeholder="Selecciona tu archivo .cer"
                    readOnly
                  />
                  <Button icon={<FolderOpenOutlined />} onClick={seleccionarCer}>
                    Buscar
                  </Button>
                </Space.Compact>
              </Form.Item>

              <Form.Item label="Archivo .key" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    value={config.rutaKey}
                    placeholder="Selecciona tu archivo .key"
                    readOnly
                  />
                  <Button icon={<FolderOpenOutlined />} onClick={seleccionarKey}>
                    Buscar
                  </Button>
                </Space.Compact>
              </Form.Item>

              <Form.Item label="Contraseña de la e.firma" required>
                <Input.Password
                  value={config.contrasenaFiel}
                  onChange={(e) => cambiarCampo('contrasenaFiel', e.target.value)}
                  placeholder="Contraseña de tu e.firma"
                />
              </Form.Item>
            </>
          )}

          <Form.Item label="Carpeta de descarga de XMLs" required>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={config.carpetaDescarga}
                placeholder="Selecciona la carpeta donde se guardarán los XMLs"
                readOnly
              />
              <Button icon={<FolderOpenOutlined />} onClick={seleccionarCarpeta}>
                Buscar
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={loading}
              onClick={guardar}
            >
              Guardar configuración
            </Button>
          </Form.Item>
        </Form>
      </Card>



      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}
    </div>
  )
}

export default ConfiguracionPage