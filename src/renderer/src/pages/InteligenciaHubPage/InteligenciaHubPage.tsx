import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContribuyente } from '../../context/ContribuyenteContext'
import HubPage from '../../components/HubPage/HubPage'

const InteligenciaHubPage = () => {
  const navigate = useNavigate()
  const { perfil } = useContribuyente()
  const [conteos, setConteos] = useState({ clientes: 0, proveedores: 0, empleados: 0, patrones: 0 })

  useEffect(() => {
    if (perfil) cargar()
  }, [perfil?.rfc])

  const cargar = async () => {
    const res = await window.api.obtenerConteos()
    if (res.success) setConteos(res.data)
  }

  return (
    <HubPage
      title="Inteligencia"
      subtitle="Catálogos automáticos generados desde tus CFDIs"
      cards={[
        { icon: '👤', label: 'Clientes', count: conteos.clientes, onClick: () => navigate('/clientes') },
        { icon: '🏢', label: 'Proveedores', count: conteos.proveedores, onClick: () => navigate('/proveedores') },
        {
          icon: '👥', label: 'Empleados', count: conteos.empleados,
          disabled: conteos.empleados === 0,
          disabledTooltip: 'No se detectaron CFDIs de nómina donde seas patrón',
          onClick: () => navigate('/empleados')
        },
        {
          icon: '🏭', label: 'Patrones', count: conteos.patrones,
          disabled: conteos.patrones === 0,
          disabledTooltip: 'No se detectaron CFDIs de nómina donde seas empleado',
          onClick: () => navigate('/patrones')
        }
      ]}
    />
  )
}

export default InteligenciaHubPage