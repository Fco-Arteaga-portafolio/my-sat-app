import { Modal, Button, Progress } from 'antd'
import { useEffect, useState } from 'react'
import './UpdateModal.css'

const UpdateModal = () => {
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    window.electronUpdater.onStatus((s) => {
      setStatus(s)

      if (s === 'available') {
        setVisible(true)
      }

      if (s === 'downloaded') {
        setVisible(true)
      }
    })

    window.electronUpdater.onProgress((p) => {
      setProgress(p)
    })
  }, [])

  const handleDownload = () => {
    // No hace nada porque autoDownload ya está activo
  }

  const handleInstall = () => {
    window.electronUpdater.install()
  }

  const handleLater = () => {
    window.close()
  }

  return (
    <Modal open={visible} footer={null} closable={false} centered>
      {status === 'available' && (
        <>
          <h3>Nueva versión disponible</h3>
          <p>Es necesario actualizar IFRAT para continuar.</p>

          <div className="update-buttons">
            <Button type="primary" onClick={handleDownload}>
              Descargar actualización
            </Button>

            <Button danger onClick={handleLater}>
              Actualizar más tarde
            </Button>
          </div>

          {progress > 0 && <Progress percent={Math.round(progress)} />}
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
