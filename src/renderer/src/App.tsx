import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import AppLayout from './components/Layout/AppLayout'
import ConfiguracionPage from './pages/ConfiguracionPage/ConfiguracionPage'
import DescargaPage from './pages/DescargaPage/DescargaPage'
import FacturasPage from './pages/FacturasPage/FacturasPage'
import PendientesPage from './pages/PendientesPage/PendientesPage'
import PerfilesPage from './pages/PerfilesPage/PerfilesPage'

const App = () => {
  const [perfilListo, setPerfilListo] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.obtenerPerfilActivo().then((res) => {
      setPerfilListo(!!res.perfil)
    })
  }, [])

  if (perfilListo === null) return <div style={{ padding: 40 }}>Cargando...</div>

  return (
    <HashRouter>
      <Routes>
        <Route path="/perfiles" element={<PerfilesPage onPerfilSeleccionado={() => setPerfilListo(true)} />} />
        <Route path="/" element={perfilListo ? <AppLayout /> : <Navigate to="/perfiles" replace />}>
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