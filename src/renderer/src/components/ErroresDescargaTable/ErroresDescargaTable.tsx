import { Card, Table, Tag } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import { JSX } from 'react'

interface ErrorDescarga {
  uuid: string
  error: string
}

interface Props {
  errores: ErrorDescarga[]
}

const ErroresDescargaTable = ({ errores }: Props): JSX.Element | null => {
  if (errores.length === 0) return null

  return (
    <Card
      title={<span><WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />Facturas que fallaron ({errores.length})</span>}
      style={{ marginTop: 16 }}
    >
      <Table
        dataSource={errores}
        rowKey="uuid"
        size="small"
        pagination={false}
        columns={[
          { title: 'UUID', dataIndex: 'uuid', ellipsis: true },
          {
            title: 'Error',
            dataIndex: 'error',
            ellipsis: true,
            render: (e: string) => <Tag color="red">{e}</Tag>
          }
        ]}
      />
    </Card>
  )
}

export default ErroresDescargaTable