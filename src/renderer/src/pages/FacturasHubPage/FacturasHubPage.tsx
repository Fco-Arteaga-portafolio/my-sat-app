import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContribuyente } from '../../context/ContribuyenteContext'
import HubPage from '../../components/HubPage/HubPage'

const FacturasHubPage = () => {
  const navigate = useNavigate()
  const { perfil } = useContribuyente()
  const [conteos, setConteos] = useState({ recibidas: 0, emitidas: 0, nomina: 0, pagos: 0 })

  useEffect(() => {
    if (perfil) cargar()
  }, [perfil?.rfc])

  const cargar = async () => {
    const res = await window.api.obtenerConteos()
    if (res.success) setConteos(res.data)
  }

  return (
    <HubPage
      title="Facturas"
      subtitle="Consulta tus CFDIs por tipo de comprobante"
      cards={[
        { icon: '📥', label: 'Recibidas', count: conteos.recibidas, onClick: () => navigate('/facturas?tipo=recibida') },
        { icon: '📤', label: 'Emitidas', count: conteos.emitidas, onClick: () => navigate('/facturas?tipo=emitida') },
        { icon: '💰', label: 'Nómina', count: conteos.nomina, onClick: () => navigate('/facturas?tipo=nomina') },
        { icon: '🔄', label: 'Pagos (REP)', count: conteos.pagos, onClick: () => navigate('/facturas?tipo=pagos') }
      ]}
    />
  )
}

export default FacturasHubPage