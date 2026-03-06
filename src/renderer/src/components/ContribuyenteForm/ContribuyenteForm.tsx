import { Form, Input, Button, Radio, Alert, Space } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'

export interface ContribuyenteFormData {
  rfc: string
  nombre?: string
  metodoAuth: 'contrasena' | 'efirma'
  contrasena?: string
  rutaCer?: string
  rutaKey?: string
  contrasenaFiel?: string
  carpetaDescarga?: string
}

interface Props {
  data: ContribuyenteFormData
  onChange: (campo: string, valor: string) => void
  onSeleccionarCer: () => void
  onSeleccionarKey: () => void
  onSeleccionarCarpeta: () => void
  mostrarNombre?: boolean
  mostrarRfc?: boolean
}

const ContribuyenteForm = ({
  data, onChange, onSeleccionarCer, onSeleccionarKey,
  onSeleccionarCarpeta, mostrarNombre = false, mostrarRfc = true
}: Props) => {
  return (
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

      <Form.Item label="Carpeta de descarga de XMLs">
        <Space.Compact style={{ width: '100%' }}>
          <Input value={data.carpetaDescarga} placeholder="Carpeta donde se guardarán los XMLs" readOnly />
          <Button icon={<FolderOpenOutlined />} onClick={onSeleccionarCarpeta}>Buscar</Button>
        </Space.Compact>
      </Form.Item>
    </Form>
  )
}

export default ContribuyenteForm