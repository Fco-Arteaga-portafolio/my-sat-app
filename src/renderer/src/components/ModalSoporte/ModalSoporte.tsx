import type { ReactElement } from 'react'
import { Modal, Input, Alert, Checkbox, Tabs, Tag, Empty, Spin, Collapse } from 'antd'
import { useModalSoporte } from './ModalSoporte.hook'
import './ModalSoporte.css'

const ETIQUETA_ESTADO: Record<string, { texto: string; color: string }> = {
  Enviado: { texto: 'Enviado', color: 'blue' },
  Visto: { texto: 'Visto por IFRAT', color: 'orange' },
  ConSeguimiento: { texto: 'Con seguimiento', color: 'green' },
  // Variantes por si algún día vienen en minúsculas.
  enviado: { texto: 'Enviado', color: 'blue' },
  visto: { texto: 'Visto por IFRAT', color: 'orange' },
  conseguimiento: { texto: 'Con seguimiento', color: 'green' }
}

const formatearFecha = (fecha?: string | null): string => {
  if (!fecha) return '—'
  try {
    return new Date(fecha).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return fecha
  }
}

/** Muestra un id corto como "No. de ticket" (el backend no usa folio). */
const idCorto = (id: string): string => `#${id.slice(0, 8)}`

const ModalSoporte = ({ onClose }: { onClose: () => void }): ReactElement => {
  const {
    form,
    pestana,
    cambiarPestana,
    loading,
    enviado,
    error,
    idTicket,
    estadoTicket,
    rutaGuardada,
    tickets,
    ticketsLoading,
    ticketsError,
    cambiarCampo,
    enviar,
    guardarEnArchivo,
    guardarSoloLogs,
    cargarTickets,
    cerrar
  } = useModalSoporte(onClose)

  const tagEstado = (estado: string): ReactElement => {
    const def = ETIQUETA_ESTADO[estado?.toLowerCase?.()] ?? ETIQUETA_ESTADO['enviado']
    return <Tag color={def.color}>{def.texto}</Tag>
  }

  const contenidoExito = (): ReactElement => {
    if (idTicket) {
      return (
        <div className="soporte-exito">
          <div className="soporte-exito-icono">✅</div>
          <div className="soporte-exito-titulo">Ticket enviado al soporte</div>
          <div className="soporte-exito-sub">
            IFRAT revisará tu reporte y podrás ver el seguimiento en “Mis tickets”.
          </div>
          <div className="soporte-folio">{idCorto(idTicket)}</div>
          {estadoTicket && (
            <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
              Estado: {tagEstado(estadoTicket)}
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <a onClick={() => cambiarPestana('tickets')}>Ver seguimiento en “Mis tickets” →</a>
          </div>
        </div>
      )
    }
    return (
      <div className="soporte-exito">
        <div className="soporte-exito-icono">📄</div>
        <div className="soporte-exito-titulo">Reporte guardado en archivo</div>
        <div className="soporte-exito-sub">
          No se pudo enviar al servidor, así que se guardó como .txt para que lo adjuntes en tu
          correo o WhatsApp al soporte.
        </div>
        {rutaGuardada && <div className="soporte-folio">{rutaGuardada}</div>}
      </div>
    )
  }

  const contenidoFormulario = (): ReactElement => (
    <>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

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

      <Checkbox
        checked={form.adjuntarLogs}
        onChange={(e) => cambiarCampo('adjuntarLogs', e.target.checked)}
        style={{ marginBottom: 12 }}
      >
        📎 Adjuntar logs del sistema para diagnosticar mejor
      </Checkbox>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <a onClick={guardarEnArchivo} style={{ fontSize: 13, marginRight: 16 }}>
          💾 Guardar reporte en archivo (.txt)
        </a>
        <a onClick={guardarSoloLogs} style={{ fontSize: 13 }}>
          📥 Guardar solo los logs
        </a>
      </div>
    </>
  )

  const contenidoTickets = (): ReactElement => {
    if (ticketsLoading) {
      return (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      )
    }
    if (ticketsError) {
      return (
        <>
          <Alert
            message="No se pudieron cargar tus tickets"
            description={ticketsError}
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
          />
          <div style={{ textAlign: 'center' }}>
            <a onClick={() => cargarTickets()}>Reintentar</a>
          </div>
        </>
      )
    }
    if (tickets.length === 0) {
      return (
        <Empty
          description="Todavía no envías ningún ticket. Cuando envíes uno desde “Nuevo reporte”, aquí podrás ver si IFRAT ya lo revisó."
          style={{ padding: 24 }}
        />
      )
    }
    return (
      <Collapse
        ghost
        items={tickets.map((t) => ({
          key: t.id,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ color: '#15803d' }}>{idCorto(t.id)}</b>
              <span style={{ color: '#374151', fontSize: 13 }}>{t.asunto}</span>
              <span style={{ flex: 1 }} />
              {tagEstado(t.estado)}
              <span style={{ color: '#9ca3af', fontSize: 12 }}>{formatearFecha(t.fechaEnvio)}</span>
            </div>
          ),
          children: (
            <div style={{ fontSize: 13, color: '#374151' }}>
              {t.descripcion && (
                <p style={{ marginBottom: 4 }}>
                  <b>Qué reportaste:</b> {t.descripcion}
                </p>
              )}
              {t.versionIfrat && t.macAddress && (
                <p style={{ marginBottom: 4, color: '#6b7280' }}>
                  IFRAT Desktop {t.versionIfrat} · máquina {idCorto(t.macAddress)}
                </p>
              )}
              <p style={{ marginBottom: 4 }}>
                <b>IFRAT lo vio:</b>{' '}
                {t.fechaVistoPorSoporte
                  ? formatearFecha(t.fechaVistoPorSoporte)
                  : 'Aún no ha sido revisado'}
              </p>
              {t.respuestaSoporte ? (
                <p style={{ marginBottom: 0 }}>
                  <b>Seguimiento del equipo:</b> {t.respuestaSoporte}
                </p>
              ) : (
                <p style={{ marginBottom: 0, color: '#9ca3af' }}>
                  Sin respuesta del equipo por ahora.
                </p>
              )}
            </div>
          )
        }))}
      />
    )
  }

  return (
    <Modal
      title="🎧 Soporte Técnico"
      open
      onCancel={cerrar}
      onOk={pestana === 'nuevo' ? (enviado ? cerrar : enviar) : cerrar}
      okText={enviado ? 'Cerrar' : pestana === 'nuevo' ? 'Enviar ticket' : 'Cerrar'}
      cancelText="Cancelar"
      cancelButtonProps={{ style: { display: enviado ? 'none' : undefined } }}
      confirmLoading={loading}
      okButtonProps={{
        style:
          enviado || pestana === 'tickets'
            ? undefined
            : { background: '#16a34a', borderColor: '#16a34a' }
      }}
      width={540}
    >
      <Tabs
        activeKey={pestana}
        onChange={(k) => cambiarPestana(k as 'nuevo' | 'tickets')}
        items={[
          {
            key: 'nuevo',
            label: '📨 Nuevo reporte',
            children: enviado ? contenidoExito() : contenidoFormulario()
          },
          { key: 'tickets', label: '📋 Mis tickets', children: contenidoTickets() }
        ]}
      />
    </Modal>
  )
}

export default ModalSoporte
