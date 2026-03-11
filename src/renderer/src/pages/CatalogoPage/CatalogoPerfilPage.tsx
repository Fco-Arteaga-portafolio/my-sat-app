import { Input, Button, Card, Alert, Tabs } from 'antd'
import { ArrowLeftOutlined, SaveOutlined, ContactsOutlined, FileTextOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useCatalogoPerfilPage } from './CatalogoPerfilPage.hook'
import { TipoCatalogo } from './CatalogoPage.hook'
import DrillDownCFDI from '../../components/DrillDownCFDI/DrillDownCFDI'
import './CatalogoPerfilPage.css'

const formatMXN = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)

interface Props {
  tipo: TipoCatalogo
}

const CatalogoPerfilPage = ({ tipo }: Props) => {
  const navigate = useNavigate()
  const { datos, form, cargando, guardado, cambiarCampo, guardar } = useCatalogoPerfilPage(tipo)

  if (!datos) return null

  const esEmpleadoOPatron = tipo === 'empleados' || tipo === 'patrones'




  const tabContacto = (
    <div>
      {guardado && <Alert message="Cambios guardados" type="success" showIcon className="perfil-alert" />}
      <div className="perfil-grid">
        <div className="perfil-field">
          <label>Teléfono</label>
          <Input value={form.telefono || ''} onChange={e => cambiarCampo('telefono', e.target.value)} placeholder="Teléfono" />
        </div>
        <div className="perfil-field">
          <label>Contacto</label>
          <Input value={form.contacto || ''} onChange={e => cambiarCampo('contacto', e.target.value)} placeholder="Nombre del representante" />
        </div>
        <div className="perfil-field">
          <label>Notas</label>
          <Input.TextArea value={form.notas || ''} onChange={e => cambiarCampo('notas', e.target.value)} placeholder="Notas internas" rows={4} />
        </div>
        <div className="perfil-field">
          <label>Email</label>
          <Input value={form.email || ''} onChange={e => cambiarCampo('email', e.target.value)} placeholder="Email" />
        </div>
        {!esEmpleadoOPatron && (
          <div className="perfil-field">
            <label>Días de crédito</label>
            <Input value={form.dias_credito || ''} onChange={e => cambiarCampo('dias_credito', e.target.value)} placeholder="Días" type="number" />
          </div>
        )}
        {tipo === 'empleados' && (
          <>
            <div className="perfil-field">
              <label>Puesto</label>
              <Input value={form.puesto || ''} onChange={e => cambiarCampo('puesto', e.target.value)} placeholder="Puesto" />
            </div>
            <div className="perfil-field">
              <label>Fecha de ingreso</label>
              <Input value={form.fecha_ingreso || ''} onChange={e => cambiarCampo('fecha_ingreso', e.target.value)} type="date" />
            </div>
          </>
        )}
        <div className="perfil-field">
          <label>Dirección</label>
          <Input value={form.direccion || ''} onChange={e => cambiarCampo('direccion', e.target.value)} placeholder="Dirección" />
        </div>
      </div>
      <div className="perfil-save-btn">
        <Button type="primary" icon={<SaveOutlined />} loading={cargando} onClick={guardar}>
          Guardar cambios
        </Button>
      </div>
    </div>
  )

  const tabVisor = (
    <DrillDownCFDI rfc={datos.rfc} tipo={tipo as 'clientes' | 'proveedores'} />
  )

  const tabs = [
    {
      key: 'contacto',
      label: <span><ContactsOutlined /> Datos de contacto</span>,
      children: tabContacto
    }
  ]

  if (tipo === 'clientes' || tipo === 'proveedores') {
    tabs.push({
      key: 'visor',
      label: <span><FileTextOutlined /> Visor de documentos</span>,
      children: tabVisor
    })
  }

  return (
    <div className="perfil-container">
      <Button
        icon={<ArrowLeftOutlined />}
        type="link"
        className="perfil-back-btn"
        onClick={() => navigate(`/${tipo}`)}
      >
        Volver a {tipo}
      </Button>

      <div className="perfil-header">
        <div>
          <div className="perfil-header-nombre">{datos.nombre || datos.rfc}</div>
          <div className="perfil-header-rfc">{datos.rfc}</div>
        </div>
        <div>
          <div className="perfil-header-total">{formatMXN(datos.total_facturado || 0)}</div>
          <div className="perfil-header-facturas">{datos.total_facturas || 0} facturas</div>
        </div>
      </div>

     <Tabs className="perfil-tabs" items={tabs} />
    </div>
  )
}

export default CatalogoPerfilPage