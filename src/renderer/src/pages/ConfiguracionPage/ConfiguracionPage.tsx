import { Button, Card, Alert, Divider } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useConfiguracionPage } from './ConfiguracionPage.hook'
import ContribuyenteForm from '../../components/ContribuyenteForm/ContribuyenteForm' 
import './ConfiguracionPage.css'



const ConfiguracionPage = () => {
  const {
    config, loading, guardado, error, guardar, cambiarCampo,
    seleccionarCer, seleccionarKey,
    seleccionarCarpetaEmitidos, seleccionarCarpetaRecibidos,
    moverSlot, toggleSlot
  } = useConfiguracionPage()


  return (
    <div className="configuracion-container">
      <h2>Configuración</h2>
      <Divider />

      {guardado && (
        <Alert message="Configuración guardada correctamente" type="success" showIcon className="configuracion-alert" />
      )}
      {error && (
        <Alert message={error} type="error" showIcon className="configuracion-alert" />
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
            carpetaEmitidos: config.carpetaEmitidos,
            carpetaRecibidos: config.carpetaRecibidos,
            estructuraEmitidos: config.estructuraEmitidos,
            estructuraRecibidos: config.estructuraRecibidos,
            plantillaDefault: config.plantillaDefault,
            configNombreArchivo: config.configNombreArchivo
          }}
          onChange={cambiarCampo}
          onSeleccionarCer={seleccionarCer}
          onSeleccionarKey={seleccionarKey}
          onSeleccionarCarpetaEmitidos={seleccionarCarpetaEmitidos}
          onSeleccionarCarpetaRecibidos={seleccionarCarpetaRecibidos}
          onMoverSlot={moverSlot}
          onToggleSlot={toggleSlot}
        />
      </Card>

      <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={guardar} size="large">
        Guardar configuración
      </Button>
    </div>
  )
}

export default ConfiguracionPage