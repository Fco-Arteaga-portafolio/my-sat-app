import { Modal, Radio, Card, Space } from 'antd'
import { useState } from 'react'
import { Factura } from '../../../../main/database/repositories/FacturaRepository'

interface Props {
  factura: Factura | null
  visible: boolean
  onCerrar: () => void
}

const plantillas = [
  {
    id: 'clasica',
    nombre: 'Clásica',
    descripcion: 'Fondo blanco, tipografía formal, estilo corporativo tradicional',
    preview: '🏛️'
  },
  {
    id: 'moderna',
    nombre: 'Moderna',
    descripcion: 'Diseño limpio con acento azul, tipografía moderna',
    preview: '🎨'
  },
  {
    id: 'minimalista',
    nombre: 'Minimalista',
    descripcion: 'Sin colores, ideal para imprimir en blanco y negro',
    preview: '📄'
  }
]

const SeleccionPlantillaModal = ({ factura, visible, onCerrar }: Props) => {
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>('clasica')
  const [generando, setGenerando] = useState(false)

  const generar = async () => {
    if (!factura?.xml) return

    setGenerando(true)
    try {
      // Leer XML
      const resXml = await window.api.leerXml(factura.xml)
      if (!resXml.success || !resXml.contenido) {
        alert('No se pudo leer el XML')
        return
      }

      // Parsear XML en el renderer
      const { parsearXml } = await import('../../utils/xmlParser')
      const parseada = parsearXml(resXml.contenido)

      // Elegir dónde guardar
      const resCarpeta = await window.api.seleccionarCarpeta()
      if (!resCarpeta.success || !resCarpeta.ruta) return

      const rutaDestino = `${resCarpeta.ruta}/${factura.uuid}.pdf`
        .replace(/\\/g, '/')

      // Generar PDF
      const res = await window.api.generarPdf({
        xmlContenido: resXml.contenido,
        parseada,
        uuid: factura.uuid,
        plantilla: plantillaSeleccionada,
        rutaDestino
      })

      if (res.success) {
        alert(`PDF generado correctamente:\n${rutaDestino}`)
        onCerrar()
      } else {
        alert(`Error al generar PDF: ${res.error}`)
      }
    } finally {
      setGenerando(false)
    }
  }

  return (
    <Modal
      title="Generar PDF"
      open={visible}
      onCancel={onCerrar}
      onOk={generar}
      okText="Generar PDF"
      cancelText="Cancelar"
      confirmLoading={generando}
      width={500}
    >
      <p style={{ marginBottom: 16, color: '#666' }}>
        Selecciona el diseño para la representación impresa del CFDI:
      </p>
      <Radio.Group
        value={plantillaSeleccionada}
        onChange={(e) => setPlantillaSeleccionada(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {plantillas.map((p) => (
            <Card
              key={p.id}
              size="small"
              style={{
                cursor: 'pointer',
                border: plantillaSeleccionada === p.id ? '2px solid #1a73e8' : '1px solid #ddd',
                background: plantillaSeleccionada === p.id ? '#f0f7ff' : '#fff'
              }}
              onClick={() => setPlantillaSeleccionada(p.id)}
            >
              <Radio value={p.id}>
                <span style={{ fontSize: 20, marginRight: 8 }}>{p.preview}</span>
                <strong>{p.nombre}</strong>
                <span style={{ color: '#888', marginLeft: 8, fontSize: 11 }}>{p.descripcion}</span>
              </Radio>
            </Card>
          ))}
        </Space>
      </Radio.Group>
    </Modal>
  )
}

export default SeleccionPlantillaModal