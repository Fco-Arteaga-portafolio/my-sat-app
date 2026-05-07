import { useNavigate } from 'react-router-dom'
import HubPage from '../../components/HubPage/HubPage'

const CumplimientoHubPage = () => {
  const navigate = useNavigate()

  return (
    <HubPage
      title="Cumplimiento"
      subtitle="Verifica tu situación ante el SAT"
      cards={[
        {
          icon: '✅',
          label: 'Opinión de cumplimiento',
          description: 'Consulta tu opinión SAT',
          onClick: () => navigate('/cumplimiento/opinion')
        },
        {
          icon: '📄',
          label: 'Constancia fiscal',
          description: 'Descarga tu constancia',
          onClick: () => navigate('/cumplimiento/constancia')
        },
        {
          icon: '📬',
          label: 'Radar 69-B',
          description: 'Escudo contra empresas facturadoras.',
          onClick: () => navigate('/cumplimiento/radar')
        },
        {
          icon: '💰', // Icono propuesto para la DIOT (saco de dinero)
          label: 'DIOT',
          description: 'Generar declaración de operaciones con terceros.',
          comingSoon: true // Revisa si esta ruta es correcta
        }
      ]}
    />
  )
}

export default CumplimientoHubPage
