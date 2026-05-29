import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Component, ReactNode } from 'react'
import { useContribuyente, ContribuyenteProvider } from './context/ContribuyenteContext'
import AppLayout from './components/Layout/AppLayout'
import ConfiguracionPage from './pages/ConfiguracionPage/ConfiguracionPage'
import DescargaPage from './pages/DescargaPage/DescargaPage'
import PendientesPage from './pages/PendientesPage/PendientesPage'
import PerfilesPage from './pages/PerfilesPage/PerfilesPage'
import ImportacionPage from './pages/ImportacionPage/ImportacionPage'
import DashboardPage from './pages/DashboardPage/DashboardPage'
import CfdiHubPage from './pages/CfdiHubPage/CfdiHubPage'
import ReportesHubPage from './pages/ReportesHubPage/ReportesHubPage'
import CumplimientoHubPage from './pages/CumplimientoHubPage/CumplimientoHubPage'
import InteligenciaHubPage from './pages/InteligenciaHubPage/InteligenciaHubPage'
import CatalogoPage from './pages/CatalogoPage/CatalogoPage'
import CatalogoPerfilPage from './pages/CatalogoPage/CatalogoPerfilPage'
import ConciliacionPage from './pages/ConciliacionPage/Conciliacionpage'
import ReportesIvaPage from './pages/ReportesIvaPage/ReportesIvaPage'
import CfdiRecibidasPage from './pages/CfdiRecibidasPage/CfdiRecibidasPage'
import CfdiEmitidasPage from './pages/CfdiEmitidasPage/CfdiEmitidasPage'
import UpdateModal from './components/UpdateModal/UpdateModal'
import ReportesIsrPage from './pages/ReportesIsrPage/ReportesIsrPage'
import ReporteDetalleMesPage from './pages/ReporteDetalleMesPage/ReporteDetalleMesPage'
import ExportacionPage from './pages/ExportacionPage/ExportacionPage'
import CumplimientoPage from './pages/CumplimientoPage/CumplimientoPage'
import ConstanciaPage from './pages/ConstanciaPage/ConstanciaPage'
import Radar69BPage from './pages/Radar69BPage/Radar69BPage'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: 'red', fontFamily: 'monospace', background: '#fff' }}>
          <h2>Error en renderer</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{(this.state.error as Error).stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

const RutaProtegida = ({ children }: { children: ReactNode }) => {
  const { perfil } = useContribuyente()
  if (perfil === null) return <Navigate to="/perfiles" replace />
  return <>{children}</>
}

const AppRoutes = () => {
  const { setPerfil } = useContribuyente()

  return (
    <Routes>
      <Route
        path="/perfiles"
        element={<PerfilesPage onPerfilSeleccionado={(perfil) => setPerfil(perfil)} />}
      />
      <Route
        path="/"
        element={
          <RutaProtegida>
            <AppLayout />
          </RutaProtegida>
        }
      >
        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route path="/inicio" element={<DashboardPage />} />
        <Route path="/cfdi/recibidos" element={<CfdiRecibidasPage />} />
        <Route path="/cfdi/emitidos" element={<CfdiEmitidasPage />} />
        <Route path="/cfdi" element={<CfdiHubPage />} />
        <Route path="/reportes" element={<ReportesHubPage />} />
        <Route path="/cumplimiento" element={<CumplimientoHubPage />} />
        <Route path="/inteligencia" element={<InteligenciaHubPage />} />
        <Route path="/descarga" element={<DescargaPage />} />
        <Route path="/pendientes" element={<PendientesPage />} />
        <Route path="/importacion" element={<ImportacionPage />} />
        <Route path="/configuracion" element={<ConfiguracionPage />} />
        <Route path="/cumplimiento/constancia" element={<ConstanciaPage />} />
        <Route
          path="/clientes"
          element={
            <CatalogoPage
              tipo="clientes"
              titulo="Clientes"
              subtitulo="Empresas y personas que te han facturado"
            />
          }
        />
        <Route path="/clientes/:rfc" element={<CatalogoPerfilPage tipo="clientes" />} />
        <Route
          path="/proveedores"
          element={
            <CatalogoPage
              tipo="proveedores"
              titulo="Proveedores"
              subtitulo="Empresas y personas que te han emitido facturas"
            />
          }
        />
        <Route path="/proveedores/:rfc" element={<CatalogoPerfilPage tipo="proveedores" />} />
        <Route
          path="/empleados"
          element={
            <CatalogoPage
              tipo="empleados"
              titulo="Empleados"
              subtitulo="Personas que han recibido nómina de tu empresa"
            />
          }
        />
        <Route path="/empleados/:rfc" element={<CatalogoPerfilPage tipo="empleados" />} />
        <Route
          path="/patrones"
          element={
            <CatalogoPage
              tipo="patrones"
              titulo="Patrones"
              subtitulo="Empresas de las que has recibido nómina"
            />
          }
        />
        <Route path="/patrones/:rfc" element={<CatalogoPerfilPage tipo="patrones" />} />
        <Route path="/conciliacion" element={<ConciliacionPage />} />
        <Route path="/reportes/iva" element={<ReportesIvaPage />} />
        <Route path="/reportes/isr" element={<ReportesIsrPage />} />
        <Route path="/reportes/:origen/:anio/:mes" element={<ReporteDetalleMesPage />} />
        <Route path="/exportacion" element={<ExportacionPage />} />
        <Route path="/cumplimiento/opinion" element={<CumplimientoPage />} />
        <Route path="/cumplimiento/radar" element={<Radar69BPage />} />
      </Route>
    </Routes>
  )
}

const App = () => {
  return (
    <ErrorBoundary>
      <ContribuyenteProvider>
        <UpdateModal />
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </ContribuyenteProvider>
    </ErrorBoundary>
  )
}

export default App
