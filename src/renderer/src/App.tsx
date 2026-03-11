import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useContribuyente, ContribuyenteProvider } from './context/ContribuyenteContext'
import AppLayout from './components/Layout/AppLayout'
import ConfiguracionPage from './pages/ConfiguracionPage/ConfiguracionPage'
import DescargaPage from './pages/DescargaPage/DescargaPage'
import FacturasPage from './pages/FacturasPage/FacturasPage'
import PendientesPage from './pages/PendientesPage/PendientesPage'
import PerfilesPage from './pages/PerfilesPage/PerfilesPage'
import ImportacionPage from './pages/ImportacionPage/ImportacionPage'
import DashboardPage from './pages/DashboardPage/DashboardPage'
import FacturasHubPage from './pages/FacturasHubPage/FacturasHubPage'
import CfdiHubPage from './pages/CfdiHubPage/CfdiHubPage'
import ReportesHubPage from './pages/ReportesHubPage/ReportesHubPage'
import CumplimientoHubPage from './pages/CumplimientoHubPage/CumplimientoHubPage'
import InteligenciaHubPage from './pages/InteligenciaHubPage/InteligenciaHubPage'
import CatalogoPage from './pages/CatalogoPage/CatalogoPage'
import CatalogoPerfilPage from './pages/CatalogoPage/CatalogoPerfilPage'


const RutaProtegida = ({ children }: { children: React.ReactNode }) => {
  const { perfil } = useContribuyente()
  if (perfil === null) return <Navigate to="/perfiles" replace />
  return <>{children}</>
}

const AppRoutes = () => {
  const { setPerfil } = useContribuyente()

  return (
    <Routes>
      <Route path="/perfiles" element={
        <PerfilesPage onPerfilSeleccionado={(perfil) => setPerfil(perfil)} />
      } />
      <Route path="/" element={
        <RutaProtegida>
          <AppLayout />
        </RutaProtegida>
      }>
        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route path="/inicio" element={<DashboardPage />} />
        <Route path="/facturas-hub" element={<FacturasHubPage />} />
        <Route path="/cfdi" element={<CfdiHubPage />} />
        <Route path="/reportes" element={<ReportesHubPage />} />
        <Route path="/cumplimiento" element={<CumplimientoHubPage />} />
        <Route path="/inteligencia" element={<InteligenciaHubPage />} />
        <Route path="/facturas" element={<FacturasPage />} />
        <Route path="/descarga" element={<DescargaPage />} />
        <Route path="/pendientes" element={<PendientesPage />} />
        <Route path="/importacion" element={<ImportacionPage />} />
        <Route path="/configuracion" element={<ConfiguracionPage />} />
        <Route path="/clientes" element={<CatalogoPage tipo="clientes" titulo="Clientes" subtitulo="Empresas y personas que te han facturado" />} />
        <Route path="/clientes/:rfc" element={<CatalogoPerfilPage tipo="clientes" />} />
        <Route path="/proveedores" element={<CatalogoPage tipo="proveedores" titulo="Proveedores" subtitulo="Empresas y personas que te han emitido facturas" />} />
        <Route path="/proveedores/:rfc" element={<CatalogoPerfilPage tipo="proveedores" />} />
        <Route path="/empleados" element={<CatalogoPage tipo="empleados" titulo="Empleados" subtitulo="Personas que han recibido nómina de tu empresa" />} />
        <Route path="/empleados/:rfc" element={<CatalogoPerfilPage tipo="empleados" />} />
        <Route path="/patrones" element={<CatalogoPage tipo="patrones" titulo="Patrones" subtitulo="Empresas de las que has recibido nómina" />} />
        <Route path="/patrones/:rfc" element={<CatalogoPerfilPage tipo="patrones" />} />
      </Route>
    </Routes>
  )
}

const App = () => {
  return (
    <ContribuyenteProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ContribuyenteProvider>
  )
}

export default App