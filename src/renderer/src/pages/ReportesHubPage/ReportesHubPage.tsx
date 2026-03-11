import { useNavigate } from 'react-router-dom'
import HubPage from '../../components/HubPage/HubPage'

const ReportesHubPage = () => {
  const navigate = useNavigate()

  return (
    <HubPage
      title="Reportes"
      subtitle="Análisis y exportaciones de tu información fiscal"
      cards={[
        { icon: '💳', label: 'IVA', description: 'Reporte mensual de IVA', comingSoon: true },
        { icon: '📋', label: 'ISR', description: 'Estimado de ISR', comingSoon: true },
        { icon: '📊', label: 'Exportar Excel', description: 'Exporta tus facturas', onClick: () => navigate('/facturas?accion=exportar') }
      ]}
    />
  )
}

export default ReportesHubPage