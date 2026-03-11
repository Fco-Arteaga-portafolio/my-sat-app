import { Form, Input, Button, Radio, Alert, Space, Tabs, Switch, Typography } from 'antd'
import { FolderOpenOutlined, HolderOutlined } from '@ant-design/icons'
import { SlotCarpeta, ConfigNombreArchivo } from '../../../../main/services/ConfiguracionService'
import './ContribuyenteForm.css'

const { Text } = Typography

const PLANTILLAS = [
  { id: 'clasica',     nombre: 'Clásica',     descripcion: 'Fondo blanco, tipografía formal, estilo corporativo' },
  { id: 'moderna',     nombre: 'Moderna',     descripcion: 'Diseño limpio con acento azul, tipografía moderna' },
  { id: 'minimalista', nombre: 'Minimalista', descripcion: 'Sin colores, ideal para imprimir en blanco y negro' }
]

export interface ContribuyenteFormData {
  rfc: string
  nombre?: string
  metodoAuth: 'contrasena' | 'efirma'
  contrasena?: string
  rutaCer?: string
  rutaKey?: string
  contrasenaFiel?: string
  // Carpetas
  carpetaEmitidos?: string
  carpetaRecibidos?: string
  estructuraEmitidos?: SlotCarpeta[]
  estructuraRecibidos?: SlotCarpeta[]
  // PDF
  plantillaDefault?: string
  configNombreArchivo?: ConfigNombreArchivo
}

interface Props {
  data: ContribuyenteFormData
  onChange: (campo: string, valor: any) => void
  onSeleccionarCer: () => void
  onSeleccionarKey: () => void
  onSeleccionarCarpetaEmitidos: () => void
  onSeleccionarCarpetaRecibidos: () => void
  mostrarNombre?: boolean
  mostrarRfc?: boolean
  onMoverSlot?: (tipo: 'emitidos' | 'recibidos', desde: number, hasta: number) => void
  onToggleSlot?: (tipo: 'emitidos' | 'recibidos', id: string, activo: boolean) => void
}

