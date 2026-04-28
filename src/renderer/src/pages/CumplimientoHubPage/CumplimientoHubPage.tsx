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
          label: 'Buzón tributario',
          description: 'Notificaciones del SAT',
          comingSoon: true
        }
      ]}
    />
  )
}

export default CumplimientoHubPage
