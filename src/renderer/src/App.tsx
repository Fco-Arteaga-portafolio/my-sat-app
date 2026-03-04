import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/Layout/AppLayout'
import ConfiguracionPage from './pages/ConfiguracionPage/ConfiguracionPage'
import DescargaPage from './pages/DescargaPage/DescargaPage'
import FacturasPage from './pages/FacturasPage/FacturasPage'
import PendientesPage from './pages/PendientesPage/PendientesPage'

const App = (): JSX.Element => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/facturas" replace />} />
          <Route path="/configuracion" element={<ConfiguracionPage />} />
          <Route path="/descarga" element={<DescargaPage />} />
          <Route path="/facturas" element={<FacturasPage />} />
          <Route path="/pendientes" element={<PendientesPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App