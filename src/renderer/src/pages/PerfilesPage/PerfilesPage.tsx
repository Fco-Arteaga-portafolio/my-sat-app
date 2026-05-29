import './Perfilespage.css'
import { Button, Modal, Space, Popconfirm, Alert, Tag, Avatar } from 'antd'
import { UserOutlined, DeleteOutlined, LoginOutlined } from '@ant-design/icons'
import { usePerfilesPage } from './PerfilesPage.hook'
import ContribuyenteForm from '../../components/ContribuyenteForm/ContribuyenteForm'
import ModalLicencia from '../../components/ModalLicencia/ModalLicencia'
import ModalSoporte from '../../components/ModalSoporte/ModalSoporte'
import logoIcon from '../../assets/icon.png'
import { useEffect, useState } from 'react'

const PerfilesPage = ({
  onPerfilSeleccionado
}: {
  onPerfilSeleccionado?: (perfil: any) => void
}) => {
  const {
    perfiles,
    loading,
    modalVisible,
    error,
    form,
    setModalVisible,
    seleccionar,
    guardar,
    eliminar,
    cambiarForm,
    seleccionarCarpetaEmitidos,
    seleccionarCarpetaRecibidos,
    seleccionarCer,
    seleccionarKey,
    moverSlot,
    toggleSlot,
    modalLicenciaVisible, // ← nuevo
    setModalLicenciaVisible, // ← nuevo
    modalSoporteVisible, // ← nuevo
    setModalSoporteVisible // ← nuevo
  } = usePerfilesPage(onPerfilSeleccionado)

  const [version, setVersion] = useState('')

  useEffect(() => {
    window.appInfo.getVersion().then(setVersion)
  }, [])

  return (
    <div className="perfiles-container">
      {/* Logo y título */}
      <div className="perfiles-header">
        <img src={logoIcon} alt="IFRAT" className="perfiles-logo" />
        <h1 className="perfiles-titulo">IFRAT</h1>
        <h4>Versión {version} (BETA)</h4>
        <p className="perfiles-subtitulo">Selecciona un contribuyente para continuar</p>
      </div>

      {error && <Alert message={error} type="error" showIcon className="perfiles-alert" />}

      {/* Lista de contribuyentes */}
      <div className="perfiles-lista">
        {perfiles.map((perfil) => (
          <div key={perfil.rfc} className="perfil-item">
            <Avatar size={44} className="perfil-avatar" icon={<UserOutlined />} />
            <div className="perfil-info">
              <div className="perfil-nombre">{perfil.nombre}</div>
              <div className="perfil-rfc">{perfil.rfc}</div>
            </div>
            <Tag color={perfil.metodo_auth === 'efirma' ? 'green' : 'blue'} className="perfil-tag">
              {perfil.metodo_auth === 'efirma' ? 'e.firma' : 'Contraseña'}
            </Tag>
            <Space>
              <Button
                type="primary"
                icon={<LoginOutlined />}
                onClick={() => seleccionar(perfil.rfc)}
                loading={loading}
              >
                Entrar
              </Button>
              <Popconfirm
                title="¿Eliminar este contribuyente?"
                description="Se eliminará el perfil pero no sus facturas"
                onConfirm={() => eliminar(perfil.rfc)}
                okText="Sí, eliminar"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          </div>
        ))}

        <div className="perfil-acciones">
          <button className="perfil-accion-btn" onClick={() => setModalVisible(true)}>
            <div className="perfil-accion-icono add">➕</div>
            <span className="perfil-accion-label">
              Agregar
              <br />
              contribuyente
            </span>
            <span className="perfil-accion-sub">RFC + credenciales</span>
          </button>
          <button className="perfil-accion-btn" onClick={() => setModalLicenciaVisible(true)}>
            <div className="perfil-accion-icono lic">🔑</div>
            <span className="perfil-accion-label">
              Licencia &amp;
              <br />
              Activación
            </span>
            <span className="perfil-accion-sub">Comprar o activar</span>
          </button>
          <button className="perfil-accion-btn" onClick={() => setModalSoporteVisible(true)}>
            <div className="perfil-accion-icono sup">🎧</div>
            <span className="perfil-accion-label">
              Soporte
              <br />
              Técnico
            </span>
            <span className="perfil-accion-sub">Tickets y errores</span>
          </button>
        </div>
      </div>

      {/* Modal nuevo contribuyente */}
      <Modal
        title="Nuevo contribuyente"
        open={modalVisible}
        onOk={guardar}
        onCancel={() => setModalVisible(false)}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={loading}
        width={640}
      >
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        <ContribuyenteForm
          data={{
            rfc: form.rfc,
            nombre: form.nombre,
            metodoAuth: form.metodo_auth,
            contrasena: form.contrasena,
            rutaCer: form.ruta_cer,
            rutaKey: form.ruta_key,
            contrasenaFiel: form.contrasena_fiel,
            carpetaEmitidos: form.carpeta_emitidos,
            carpetaRecibidos: form.carpeta_recibidos,
            estructuraEmitidos: form.estructura_emitidos,
            estructuraRecibidos: form.estructura_recibidos,
            plantillaDefault: form.plantilla_default,
            configNombreArchivo: form.config_nombre_archivo
          }}
          onChange={cambiarForm}
          onSeleccionarCer={seleccionarCer}
          onSeleccionarKey={seleccionarKey}
          onSeleccionarCarpetaEmitidos={seleccionarCarpetaEmitidos}
          onSeleccionarCarpetaRecibidos={seleccionarCarpetaRecibidos}
          onMoverSlot={moverSlot}
          onToggleSlot={toggleSlot}
          mostrarNombre={true}
        />
      </Modal>

      {modalLicenciaVisible && <ModalLicencia onClose={() => setModalLicenciaVisible(false)} />}

      {modalSoporteVisible && <ModalSoporte onClose={() => setModalSoporteVisible(false)} />}
    </div>
  )
}

export default PerfilesPage
