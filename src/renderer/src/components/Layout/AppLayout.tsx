import { Layout, Menu, Badge } from 'antd'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  FileTextOutlined,
  DownloadOutlined,
  SettingOutlined,
  WarningOutlined
} from '@ant-design/icons'
import './AppLayout.css'

const { Sider, Content } = Layout

const AppLayout = (): JSX.Element => {
  const navigate = useNavigate()
  const location = useLocation()
  const [totalPendientes, setTotalPendientes] = useState(0)

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
      key: '/pendientes',
      icon: <WarningOutlined />,
      label: (
        <span style={{ color: 'inherit' }}>
          Pendientes
          {totalPendientes > 0 && (
            <Badge count={totalPendientes} size="small" style={{ marginLeft: 8 }} />
          )}
        </span>
      )
    },
    { key: '/configuracion', icon: <SettingOutlined />, label: 'Configuración' }
  ]

  return (
    <Layout style={{ height: '100%', background: '#f0f2f5' }}>
      <Sider theme="dark" collapsible style={{ background: '#001529' }}>
        <div className="app-logo">Gravix</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout style={{ height: '100%', overflowY: 'auto', background: '#f0f2f5' }}>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout