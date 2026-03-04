import { Modal, Descriptions, Tag, Table, Divider, Spin } from 'antd'
import { useState, useEffect } from 'react'
import { Factura } from '../../../../main/database/repositories/FacturaRepository'
import { parsearXml, FacturaParseada } from '../../utils/xmlParser'
import { regimenFiscal, usoCFDI, formaPago, metodoPago, impuesto, tipoPercepcion, tipoDeduccion, cat } from '../../utils/catalogosSat'

const tipoColor: Record<string, string> = {
  I: 'green', E: 'red', T: 'blue', N: 'purple', P: 'orange'
}
const tipoLabel: Record<string, string> = {
  I: 'Ingreso', E: 'Egreso', T: 'Traslado', N: 'Nómina', P: 'Pago'
}

const fmt = (n: number) => n?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

interface Props {
  factura: Factura | null
  visible: boolean
  onCerrar: () => void
}

const FacturaDetalleModal = ({ factura, visible, onCerrar }: Props): JSX.Element => {
  const [parseada, setParseada] = useState<FacturaParseada | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (visible && factura?.xml) {
      cargarXml()
    } else {
      setParseada(null)
    }
  }, [visible, factura])

  const cargarXml = async () => {
    setCargando(true)
    try {
      const res = await window.api.leerXml(factura!.xml)
      if (res.success && res.contenido) {
        setParseada(parsearXml(res.contenido))
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <Modal
      title="Detalle de Factura"
      open={visible}
      onCancel={onCerrar}
      footer={null}
      width={800}
      style={{ top: 20 }}
      styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
    >
      {cargando && <Spin style={{ display: 'block', textAlign: 'center', padding: 40 }} />}

      {!cargando && parseada && (
        <>
          {/* Datos generales */}
          <Divider orientation="left">Datos Generales</Divider>
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

          {/* Emisor */}
          <Divider orientation="left">Emisor</Divider>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="RFC">{parseada.rfcEmisor}</Descriptions.Item>
            <Descriptions.Item label="Nombre">{parseada.nombreEmisor}</Descriptions.Item>
            <Descriptions.Item label="Régimen Fiscal">{cat(regimenFiscal, parseada.regimenFiscal)}</Descriptions.Item>
          </Descriptions>

          {/* Receptor */}
          <Divider orientation="left">Receptor</Divider>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="RFC">{parseada.rfcReceptor}</Descriptions.Item>
            <Descriptions.Item label="Nombre">{parseada.nombreReceptor}</Descriptions.Item>
            <Descriptions.Item label="Uso CFDI">{cat(usoCFDI, parseada.usoCFDI)}</Descriptions.Item>
          </Descriptions>

          {/* Conceptos */}
          <Divider orientation="left">Conceptos</Divider>
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

          {/* Impuestos */}
          {parseada.impuestos.length > 0 && (
            <>
              <Divider orientation="left">Impuestos</Divider>
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

          {/* Totales */}
          <Divider orientation="left">Totales</Divider>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Subtotal">{fmt(parseada.subtotal)}</Descriptions.Item>
            {parseada.descuento ? <Descriptions.Item label="Descuento">{fmt(parseada.descuento)}</Descriptions.Item> : null}
            {parseada.totalImpuestosTrasladados ? <Descriptions.Item label="IVA Trasladado">{fmt(parseada.totalImpuestosTrasladados)}</Descriptions.Item> : null}
            {parseada.totalImpuestosRetenidos ? <Descriptions.Item label="Impuestos Retenidos">{fmt(parseada.totalImpuestosRetenidos)}</Descriptions.Item> : null}
            <Descriptions.Item label="Total" span={2}><strong>{fmt(parseada.total)}</strong></Descriptions.Item>
          </Descriptions>

          {/* Complemento Nómina */}
          {parseada.complementoNomina && (
            <>
              <Divider orientation="left">Complemento Nómina</Divider>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Tipo Nómina">{parseada.complementoNomina.tipoNomina === 'O' ? 'Ordinaria' : 'Extraordinaria'}</Descriptions.Item>
                <Descriptions.Item label="Fecha Pago">{parseada.complementoNomina.fechaPago}</Descriptions.Item>
                <Descriptions.Item label="Período">{parseada.complementoNomina.fechaInicialPago} - {parseada.complementoNomina.fechaFinalPago}</Descriptions.Item>
                <Descriptions.Item label="Días Pagados">{parseada.complementoNomina.numDiasPagados}</Descriptions.Item>
                <Descriptions.Item label="Total Percepciones">{fmt(parseada.complementoNomina.totalPercepciones)}</Descriptions.Item>
                <Descriptions.Item label="Total Deducciones">{fmt(parseada.complementoNomina.totalDeducciones)}</Descriptions.Item>
                {parseada.complementoNomina.totalOtrosPagos > 0 && (
                  <Descriptions.Item label="Otros Pagos">{fmt(parseada.complementoNomina.totalOtrosPagos)}</Descriptions.Item>
                )}
              </Descriptions>

              {parseada.complementoNomina.percepciones.length > 0 && (
                <>
                  <Divider orientation="left" plain>Percepciones</Divider>
                  <Table
                    dataSource={parseada.complementoNomina.percepciones}
                    rowKey={(_, i) => String(i)}
                    size="small"
                    pagination={false}
                    columns={[
                      { title: 'Clave', dataIndex: 'clave', width: 70 },
                      { title: 'Concepto', dataIndex: 'concepto', ellipsis: true },
                      { title: 'Gravado', dataIndex: 'importeGravado', align: 'right', render: fmt },
                      { title: 'Exento', dataIndex: 'importeExento', align: 'right', render: fmt }
                    ]}
                  />
                </>
              )}

              {parseada.complementoNomina.deducciones.length > 0 && (
                <>
                  <Divider orientation="left" plain>Deducciones</Divider>
                  <Table
                    dataSource={parseada.complementoNomina.deducciones}
                    rowKey={(_, i) => String(i)}
                    size="small"
                    pagination={false}
                    columns={[
                      { title: 'Clave', dataIndex: 'clave', width: 70 },
                      { title: 'Concepto', dataIndex: 'concepto', ellipsis: true },
                      { title: 'Importe', dataIndex: 'importe', align: 'right', render: fmt }
                    ]}
                  />
                </>
              )}
            </>
          )}

          {/* Complemento Pagos */}
          {parseada.complementoPago && (
            <>
              <Divider orientation="left">Complemento Pagos</Divider>
              {parseada.complementoPago.pagos.map((pago, i) => (
                <div key={i}>
                  <Descriptions bordered column={2} size="small" style={{ marginBottom: 8 }}>
                    <Descriptions.Item label="Fecha Pago">{pago.fechaPago}</Descriptions.Item>
                    <Descriptions.Item label="Forma de Pago">{pago.formaDePago}</Descriptions.Item>
                    <Descriptions.Item label="Moneda">{pago.moneda}</Descriptions.Item>
                    <Descriptions.Item label="Monto">{fmt(pago.monto)}</Descriptions.Item>
                  </Descriptions>
                  {pago.doctoRelacionados.length > 0 && (
                    <Table
                      dataSource={pago.doctoRelacionados}
                      rowKey={(_, i) => String(i)}
                      size="small"
                      pagination={false}
                      columns={[
                        { title: 'UUID Relacionado', dataIndex: 'uuid', ellipsis: true },
                        { title: 'Saldo Anterior', dataIndex: 'impSaldoAnt', align: 'right', render: fmt },
                        { title: 'Importe Pagado', dataIndex: 'impPagado', align: 'right', render: fmt }
                      ]}
                    />
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {!cargando && !parseada && factura && (
        <p style={{ textAlign: 'center', color: '#999' }}>No se pudo cargar el XML</p>
      )}
    </Modal>
  )
}

export default FacturaDetalleModal