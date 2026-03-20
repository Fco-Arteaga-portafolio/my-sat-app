import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContribuyente } from '../../context/ContribuyenteContext'
import HubPage from '../../components/HubPage/HubPage'

const CfdiHubPage = () => {
  const navigate = useNavigate()
  const { perfil } = useContribuyente()
  const [pendientes, setPendientes] = useState(0)
  const [conteos, setConteos] = useState({ recibidas: 0, emitidas: 0 })

  useEffect(() => {
    if (perfil) cargar()
  }, [perfil?.rfc])

  const cargar = async () => {
    const [resPendientes, resConteos] = await Promise.all([
      window.api.contarPendientes(),
      window.api.obtenerConteos()
    ])
    if (resPendientes.success) setPendientes(resPendientes.total || 0)
    if (resConteos.success && resConteos.data)
      setConteos({
        recibidas: resConteos.data.recibidas,
        emitidas: resConteos.data.emitidas
      })
  }

  return (
    <HubPage
      title="CFDI"
      subtitle="Administra y consulta tus comprobantes fiscales"
      sections={[
        {
          title: 'Operaciones',
          cards: [
            {
              icon: '🌐',
              label: 'Descargar del SAT',
              description: 'Descarga por rango de fechas',
              onClick: () => navigate('/descarga')
            },
            {
              icon: '📂',
              label: 'Importar local',
              description: 'Desde carpeta o archivos',
              onClick: () => navigate('/importacion')
            },
            {
              icon: '⏳',
              label: 'Pendientes',
              badge: pendientes,
              description: 'Facturas con error',
              onClick: () => navigate('/pendientes')
            },
            {
              icon: '🔄',
              label: 'Conciliación',
              description: 'Sincroniza con el SAT',
              onClick: () => navigate('/conciliacion')
            }
          ]
        },
        {
          title: 'Consulta',
          cards: [
            {
              icon: '📥',
              label: 'Recibidos',
              description: 'CFDIs de proveedores y empleadores',
              count: conteos.recibidas,
              onClick: () => navigate('/cfdi/recibidos')
            },
            {
              icon: '📤',
              label: 'Emitidos',
              description: 'CFDIs expedidos a tus clientes',
              count: conteos.emitidas,
              onClick: () => navigate('/cfdi/emitidos')
            }
          ]
        }
      ]}
    />
  )
}

export default CfdiHubPage
