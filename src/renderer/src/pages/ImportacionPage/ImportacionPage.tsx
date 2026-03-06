import { Button, Alert, Table, Tag, Space } from 'antd'
import { FolderOpenOutlined, FileAddOutlined, ImportOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useImportacionPage } from './ImportacionPage.hook'

const ImportacionPage = () => {
  const {
    rutasSeleccionadas, importando, resultado, error,
    seleccionarArchivos, seleccionarCarpeta, eliminarRuta, limpiar, importar
  } = useImportacionPage()

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Importar XMLs</h2>
          <p style={{ color: '#8c9db5', margin: '4px 0 0', fontSize: 13 }}>
            Importa facturas desde archivos XML almacenados en tu equipo
          </p>
        </div>
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

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      {/* Resultado */}
      {resultado && (
        <Alert
          style={{ marginBottom: 16 }}
          type={resultado.errores.length > 0 ? 'warning' : 'success'}
          showIcon
          icon={<CheckCircleOutlined />}
          message={
            <span>
              <strong>{resultado.importadas}</strong> facturas importadas ·{' '}
              <strong>{resultado.omitidas}</strong> omitidas (ya existían)
              {resultado.errores.length > 0 && (
                <> · <strong style={{ color: '#ff4d4f' }}>{resultado.errores.length}</strong> con errores</>
              )}
            </span>
          }
        />
      )}

      {/* Errores de importación */}
      {resultado && resultado.errores.length > 0 && (
        <Table
          style={{ marginBottom: 16 }}
          size="small"
          dataSource={resultado.errores}
          rowKey="archivo"
          pagination={false}
          columns={[
            { title: 'Archivo', dataIndex: 'archivo', key: 'archivo' },
            { title: 'Error', dataIndex: 'error', key: 'error', render: (e: string) => <Tag color="red">{e}</Tag> }
          ]}
        />
      )}

      {/* Lista de archivos seleccionados */}
      {rutasSeleccionadas.length > 0 && (
        <Table
          size="small"
          dataSource={rutasSeleccionadas.map(r => ({ ruta: r, nombre: r.split(/[\\/]/).pop() || r }))}
          rowKey="ruta"
          pagination={{ pageSize: 20, showTotal: (t) => `${t} archivos` }}
          columns={[
            {
              title: `${rutasSeleccionadas.length} archivos seleccionados`,
              dataIndex: 'nombre',
              key: 'nombre',
              render: (nombre: string) => (
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{nombre}</span>
              )
            },
            {
              title: '', key: 'acciones', width: 60,
              render: (_: any, record: any) => (
                <Button
                  danger size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => eliminarRuta(record.ruta)}
                />
              )
            }
          ]}
        />
      )}

      {rutasSeleccionadas.length === 0 && !resultado && (
        <div style={{
          textAlign: 'center', padding: 60,
          background: '#fff', borderRadius: 8,
          border: '2px dashed #e8ecf0', color: '#8c9db5'
        }}>
          <FileAddOutlined style={{ fontSize: 40, marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>Selecciona archivos XML o una carpeta para importar</p>
        </div>
      )}
    </div>
  )
}

export default ImportacionPage