import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContribuyente } from '../../context/ContribuyenteContext'
import HubPage from '../../components/HubPage/HubPage'

const CfdiHubPage = () => {
  const navigate = useNavigate()
  const { perfil } = useContribuyente()
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => {
    if (perfil) {
      window.api.contarPendientes().then((res: any) => {
        if (res.success) setPendientes(res.total || 0)
      })
    }
  }, [perfil?.rfc])

  return (
    <HubPage
      title="CFDI"
      subtitle="Descarga e importa tus comprobantes fiscales"
      cards={[
        { icon: '🌐', label: 'Descargar del SAT', description: 'Descarga por rango de fechas', onClick: () => navigate('/descarga') },
        { icon: '📂', label: 'Importar local', description: 'Desde carpeta o archivos', onClick: () => navigate('/importacion') },
        { icon: '⏳', label: 'Pendientes', badge: pendientes, description: 'Facturas con error', onClick: () => navigate('/pendientes') }
      ]}
    />
  )
}

export default CfdiHubPage