const ContribuyenteForm = ({
  data, onChange,
  onSeleccionarCer, onSeleccionarKey,
  onSeleccionarCarpetaEmitidos, onSeleccionarCarpetaRecibidos,
  mostrarNombre = false, mostrarRfc = true,
  onMoverSlot, onToggleSlot
}: Props) => {

  const moverSlot = (tipo: 'emitidos' | 'recibidos', desde: number, hasta: number) => {
    onMoverSlot?.(tipo, desde, hasta)
  }

  const toggleSlot = (tipo: 'emitidos' | 'recibidos', id: string, activo: boolean) => {
    onToggleSlot?.(tipo, id, activo)
  }

  const previewNombre = () => {
    const partes: string[] = []
    if (data.configNombreArchivo?.rfcEmisor)   partes.push('RFC_EMISOR')
    if (data.configNombreArchivo?.rfcReceptor) partes.push('RFC_RECEPTOR')
    partes.push('UUID')
    return partes.join('_') + '.pdf'
  }

  const renderEstructura = (tipo: 'emitidos' | 'recibidos', slots: SlotCarpeta[]) => (
    <div className="cf-estructura-lista">
      {slots.map((slot, index) => (
        <div key={slot.id} className={`cf-estructura-slot ${!slot.activo ? 'cf-estructura-slot--inactivo' : ''}`}>
          <span className="cf-estructura-drag"><HolderOutlined /></span>
          <Switch
            size="small"
            checked={slot.activo}
            onChange={(checked) => toggleSlot(tipo, slot.id, checked)}
          />
          <span className="cf-estructura-label">{slot.label}</span>
          <div className="cf-estructura-acciones">
            <Button type="text" size="small" disabled={index === 0}
              onClick={() => moverSlot(tipo, index, index - 1)}>↑</Button>
            <Button type="text" size="small" disabled={index === slots.length - 1}
              onClick={() => moverSlot(tipo, index, index + 1)}>↓</Button>
          </div>
        </div>
      ))}
    </div>
  )

  const tabAcceso = (
    <Form layout="vertical">
      {mostrarRfc && (
        <Form.Item label="RFC" required>
          <Input
            value={data.rfc}
            onChange={(e) => onChange('rfc', e.target.value.toUpperCase())}
            placeholder="Ej. XAXX010101000"
            maxLength={13}
          />
        </Form.Item>
      )}

      {mostrarNombre && (
        <Form.Item label="Nombre / Razón social" required>
          <Input
            value={data.nombre}
            onChange={(e) => onChange('nombre', e.target.value.toUpperCase())}
            placeholder="Nombre del contribuyente"
          />
        </Form.Item>
      )}

      <Form.Item label="Método de autenticación">
        <Radio.Group value={data.metodoAuth} onChange={(e) => onChange('metodoAuth', e.target.value)}>
          <Radio value="contrasena">RFC + Contraseña</Radio>
          <Radio value="efirma">e.firma (FIEL)</Radio>
        </Radio.Group>
        {data.metodoAuth === 'contrasena' && (
          <Alert style={{ marginTop: 12 }} type="info" showIcon
            message="Al usar RFC + Contraseña se solicitará un captcha cada vez que descargues facturas." />
        )}
        {data.metodoAuth === 'efirma' && (
          <Alert style={{ marginTop: 12 }} type="success" showIcon
            message="Con e.firma no se requiere captcha. Las descargas son más rápidas y sin interrupciones." />
        )}
      </Form.Item>

      {data.metodoAuth === 'contrasena' && (
        <Form.Item label="Contraseña del SAT" required>
          <Input.Password
            value={data.contrasena}
            onChange={(e) => onChange('contrasena', e.target.value)}
            placeholder="Contraseña del portal del SAT"
          />
        </Form.Item>
      )}

      {data.metodoAuth === 'efirma' && (
        <>
          <Form.Item label="Archivo .cer" required>
            <Space.Compact style={{ width: '100%' }}>
              <Input value={data.rutaCer} placeholder="Selecciona tu archivo .cer" readOnly />
              <Button icon={<FolderOpenOutlined />} onClick={onSeleccionarCer}>Buscar</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="Archivo .key" required>
            <Space.Compact style={{ width: '100%' }}>
              <Input value={data.rutaKey} placeholder="Selecciona tu archivo .key" readOnly />
              <Button icon={<FolderOpenOutlined />} onClick={onSeleccionarKey}>Buscar</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="Contraseña de la e.firma" required>
            <Input.Password
              value={data.contrasenaFiel}
              onChange={(e) => onChange('contrasenaFiel', e.target.value)}
              placeholder="Contraseña de tu e.firma"
            />
          </Form.Item>
        </>
      )}
    </Form>
  )

  const tabCarpetas = (
    <div className="cf-carpetas-grid">
      {/* Emitidos */}
      <div className="cf-carpeta-seccion">
        <Text strong>Emitidos</Text>
        <div className="cf-carpeta-ruta">
          <Input value={data.carpetaEmitidos || ''} readOnly placeholder="Sin carpeta seleccionada" />
          <Button icon={<FolderOpenOutlined />} onClick={onSeleccionarCarpetaEmitidos}>Seleccionar</Button>
        </div>
        <Text type="secondary" className="cf-sublabel">Subcarpetas (arrastra para reordenar)</Text>
        {renderEstructura('emitidos', data.estructuraEmitidos || [])}
      </div>

      {/* Recibidos */}
      <div className="cf-carpeta-seccion">
        <Text strong>Recibidos</Text>
        <div className="cf-carpeta-ruta">
          <Input value={data.carpetaRecibidos || ''} readOnly placeholder="Sin carpeta seleccionada" />
          <Button icon={<FolderOpenOutlined />} onClick={onSeleccionarCarpetaRecibidos}>Seleccionar</Button>
        </div>
        <Text type="secondary" className="cf-sublabel">Subcarpetas (arrastra para reordenar)</Text>
        {renderEstructura('recibidos', data.estructuraRecibidos || [])}
      </div>
    </div>
  )

  const tabPdf = (
    <div className="cf-pdf">
      <Form layout="vertical">
        <Form.Item label="Plantilla por defecto">
          <div className="cf-plantilla-lista">
            {PLANTILLAS.map((p) => (
              <div
                key={p.id}
                className={`cf-plantilla-opcion ${(data.plantillaDefault || 'clasica') === p.id ? 'cf-plantilla-opcion--activa' : ''}`}
                onClick={() => onChange('plantillaDefault', p.id)}
              >
                <Radio checked={(data.plantillaDefault || 'clasica') === p.id} onChange={() => onChange('plantillaDefault', p.id)}>
                  <strong>{p.nombre}</strong>
                  <span className="cf-plantilla-desc">{p.descripcion}</span>
                </Radio>
              </div>
            ))}
          </div>
        </Form.Item>

        <Form.Item label="Nombre del archivo PDF/XML">
          <p className="cf-hint">El UUID siempre se incluye. Activa los segmentos adicionales:</p>
          <div className="cf-nombre-opciones">
            <div className="cf-nombre-opcion">
              <Switch
                checked={data.configNombreArchivo?.rfcEmisor ?? true}
                onChange={(v) => onChange('configNombreArchivo', { ...data.configNombreArchivo, rfcEmisor: v })}
              />
              <span>RFC Emisor</span>
            </div>
            <div className="cf-nombre-opcion">
              <Switch
                checked={data.configNombreArchivo?.rfcReceptor ?? false}
                onChange={(v) => onChange('configNombreArchivo', { ...data.configNombreArchivo, rfcReceptor: v })}
              />
              <span>RFC Receptor</span>
            </div>
          </div>
          <div className="cf-nombre-preview">
            <Text type="secondary">Vista previa: </Text>
            <Text code>{previewNombre()}</Text>
          </div>
        </Form.Item>
      </Form>
    </div>
  )

  return (
    <Tabs
      items={[
        { key: 'acceso',   label: 'Acceso',   children: tabAcceso },
        { key: 'carpetas', label: 'Carpetas', children: tabCarpetas },
        { key: 'pdf',      label: 'PDF',      children: tabPdf }
      ]}
    />
  )
}

export default ContribuyenteForm