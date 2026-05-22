import { Modal, Input, Alert, Checkbox } from 'antd'
import { useModalSoporte, TipoTicket } from './ModalSoporte.hook'
import './ModalSoporte.css'

const TIPOS: { key: TipoTicket; icono: string; label: string }[] = [
  { key: 'bug', icono: '🐛', label: 'Error / Bug' },
  { key: 'duda', icono: '❓', label: 'Duda de uso' },
  { key: 'licencia', icono: '🔑', label: 'Licencia' },
  { key: 'sugerencia', icono: '💡', label: 'Sugerencia' }
]

const ModalSoporte = ({ onClose }: { onClose: () => void }) => {
  const { form, loading, enviado, error, folioGenerado, cambiarCampo, enviar, cerrar } =
    useModalSoporte(onClose)

  return (
    <Modal
      title="🎧 Soporte Técnico"
      open
      onCancel={cerrar}
      onOk={enviado ? cerrar : enviar}
      okText={enviado ? 'Cerrar' : 'Enviar ticket'}
      cancelText="Cancelar"
      cancelButtonProps={{ style: { display: enviado ? 'none' : undefined } }}
      confirmLoading={loading}
      okButtonProps={{
        style: {
          background: enviado ? undefined : '#16a34a',
          borderColor: enviado ? undefined : '#16a34a'
        }
      }}
      width={500}
    >
      {enviado ? (
        <div className="soporte-exito">
          <div className="soporte-exito-icono">✅</div>
          <div className="soporte-exito-titulo">¡Ticket enviado!</div>
          <div className="soporte-exito-sub">Recibirás respuesta en tu correo en 24–48 hrs.</div>
          {folioGenerado && <div className="soporte-folio">Folio: {folioGenerado}</div>}
        </div>
      ) : (
        <>
          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

          <div className="soporte-tipos">
            {TIPOS.map((t) => (
              <button
                key={t.key}
                className={`soporte-tipo-btn${form.tipo === t.key ? ' activo' : ''}`}
                onClick={() => cambiarCampo('tipo', t.key)}
              >
                <span className="soporte-tipo-icono">{t.icono}</span>
                {t.label}
              </button>
            ))}
          </div>

          <Input
            placeholder="Asunto — describe brevemente el problema"
            value={form.asunto}
            onChange={(e) => cambiarCampo('asunto', e.target.value)}
            style={{ marginBottom: 12 }}
          />

          <Input.TextArea
            placeholder="¿Qué pasó? ¿En qué pantalla? ¿Qué esperabas que ocurriera?"
            value={form.descripcion}
            onChange={(e) => cambiarCampo('descripcion', e.target.value)}
            rows={4}
            style={{ marginBottom: 12 }}
          />

          <Input
            type="email"
            placeholder="Tu correo para recibir respuesta"
            value={form.email}
            onChange={(e) => cambiarCampo('email', e.target.value)}
            style={{ marginBottom: 12 }}
          />

          <Checkbox
            checked={form.adjuntarLogs}
            onChange={(e) => cambiarCampo('adjuntarLogs', e.target.checked)}
            style={{ marginBottom: 12 }}
          >
            📎 Adjuntar logs del sistema para diagnosticar mejor
          </Checkbox>
        </>
      )}
    </Modal>
  )
}

export default ModalSoporte
