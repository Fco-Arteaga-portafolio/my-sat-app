import { Modal, Tabs, Spin } from 'antd'
import { useState, useEffect } from 'react'
import { FileTextOutlined, FilePdfOutlined, CodeOutlined } from '@ant-design/icons'
import { Factura } from '../../../../main/database/repositories/FacturaRepository'
import { parsearXml, FacturaParseada } from '../../utils/xmlParser'
import FacturaDetalleInfo from './FacturaDetalleInfo'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface Props {
  factura: Factura | null
  visible: boolean
  onCerrar: () => void
}

const FacturaDetalleModal = ({ factura, visible, onCerrar }: Props) => {
  const [parseada, setParseada] = useState<FacturaParseada | null>(null)
  const [xmlContenido, setXmlContenido] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [cargandoPdf, setCargandoPdf] = useState(false)
  const [tabActivo, setTabActivo] = useState('detalle')
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)

  useEffect(() => {
    if (visible && factura?.xml) {
      cargarXml()
      setTabActivo('detalle')
      setPdfBase64(null)
    } else {
      setParseada(null)
      setXmlContenido(null)
      setPdfBase64(null)
    }
  }, [visible, factura])

  const cargarXml = async () => {
    setCargando(true)
    try {
      const res = await window.api.leerXml(factura!.xml)
      if (res.success && res.contenido) {
        setXmlContenido(res.contenido)
        setParseada(parsearXml(res.contenido))
      }
    } finally {
      setCargando(false)
    }
  }

  const cargarPdf = async () => {
    if (pdfBase64 || !parseada || !factura) return
    setCargandoPdf(true)
    try {
      const res = await window.api.obtenerPdfFactura({
        rutaXml: factura.xml,
        uuid: factura.uuid,
        parseada
      })
      console.log('pdf res:', res)
      if (res.success) setPdfBase64(res.base64)
    } finally {
      setCargandoPdf(false)
    }
  }

  const onCambiarTab = (key: string) => {
    setTabActivo(key)
    if (key === 'pdf') cargarPdf()
  }

  const tabs = [
    {
      key: 'detalle',
      label: <span><FileTextOutlined /> Detalle</span>,
      children: (
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {cargando && <Spin style={{ display: 'block', textAlign: 'center', padding: 40 }} />}
          {!cargando && parseada && <FacturaDetalleInfo factura={factura} parseada={parseada} />}
          {!cargando && !parseada && factura && (
            <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>No se pudo cargar el XML</p>
          )}
        </div>
      )
    },
    {
      key: 'pdf',
      label: <span><FilePdfOutlined /> PDF</span>,
      children: (
        <div style={{ height: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {cargandoPdf && <Spin tip="Generando PDF..." style={{ marginTop: 40 }} />}
          {!cargandoPdf && pdfBase64 && (
            <Document
              file={`data:application/pdf;base64,${pdfBase64}`}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              onLoadError={(error) => console.log('pdf error:', error)}
              loading={<Spin tip="Cargando PDF..." />}
            >
              {Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={i + 1}
                  pageNumber={i + 1}
                  width={820}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              ))}
            </Document>
          )}
          {!cargandoPdf && !pdfBase64 && (
            <p style={{ color: '#999', marginTop: 40 }}>No se pudo cargar el PDF</p>
          )}
        </div>
      )
    },
    {
      key: 'xml',
      label: <span><CodeOutlined /> XML</span>,
      children: (
        <div style={{ height: '70vh', overflowY: 'auto' }}>
          {xmlContenido ? (
            <pre style={{
              fontSize: 11, background: '#1e1e1e', color: '#d4d4d4',
              padding: 16, borderRadius: 6, margin: 0,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all'
            }}>
              {xmlContenido}
            </pre>
          ) : (
            <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>
              El archivo XML no está disponible
            </p>
          )}
        </div>
      )
    }
  ]

  return (
    <Modal
      title="Detalle de Factura"
      open={visible}
      onCancel={onCerrar}
      footer={null}
      width={900}
      style={{ top: 20 }}
    >
      <Tabs items={tabs} activeKey={tabActivo} onChange={onCambiarTab} />
    </Modal>
  )
}

export default FacturaDetalleModal