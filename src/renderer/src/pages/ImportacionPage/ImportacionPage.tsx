import { Button, Alert, Table, Tag, Space } from 'antd'
import {
  FolderOpenOutlined,
  FileAddOutlined,
  ImportOutlined,
  DeleteOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { useImportacionPage } from './ImportacionPage.hook'
import PageHeader from '@renderer/components/PageHeader/PageHeader'
import './ImportacionPage.css'

const ImportacionPage = () => {
  const {
    rutasSeleccionadas,
    importando,
    resultado,
    error,
    seleccionarArchivos,
    seleccionarCarpeta,
    eliminarRuta,
    limpiar,
    importar
  } = useImportacionPage()

  return (
    <div className="importacion-container">
      <PageHeader
        title="Importar XMLs"
        subtitle="Importa facturas desde archivos XML almacenados en tu equipo"
        backTo="/cfdi"
      />

      <div className="importacion-acciones">
        <div />
        <Space>
          <Button icon={<FileAddOutlined />} onClick={seleccionarArchivos}>
            Seleccionar archivos
          </Button>
          <Button icon={<FolderOpenOutlined />} onClick={seleccionarCarpeta}>
            Seleccionar carpeta
          </Button>
          {rutasSeleccionadas.length > 0 && (
            <Button danger icon={<DeleteOutlined />} onClick={limpiar}>
              Limpiar
            </Button>
          )}
          <Button
            type="primary"
            icon={<ImportOutlined />}
            loading={importando}
            disabled={rutasSeleccionadas.length === 0}
            onClick={importar}
          >
            Importar {rutasSeleccionadas.length > 0 ? `(${rutasSeleccionadas.length})` : ''}
          </Button>
        </Space>
      </div>

      {error && <Alert message={error} type="error" showIcon className="importacion-alert" />}

      {resultado && (
        <Alert
          className="importacion-alert"
          type={resultado.errores.length > 0 ? 'warning' : 'success'}
          showIcon
          icon={<CheckCircleOutlined />}
          message={
            <span>
              <strong>{resultado.importadas}</strong> facturas importadas ·{' '}
              <strong>{resultado.omitidas}</strong> omitidas (ya existían)
              {resultado.errores.length > 0 && (
                <>
                  {' '}
                  ·{' '}
                  <strong className="importacion-errores-count">
                    {resultado.errores.length}
                  </strong>{' '}
                  con errores
                </>
              )}
            </span>
          }
        />
      )}

      {resultado && resultado.errores.length > 0 && (
        <Table
          className="importacion-alert"
          size="small"
          dataSource={resultado.errores}
          rowKey="archivo"
          pagination={false}
          columns={[
            { title: 'Archivo', dataIndex: 'archivo', key: 'archivo' },
            {
              title: 'Error',
              dataIndex: 'error',
              key: 'error',
              render: (e: string) => <Tag color="red">{e}</Tag>
            }
          ]}
        />
      )}

      {rutasSeleccionadas.length > 0 && (
        <Table
          size="small"
          dataSource={rutasSeleccionadas.map((r) => ({
            ruta: r,
            nombre: r.split(/[\\/]/).pop() || r
          }))}
          rowKey="ruta"
          pagination={{ pageSize: 20, showTotal: (t) => `${t} archivos` }}
          columns={[
            {
              title: `${rutasSeleccionadas.length} archivos seleccionados`,
              dataIndex: 'nombre',
              key: 'nombre',
              render: (nombre: string) => (
                <span className="importacion-nombre-archivo">{nombre}</span>
              )
            },
            {
              title: '',
              key: 'acciones',
              width: 60,
              render: (_: any, record: any) => (
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => eliminarRuta(record.ruta)}
                />
              )
            }
          ]}
        />
      )}

      {rutasSeleccionadas.length === 0 && !resultado && (
        <div className="importacion-empty">
          <FileAddOutlined className="importacion-empty-icon" />
          <p className="importacion-empty-text">
            Selecciona archivos XML o una carpeta para importar
          </p>
        </div>
      )}
    </div>
  )
}

export default ImportacionPage
