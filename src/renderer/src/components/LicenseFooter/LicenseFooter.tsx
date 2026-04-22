import { Space, Spin, Tooltip, Upload } from 'antd'
import {
  SafetyCertificateOutlined,
  WindowsOutlined,
  DisconnectOutlined,
  ShoppingCartOutlined,
  UploadOutlined
} from '@ant-design/icons'
import { useState, useEffect } from 'react'
import './LicenseFooter.css'

interface LicenseFooterProps {
  licenseStatus?: 'Demo' | 'Vigente' | 'Vencido'
  rfcCount?: number
  machineCount?: number
  loading?: boolean
}

const LicenseFooter = ({
  licenseStatus = 'Demo',
  rfcCount = 0,
  machineCount = 1,
  loading = false
}: LicenseFooterProps) => {
  const [actualStatus, setActualStatus] = useState<'Demo' | 'Vigente' | 'Vencido'>(licenseStatus)
  const [actualRfcCount, setActualRfcCount] = useState(rfcCount)
  const [isLoading, setIsLoading] = useState(loading)

  useEffect(() => {
    cargarDatosLicencia()
  }, [])

  const cargarDatosLicencia = async () => {
    setIsLoading(true)
    try {
      const res = await window.api.obtenerLicencia()
      if (res.success && res.licencia) {
        setActualStatus(res.licencia.estado)
      }
    } catch (error) {
      console.error('Error cargando licencia:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = () => {
    switch (actualStatus) {
      case 'Vigente':
        return '#52c41a' // Verde
      case 'Vencido':
        return '#ff7875' // Rojo
      case 'Demo':
      default:
        return '#1890ff' // Azul
    }
  }

  const getStatusLabel = () => {
    switch (actualStatus) {
      case 'Vigente':
        return '✓ Licencia Vigente'
      case 'Vencido':
        return '✗ Licencia Vencida'
      case 'Demo':
      default:
        return '◇ Versión Demo'
    }
  }

  const abrirSitioCompra = () => {
    // Aquí puedes usar ipcRenderer.invoke('abrir-url', 'https://tu-sitio-de-compra.com')
    window.open('https://tu-sitio-de-compra.com', '_blank')
  }

  const subirLicencia = (file: File) => {
    console.log('Archivo cargado:', file)
    // Aquí luego conectas con tu backend para validar el GUID
  }

  return (
    <div className="license-footer">
      <div className="license-footer-content">
        {isLoading ? (
          <Spin size="small" />
        ) : (
          <Space size="large" className="license-footer-items">
            {/* Estado de Licencia */}
            <div className="license-footer-item">
              <SafetyCertificateOutlined
                className="license-footer-icon"
                style={{ color: getStatusColor() }}
              />
              <span className="license-footer-label" style={{ color: getStatusColor() }}>
                {getStatusLabel()}
              </span>
            </div>

            {/* Si está en Demo, mostrar botón de compra */}
            {(actualStatus === 'Demo' || actualStatus === 'Vencido') && (
              <Tooltip title="Comprar licencia">
                <ShoppingCartOutlined
                  className="license-footer-icon"
                  style={{ color: '#faad14', cursor: 'pointer' }}
                  onClick={abrirSitioCompra}
                />
              </Tooltip>
            )}

            {/* Botón Cargar Licencia */}
            <Tooltip title="Cargar licencia">
              <Upload
                showUploadList={false}
                beforeUpload={(file) => {
                  subirLicencia(file)
                  return false // evita subida automática
                }}
              >
                <UploadOutlined
                  className="license-footer-icon"
                  style={{ color: '#1890ff', cursor: 'pointer' }}
                />
              </Upload>
            </Tooltip>

            {/* Separador visual */}
            <div className="license-footer-separator" />

            {/* Cantidad de RFCs */}
            <div className="license-footer-item">
              <DisconnectOutlined className="license-footer-icon" style={{ color: '#8c8c8c' }} />
              <span className="license-footer-label">
                {actualRfcCount} RFC{actualRfcCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Cantidad de Máquinas */}
            <div className="license-footer-item">
              <WindowsOutlined className="license-footer-icon" style={{ color: '#8c8c8c' }} />
              <span className="license-footer-label">
                {machineCount} Máquina{machineCount !== 1 ? 's' : ''}
              </span>
            </div>
          </Space>
        )}
      </div>
    </div>
  )
}

export default LicenseFooter
