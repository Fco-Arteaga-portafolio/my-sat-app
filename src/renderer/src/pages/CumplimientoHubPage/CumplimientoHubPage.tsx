import HubPage from '../../components/HubPage/HubPage'

const CumplimientoHubPage = () => {
  return (
    <HubPage
      title="Cumplimiento"
      subtitle="Verifica tu situación ante el SAT"
      cards={[
        { icon: '✅', label: 'Opinión de cumplimiento', description: 'Consulta tu opinión SAT', comingSoon: true },
        { icon: '📄', label: 'Constancia fiscal', description: 'Descarga tu constancia', comingSoon: true },
        { icon: '📬', label: 'Buzón tributario', description: 'Notificaciones del SAT', comingSoon: true }
      ]}
    />
  )
}

export default CumplimientoHubPage