import { Modal, Button, Progress } from 'antd'
import { useEffect, useState } from 'react'
import './UpdateModal.css'

const UpdateModal = () => {
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!window.electronUpdater) return // ← esta línea

    window.electronUpdater.onStatus((s) => {
      setStatus(s)
      if (s === 'available' || s === 'downloading' || s === 'downloaded') {
        setVisible(true)
      }
    })

    window.electronUpdater.onProgress((p) => {
      setProgress(p)
      setStatus('downloading')
    })
  }, [])

  const handleDescargar = () => {
    window.electronUpdater?.download() // ← ver nota abajo
  }

  const handleLater = () => {
    window.electronUpdater?.postpone()
  }

  const handleInstall = () => {
    window.electronUpdater?.install()
  }

  return (
    <Modal open={visible} footer={null} closable={false} centered>
      {status === 'available' && (
        <>
          <h3>Nueva versión disponible</h3>
          <p>Es necesario actualizar IFRAT para continuar.</p>
          <div className="update-buttons">
            <Button type="primary" onClick={handleDescargar}>
              Descargar actualización
            </Button>
            <Button danger onClick={handleLater}>
              Actualizar más tarde
            </Button>
          </div>
        </>
      )}

      {status === 'downloading' && (
        <>
          <h3>Descargando actualización</h3>
          <p>Por favor espera, no cierres la aplicación.</p>
          <Progress percent={Math.round(progress)} status="active" />
        </>
      )}

      {status === 'downloaded' && (
        <>
          <h3>Actualización lista</h3>
          <p>La nueva versión ya se descargó.</p>
          <Button type="primary" onClick={handleInstall}>
            Reiniciar y actualizar
          </Button>
        </>
      )}

      {status === 'checking' && <p>Buscando actualizaciones...</p>}
    </Modal>
  )
}

export default UpdateModal
