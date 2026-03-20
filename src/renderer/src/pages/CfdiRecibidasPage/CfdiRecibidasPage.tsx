import { Tabs } from 'antd'
import FacturasListadoBase from '../../components/FacturasListadoBase/FacturasListadoBase'
import PagoDocumentosPanel from '../../components/PagoDocumentosPanel/PagoDocumentosPanel'
import { columnasRecibidas } from '../../utils/columnasFacturas'
import { columnasPagosRecibidos } from '../../utils/columnasPagos'
import { columnasNominaRecibida } from '../../utils/columnasNomina'
import PageHeader from '../../components/PageHeader/PageHeader'
import type { FacturaDto } from '../../types/FacturaDto'
import './CfdiRecibidasPage.css'

const CfdiRecibidasPage = () => (
  <div className="cfdi-recibidas-container">
    <PageHeader title="Recibidos" subtitle="CFDIs de proveedores y empleadores" backTo="/cfdi" />
    <Tabs
      className="cfdi-recibidas-tabs"
      items={[
        {
          key: 'facturas',
          label: 'Facturas',
          children: (
            <FacturasListadoBase
              tipoDescarga="recibida"
              titulo="Facturas Recibidas"
              buildColumnas={columnasRecibidas}
              tiposComprobante={['I', 'E', 'T']}
              mostrarEfecto
            />
          )
        },
        {
          key: 'pagos',
          label: 'Pagos',
          children: (
            <FacturasListadoBase
              tipoDescarga="recibida"
              titulo="Pagos Recibidos"
              buildColumnas={columnasPagosRecibidos}
              tiposComprobante={['P']}
              renderExpanded={(record: FacturaDto) => <PagoDocumentosPanel factura={record} />}
            />
          )
        },
        {
          key: 'nomina',
          label: 'Nómina',
          children: (
            <FacturasListadoBase
              tipoDescarga="recibida"
              titulo="Nómina Recibida"
              buildColumnas={columnasNominaRecibida}
              tiposComprobante={['N']}
            />
          )
        }
      ]}
    />
  </div>
)

export default CfdiRecibidasPage
