import { Layout, Menu } from 'antd'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useContribuyente } from '../../context/ContribuyenteContext'
import logoIcon from '../../assets/icon.png'
import LicenseFooter from '../LicenseFooter/LicenseFooter'
import { useState, useEffect } from 'react'
import {
  HomeOutlined,
  AuditOutlined,
  BarChartOutlined,
  SafetyOutlined,
  BulbOutlined,
  SettingOutlined,
  SwapOutlined,
  UserOutlined
} from '@ant-design/icons'
import './AppLayout.css'

const { Sider, Content, Header } = Layout

const AppLayout = () => {
  const location = useLocation()
  const [_totalPendientes, setTotalPendientes] = useState(0)
  const [rfcCount, setRfcCount] = useState(1)
  const [collapsed, setCollapsed] = useState(false)
  const { perfil, setPerfil } = useContribuyente()
  const navigate = useNavigate()

  useEffect(() => {
    cargarContador()
    cargarRFCCount()
  }, [location.pathname])

  const cargarContador = async () => {
    const res = await window.api.contarPendientes()
    if (res.success && res.total !== undefined) {
      setTotalPendientes(res.total)
    }
  }

  const cargarRFCCount = async () => {
    try {
      const res = await window.api.obtenerPerfiles()
      if (res.success && res.perfiles) {
        setRfcCount(res.perfiles.length)
      }
    } catch (error) {
      console.error('Error cargando RFCs:', error)
    }
  }

  const menuItems = [
    { key: '/inicio', icon: <HomeOutlined />, label: 'Inicio' },
    { key: '/cfdi', icon: <AuditOutlined />, label: 'CFDI' },
    { key: '/reportes', icon: <BarChartOutlined />, label: 'Reportes' },
    { key: '/cumplimiento', icon: <SafetyOutlined />, label: 'Cumplimiento' },
    { key: '/inteligencia', icon: <BulbOutlined />, label: 'Inteligencia' },
    { key: '/configuracion', icon: <SettingOutlined />, label: 'Configuración' }
  ]

  const selectedKey = () => {
    if (location.pathname.startsWith('/cfdi')) return '/cfdi'
    if (location.pathname.startsWith('/descarga')) return '/cfdi'
    if (location.pathname.startsWith('/pendientes')) return '/cfdi'
    if (location.pathname.startsWith('/importacion')) return '/cfdi'
    if (location.pathname.startsWith('/conciliacion')) return '/cfdi'
    if (location.pathname.startsWith('/clientes')) return '/inteligencia'
    if (location.pathname.startsWith('/proveedores')) return '/inteligencia'
    if (location.pathname.startsWith('/empleados')) return '/inteligencia'
    if (location.pathname.startsWith('/patrones')) return '/inteligencia'
    return location.pathname
  }

  return (
    <Layout className="ant-layout" style={{ height: '100vh' }}>
      <Sider
        theme="dark"
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        style={{ background: '#001529' }}
      >
        <div className="app-logo">
          <img src={logoIcon} alt="IFRAT" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          {!collapsed && (
            <span style={{ marginLeft: 10, fontSize: 20, fontWeight: 700, color: '#fff' }}>
              IFRAT
            </span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey()]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
        <div className="app-cambiar-contribuyente-footer">
          <div
            className="app-cambiar-contribuyente"
            onClick={async () => {
              await window.api.cerrarPerfil()
              setPerfil(null)
              navigate('/perfiles')
            }}
          >
            <SwapOutlined />
            {!collapsed && <span>Cambiar contribuyente</span>}
          </div>
        </div>
      </Sider>
      <Layout className="app-layout-inner" style={{ height: '100%' }}>
        <Header className="app-header">
          <span className="app-header-label">Contribuyente activo</span>
          <div className="app-header-perfil">
            <div className="app-header-avatar">
              <UserOutlined style={{ fontSize: 13, color: '#fff' }} />
            </div>
            <div>
              <div className="app-header-nombre">{perfil?.nombre}</div>
              <div className="app-header-rfc">{perfil?.rfc}</div>
            </div>
          </div>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
        <LicenseFooter licenseStatus="Demo" rfcCount={rfcCount} machineCount={1} />
      </Layout>
    </Layout>
  )
}

export default AppLayout
