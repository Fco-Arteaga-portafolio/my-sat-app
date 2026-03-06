import { Button, Card, Alert, Divider } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useConfiguracionPage } from './ConfiguracionPage.hook'
import ContribuyenteForm from '../../components/ContribuyenteForm/ContribuyenteForm'
import './ConfiguracionPage.css'

const ConfiguracionPage = () => {
  const { config, loading, guardado, error, guardar, cambiarCampo, seleccionarCer, seleccionarKey, seleccionarCarpeta } =
    useConfiguracionPage()

  return (
    <div className="configuracion-container">
      <h2>Configuración</h2>
      <Divider />

      {guardado && (
        <Alert message="Configuración guardada correctamente" type="success" showIcon style={{ marginBottom: 24 }} />
      )}
      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />
      )}

      <Card title="Datos de acceso">
        <ContribuyenteForm
          data={{
            rfc: config.rfc,
            metodoAuth: config.metodoAuth,
            contrasena: config.contrasena,
            rutaCer: config.rutaCer,
            rutaKey: config.rutaKey,
            contrasenaFiel: config.contrasenaFiel,
            carpetaDescarga: config.carpetaDescarga
          }}
          onChange={cambiarCampo}
          onSeleccionarCer={seleccionarCer}
          onSeleccionarKey={seleccionarKey}
          onSeleccionarCarpeta={seleccionarCarpeta}
        />
        <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={guardar}>
          Guardar configuración
        </Button>
      </Card>
    </div>
  )
}

export default ConfiguracionPage