import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useContribuyente, ContribuyenteProvider } from './context/ContribuyenteContext'
import AppLayout from './components/Layout/AppLayout'
import ConfiguracionPage from './pages/ConfiguracionPage/ConfiguracionPage'
import DescargaPage from './pages/DescargaPage/DescargaPage'
import FacturasPage from './pages/FacturasPage/FacturasPage'
import PendientesPage from './pages/PendientesPage/PendientesPage'
import PerfilesPage from './pages/PerfilesPage/PerfilesPage'
import ImportacionPage from './pages/ImportacionPage/ImportacionPage'

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
        <Route path="/" element={<Navigate to="/facturas" replace />} />
        <Route path="/configuracion" element={<ConfiguracionPage />} />
        <Route path="/descarga" element={<DescargaPage />} />
        <Route path="/facturas" element={<FacturasPage />} />
        <Route path="/pendientes" element={<PendientesPage />} />
        <Route path="/importacion" element={<ImportacionPage />} />
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