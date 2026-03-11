import { Descriptions, Tag, Table, Divider } from 'antd'
import { Factura } from '../../../../main/database/repositories/FacturaRepository'
import { FacturaParseada } from '../../utils/xmlParser'
import { regimenFiscal, usoCFDI, formaPago, metodoPago, impuesto, cat } from '../../utils/catalogosSat'

const tipoColor: Record<string, string> = {
  I: 'green', E: 'red', T: 'blue', N: 'purple', P: 'orange'
}
const tipoLabel: Record<string, string> = {
  I: 'Ingreso', E: 'Egreso', T: 'Traslado', N: 'Nómina', P: 'Pago'
}
const fmt = (n: number) => n?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

interface Props {
  factura: Factura | null
  parseada: FacturaParseada
}

const FacturaDetalleInfo = ({ factura, parseada }: Props) => (
  <>
    <Divider titlePlacement="start">Datos Generales</Divider>
    <Descriptions bordered column={2} size="small">
      <Descriptions.Item label="UUID" span={2}>{factura?.uuid}</Descriptions.Item>
      {parseada.serie && <Descriptions.Item label="Serie">{parseada.serie}</Descriptions.Item>}
      {parseada.folio && <Descriptions.Item label="Folio">{parseada.folio}</Descriptions.Item>}
      <Descriptions.Item label="Fecha">{parseada.fecha?.replace('T', ' ')}</Descriptions.Item>
      <Descriptions.Item label="Lugar Expedición">{parseada.lugarExpedicion}</Descriptions.Item>
      {parseada.formaPago && <Descriptions.Item label="Forma Pago">{cat(formaPago, parseada.formaPago)}</Descriptions.Item>}
      {parseada.metodoPago && <Descriptions.Item label="Método Pago">{cat(metodoPago, parseada.metodoPago)}</Descriptions.Item>}
      <Descriptions.Item label="Moneda">{parseada.moneda}</Descriptions.Item>
      <Descriptions.Item label="Tipo">
        <Tag color={tipoColor[factura?.tipo_comprobante || 'I']}>
          {tipoLabel[factura?.tipo_comprobante || 'I']}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="Estado">
        <Tag color={factura?.estado === 'vigente' ? 'green' : 'red'}>
          {factura?.estado?.charAt(0).toUpperCase() + factura?.estado?.slice(1)!}
        </Tag>
      </Descriptions.Item>
    </Descriptions>

    <Divider titlePlacement="start">Emisor</Divider>
    <Descriptions bordered column={2} size="small">
      <Descriptions.Item label="RFC">{parseada.rfcEmisor}</Descriptions.Item>
      <Descriptions.Item label="Nombre">{parseada.nombreEmisor}</Descriptions.Item>
      <Descriptions.Item label="Régimen Fiscal">{cat(regimenFiscal, parseada.regimenFiscal)}</Descriptions.Item>
    </Descriptions>

    <Divider titlePlacement="start">Receptor</Divider>
    <Descriptions bordered column={2} size="small">
      <Descriptions.Item label="RFC">{parseada.rfcReceptor}</Descriptions.Item>
      <Descriptions.Item label="Nombre">{parseada.nombreReceptor}</Descriptions.Item>
      <Descriptions.Item label="Uso CFDI">{cat(usoCFDI, parseada.usoCFDI)}</Descriptions.Item>
    </Descriptions>

    <Divider titlePlacement="start">Conceptos</Divider>
    <Table
      dataSource={parseada.conceptos}
      rowKey={(_, i) => String(i)}
      size="small"
      pagination={false}
      columns={[
        { title: 'Clave', dataIndex: 'claveProdServ', width: 90 },
        { title: 'Descripción', dataIndex: 'descripcion', ellipsis: true },
        { title: 'Cantidad', dataIndex: 'cantidad', width: 80, align: 'right' },
        { title: 'Unidad', dataIndex: 'claveUnidad', width: 70 },
        { title: 'Precio Unit.', dataIndex: 'valorUnitario', width: 110, align: 'right', render: fmt },
        { title: 'Importe', dataIndex: 'importe', width: 110, align: 'right', render: fmt }
      ]}
    />

    {parseada.impuestos.length > 0 && (
      <>
        <Divider titlePlacement="start">Impuestos</Divider>
        <Table
          dataSource={parseada.impuestos}
          rowKey={(_, i) => String(i)}
          size="small"
          pagination={false}
          columns={[
            { title: 'Tipo', dataIndex: 'tipo', width: 100, render: (t) => t === 'traslado' ? 'Traslado' : 'Retención' },
            { title: 'Impuesto', dataIndex: 'impuesto', width: 90, render: (i: string) => cat(impuesto, i) },
            { title: 'Tasa', dataIndex: 'tasa', width: 80, render: (t) => t ? `${(t * 100).toFixed(0)}%` : '-' },
            { title: 'Importe', dataIndex: 'importe', align: 'right', render: fmt }
          ]}
        />
      </>
    )}

    <Divider titlePlacement="start">Totales</Divider>
    <Descriptions bordered column={2} size="small">
      <Descriptions.Item label="Subtotal">{fmt(parseada.subtotal)}</Descriptions.Item>
      {parseada.descuento ? <Descriptions.Item label="Descuento">{fmt(parseada.descuento)}</Descriptions.Item> : null}
      {parseada.totalImpuestosTrasladados ? <Descriptions.Item label="IVA Trasladado">{fmt(parseada.totalImpuestosTrasladados)}</Descriptions.Item> : null}
      {parseada.totalImpuestosRetenidos ? <Descriptions.Item label="Impuestos Retenidos">{fmt(parseada.totalImpuestosRetenidos)}</Descriptions.Item> : null}
      <Descriptions.Item label="Total" span={2}><strong>{fmt(parseada.total)}</strong></Descriptions.Item>
    </Descriptions>

    {parseada.complementoNomina && (
      <>
        <Divider titlePlacement="start">Complemento Nómina</Divider>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Tipo Nómina">{parseada.complementoNomina.tipoNomina === 'O' ? 'Ordinaria' : 'Extraordinaria'}</Descriptions.Item>
          <Descriptions.Item label="Fecha Pago">{parseada.complementoNomina.fechaPago}</Descriptions.Item>
          <Descriptions.Item label="Período">{parseada.complementoNomina.fechaInicialPago} - {parseada.complementoNomina.fechaFinalPago}</Descriptions.Item>
          <Descriptions.Item label="Días Pagados">{parseada.complementoNomina.numDiasPagados}</Descriptions.Item>
          <Descriptions.Item label="Total Percepciones">{fmt(parseada.complementoNomina.totalPercepciones)}</Descriptions.Item>
          <Descriptions.Item label="Total Deducciones">{fmt(parseada.complementoNomina.totalDeducciones)}</Descriptions.Item>
        </Descriptions>
      </>
    )}

    {parseada.complementoPago && (
      <>
        <Divider titlePlacement="start">Complemento Pagos</Divider>
        {parseada.complementoPago.pagos.map((pago, i) => (
          <div key={i}>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 8 }}>
              <Descriptions.Item label="Fecha Pago">{pago.fechaPago}</Descriptions.Item>
              <Descriptions.Item label="Forma de Pago">{pago.formaDePago}</Descriptions.Item>
              <Descriptions.Item label="Moneda">{pago.moneda}</Descriptions.Item>
              <Descriptions.Item label="Monto">{fmt(pago.monto)}</Descriptions.Item>
            </Descriptions>
          </div>
        ))}
      </>
    )}
  </>
)

export default FacturaDetalleInfo