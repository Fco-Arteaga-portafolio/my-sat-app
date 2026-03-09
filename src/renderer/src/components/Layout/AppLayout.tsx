import { Layout, Menu, Badge } from 'antd'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useContribuyente } from '../../context/ContribuyenteContext'
import logoIcon from '../../../../../resources/icon.png'
import { useState, useEffect } from 'react'
import {
  FileTextOutlined,
  DownloadOutlined,
  SettingOutlined,
  WarningOutlined,
  SwapOutlined,
  UserOutlined,
  UploadOutlined
} from '@ant-design/icons'
import './AppLayout.css'

const { Sider, Content, Header } = Layout


const AppLayout = () => {

  const location = useLocation()
  const [totalPendientes, setTotalPendientes] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const { perfil, setPerfil } = useContribuyente()  // ← solo del context
  const navigate = useNavigate()

  useEffect(() => {
    cargarContador()
  }, [location.pathname])

  const cargarContador = async () => {
    const res = await window.api.contarPendientes()
    if (res.success && res.total !== undefined) {
      setTotalPendientes(res.total)
    }
  }

  const menuItems = [
    { key: '/facturas', icon: <FileTextOutlined />, label: 'Facturas' },
    { key: '/descarga', icon: <DownloadOutlined />, label: 'Descargar' },
    {
      key: '/pendientes', icon: <WarningOutlined />, label: (
        <span style={{ color: 'inherit' }}>
          Pendientes
          {totalPendientes > 0 && (
            <Badge count={totalPendientes} size="small" style={{ marginLeft: 8 }} />
          )}
        </span>)
    },
    { key: '/importacion', icon: <UploadOutlined />, label: 'Importar' },
    { key: '/configuracion', icon: <SettingOutlined />, label: 'Configuración' }

  ]

  return (
    <Layout style={{ height: '100%', background: '#f0f2f5' }}>
      <Sider
        theme="dark"
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        style={{ background: '#001529' }}>
        <div className="app-logo">
          <img src={logoIcon} alt="Gravix" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          {!collapsed && <span style={{ marginLeft: 10, fontSize: 20, fontWeight: 700, color: '#fff' }}>Gravix</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 'auto' }}>
          <div
            onClick={async () => {
              await window.api.cerrarPerfil()
              setPerfil(null)
              navigate('/perfiles')
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              color: '#8c9db5', cursor: 'pointer', padding: '8px 4px',
              borderRadius: 6, fontSize: 13
            }}
          >
            <SwapOutlined />
            {!collapsed && <span>Cambiar contribuyente</span>}
          </div>
        </div>
      </Sider>
      <Layout style={{ height: '100%', overflowY: 'auto', background: '#f0f2f5' }}>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          height: 48,
          lineHeight: '48px',
          borderBottom: '1px solid #e8ecf0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <span style={{ fontSize: 13, color: '#8c9db5' }}>Contribuyente activo</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#001529', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <UserOutlined style={{ fontSize: 13, color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2332', lineHeight: 1.3 }}>
                {perfil?.nombre}
              </div>
              <div style={{ fontSize: 11, color: '#8c9db5', lineHeight: 1.3 }}>
                {perfil?.rfc}
              </div>
            </div>
          </div>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout