import { Table } from 'antd'
import type { FacturaDto } from '../../types/FacturaDto'
import type { DoctoRelacionadoDto } from '../../types/PagoComplementoDto'
import './PagoDocumentosPanel.css'

const fmt = (n: number | undefined | null) =>
  (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

interface Props {
  factura: FacturaDto
}

const columnas = [
  {
    title: 'UUID Documento',
    dataIndex: 'id_documento',
    key: 'id_documento',
    width: 120,
    render: (v: string) => (
      <span className="pago-doc-uuid" title={v}>
        {v?.substring(0, 8)}…
      </span>
    )
  },
  { title: 'Serie', dataIndex: 'serie', key: 'serie', width: 70, render: (v: string) => v || '—' },
  { title: 'Folio', dataIndex: 'folio', key: 'folio', width: 80, render: (v: string) => v || '—' },
  {
    title: 'Moneda',
    dataIndex: 'moneda_dr',
    key: 'moneda_dr',
    width: 80,
    render: (v: string) => v || '—'
  },
  {
    title: 'Método Pago',
    dataIndex: 'metodo_pago_dr',
    key: 'metodo_pago_dr',
    width: 100,
    render: (v: string) => v || '—'
  },
  {
    title: 'Parcialidad',
    dataIndex: 'num_parcialidad',
    key: 'num_parcialidad',
    width: 90,
    align: 'right' as const
  },
  {
    title: 'Saldo Anterior',
    dataIndex: 'imp_saldo_anterior',
    key: 'imp_saldo_anterior',
    width: 130,
    align: 'right' as const,
    render: fmt
  },
  {
    title: 'Importe Pagado',
    dataIndex: 'imp_pagado',
    key: 'imp_pagado',
    width: 130,
    align: 'right' as const,
    render: (n: number) => <strong className="pago-doc-pagado">{fmt(n)}</strong>
  },
  {
    title: 'Saldo Insoluto',
    dataIndex: 'imp_saldo_insoluto',
    key: 'imp_saldo_insoluto',
    width: 130,
    align: 'right' as const,
    render: (n: number) => <span className={n > 0 ? 'pago-doc-pendiente' : ''}>{fmt(n)}</span>
  }
]

const PagoDocumentosPanel = ({ factura }: Props) => {
  const documentos: DoctoRelacionadoDto[] = factura.documentos ? JSON.parse(factura.documentos) : []

  if (!documentos.length) return <div className="pago-doc-empty">Sin documentos relacionados</div>

  return (
    <div className="pago-doc-container">
      <span className="pago-doc-titulo">Documentos relacionados ({documentos.length})</span>
      <Table
        dataSource={documentos}
        columns={columnas}
        rowKey="id_documento"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default PagoDocumentosPanel
