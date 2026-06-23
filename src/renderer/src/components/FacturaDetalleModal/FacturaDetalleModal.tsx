import { Modal, Tabs, Spin, Button } from 'antd'
import { useState, useEffect } from 'react'
import { FileTextOutlined, FilePdfOutlined, CodeOutlined, PrinterOutlined } from '@ant-design/icons'
import { Factura } from '../../../../main/database/repositories/FacturaRepository'
import { parsearXml, FacturaParseada } from '../../utils/xmlParser'
import FacturaDetalleInfo from './FacturaDetalleInfo'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import './FacturaDetalleModal.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', window.location.href).toString()

interface Props {
  factura: Factura | null
  visible: boolean
  onCerrar: () => void
}

const formatearXml = (xml: string): string => {
  let nivel = 0
  const tab = '  '
  return xml
    .replace(/>\s*</g, '><')
    .replace(/(<\/?[^>]+>)/g, (match) => {
      if (match.startsWith('</')) {
        nivel--
        return '\n' + tab.repeat(nivel) + match
      } else if (match.endsWith('/>')) {
        return '\n' + tab.repeat(nivel) + match
      } else {
        const resultado = '\n' + tab.repeat(nivel) + match
        nivel++
        return resultado
      }
    })
    .trim()
}

const FacturaDetalleModal = ({ factura, visible, onCerrar }: Props) => {
  const [parseada, setParseada] = useState<FacturaParseada | null>(null)
  const [xmlContenido, setXmlContenido] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [cargandoPdf, setCargandoPdf] = useState(false)
  const [tabActivo, setTabActivo] = useState('detalle')
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [_rutaPdf, setRutaPdf] = useState<string | null>(null)

  useEffect(() => {
    if (visible && factura?.xml) {
      cargarXml()
      setTabActivo('detalle')
      setPdfBase64(null)
      setRutaPdf(null)
    } else {
      setParseada(null)
      setXmlContenido(null)
      setPdfBase64(null)
      setRutaPdf(null)
    }
  }, [visible, factura])

  const imprimirPdf = async () => {
    if (!factura) return
    const rutaPdf = factura.xml.replace(/\.xml$/i, '.pdf')
    await window.api.abrirArchivo(rutaPdf)
  }

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
      if (res.success) {
        setPdfBase64(res.base64)
        setRutaPdf(res.rutaPdf)
      }
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
      label: (
        <span>
          <FileTextOutlined /> Detalle
        </span>
      ),
      children: (
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {cargando && <Spin style={{ display: 'block', textAlign: 'center', padding: 40 }} />}
          {!cargando && parseada && <FacturaDetalleInfo factura={factura} parseada={parseada} />}
          {!cargando && !parseada && factura && (
            <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>
              No se pudo cargar el XML
            </p>
          )}
        </div>
      )
    },
    {
      key: 'pdf',
      label: (
        <span>
          <FilePdfOutlined /> PDF
        </span>
      ),
      children: (
        <div
          style={{
            height: '70vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          {cargandoPdf && <Spin tip="Generando PDF..." style={{ marginTop: 40 }} />}
          {!cargandoPdf && pdfBase64 && (
            <>
              <div style={{ alignSelf: 'flex-end', marginBottom: 8, paddingRight: 8 }}>
                <Button icon={<PrinterOutlined />} size="small" onClick={imprimirPdf}>
                  Imprimir
                </Button>
              </div>
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
            </>
          )}
          {!cargandoPdf && !pdfBase64 && (
            <p style={{ color: '#999', marginTop: 40 }}>No se pudo cargar el PDF</p>
          )}
        </div>
      )
    },
    {
      key: 'xml',
      label: (
        <span>
          <CodeOutlined /> XML
        </span>
      ),
      children: (
        <div style={{ height: '70vh', overflowY: 'auto' }}>
          {xmlContenido ? (
            <pre className="xml-viewer">{formatearXml(xmlContenido)}</pre>
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
