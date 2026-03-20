import { Tabs } from 'antd'
import FacturasListadoBase from '../../components/FacturasListadoBase/FacturasListadoBase'
import PagoDocumentosPanel from '../../components/PagoDocumentosPanel/PagoDocumentosPanel'
import { columnasEmitidas } from '../../utils/columnasFacturas'
import { columnasPagosEmitidos } from '../../utils/columnasPagos'
import { columnasNominaEmitida } from '../../utils/columnasNomina'
import PageHeader from '../../components/PageHeader/PageHeader'
import type { FacturaDto } from '../../types/FacturaDto'
import './CfdiEmitidasPage.css'

const CfdiEmitidasPage = () => (
  <div className="cfdi-emitidas-container">
    <PageHeader title="Emitidos" subtitle="CFDIs expedidos a tus clientes" backTo="/cfdi" />
    <Tabs
      className="cfdi-emitidas-tabs"
      items={[
        {
          key: 'facturas',
          label: 'Facturas',
          children: (
            <FacturasListadoBase
              tipoDescarga="emitida"
              titulo="Facturas Emitidas"
              buildColumnas={columnasEmitidas}
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
              tipoDescarga="emitida"
              titulo="Pagos Emitidos"
              buildColumnas={columnasPagosEmitidos}
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
              tipoDescarga="emitida"
              titulo="Nómina Emitida"
              buildColumnas={columnasNominaEmitida}
              tiposComprobante={['N']}
            />
          )
        }
      ]}
    />
  </div>
)

export default CfdiEmitidasPage
