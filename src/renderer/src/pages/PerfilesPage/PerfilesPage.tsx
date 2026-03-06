import { Button, Modal, Space, Popconfirm, Alert, Tag, Avatar } from 'antd'
import { PlusOutlined, UserOutlined, DeleteOutlined, LoginOutlined } from '@ant-design/icons'
import { usePerfilesPage } from './PerfilesPage.hook'
import ContribuyenteForm from '../../components/ContribuyenteForm/ContribuyenteForm'

const PerfilesPage = ({ onPerfilSeleccionado }: { onPerfilSeleccionado?: () => void }) => {
  const {
    perfiles, loading, modalVisible, error, form,
    setModalVisible, seleccionar, guardar, eliminar,
    cambiarForm, seleccionarCarpeta, seleccionarCer, seleccionarKey
  } = usePerfilesPage(onPerfilSeleccionado)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f2f5',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }}>
      {/* Logo y título */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img src="/icon.png" alt="Gravix" style={{ width: 64, height: 64, marginBottom: 12 }} />
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#001529', margin: 0 }}>Gravix</h1>
        <p style={{ color: '#8c9db5', marginTop: 4 }}>Selecciona un contribuyente para continuar</p>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16, width: '100%', maxWidth: 560 }} />}

      {/* Lista de contribuyentes */}
      <div style={{ width: '100%', maxWidth: 560 }}>
        {perfiles.map((perfil) => (
          <div
            key={perfil.rfc}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              background: '#fff', borderRadius: 10, padding: '14px 16px',
              marginBottom: 10, border: '1px solid #e8ecf0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}
          >
            <Avatar
              size={44}
              style={{ background: '#001529', flexShrink: 0 }}
              icon={<UserOutlined />}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1a2332', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {perfil.nombre}
              </div>
              <div style={{ fontSize: 12, color: '#8c9db5', marginTop: 2 }}>{perfil.rfc}</div>
            </div>
            <Tag color={perfil.metodo_auth === 'efirma' ? 'green' : 'blue'} style={{ flexShrink: 0 }}>
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

        {/* Botón agregar */}
        <div
          onClick={() => setModalVisible(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: '#fff', borderRadius: 10, padding: '14px 16px',
            border: '2px dashed #d9d9d9', cursor: 'pointer', color: '#8c9db5',
            fontSize: 14, marginTop: 4
          }}
        >
          <PlusOutlined />
          <span>Agregar contribuyente</span>
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
      >
        <ContribuyenteForm
          data={{
            rfc: form.rfc,
            nombre: form.nombre,
            metodoAuth: form.metodo_auth,
            contrasena: form.contrasena,
            rutaCer: form.ruta_cer,
            rutaKey: form.ruta_key,
            contrasenaFiel: form.contrasena_fiel,
            carpetaDescarga: form.carpeta_descarga
          }}
          onChange={cambiarForm}
          onSeleccionarCer={seleccionarCer}
          onSeleccionarKey={seleccionarKey}
          onSeleccionarCarpeta={seleccionarCarpeta}
          mostrarNombre={true}
        />
      </Modal>
    </div>
  )
}

export default PerfilesPage