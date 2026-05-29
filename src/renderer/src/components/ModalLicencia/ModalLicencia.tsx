import { Modal, Input, Alert } from 'antd'
import { useModalLicencia, PLANES, PlanId, MetodoPago } from './ModalLicencia.hook'
import './ModalLicencia.css'

const STEPS = ['Plan', 'Datos', 'Pago', 'Listo']

const METODOS: { key: MetodoPago; icono: string; label: string }[] = [
  { key: 'tarjeta', icono: '💳', label: 'Tarjeta' },
  { key: 'spei', icono: '🏦', label: 'SPEI' },
  { key: 'oxxo', icono: '🏪', label: 'OXXO' }
]

const ModalLicencia = ({ onClose }: { onClose: () => void }) => {
  const {
    tab,
    setTab,
    step,
    setStep,
    planSeleccionado,
    setPlanSeleccionado,
    metodoPago,
    setMetodoPago,
    formDatos,
    cambiarDato,
    formTarjeta,
    cambiarTarjeta,
    formActivar,
    cambiarActivar,
    licenseKeyGenerada,
    activado,
    loading,
    error,
    siguiente,
    activar,
    cerrar
  } = useModalLicencia(onClose)

  const planActual = PLANES.find((p) => p.id === planSeleccionado)!

  const okText = () => {
    if (tab === 'activar') return activado ? 'Cerrar' : 'Activar en este equipo'
    if (step === 4) return 'Cerrar'
    if (step === 3) return `Pagar $${planActual.precio.toLocaleString('es-MX')}`
    return 'Continuar →'
  }

  const onOk = () => {
    if (tab === 'activar') {
      activado ? cerrar() : activar()
      return
    }
    if (step === 4) {
      cerrar()
      return
    }
    siguiente()
  }

  const onCancel = () => {
    if (step === 1 || tab === 'activar') {
      cerrar()
      return
    }
    setStep((prev) => prev - 1)
  }

  return (
    <Modal
      title="🔑 Licencia & Activación"
      open
      onOk={onOk}
      onCancel={onCancel}
      okText={okText()}
      cancelText={step > 1 && step < 4 && tab === 'comprar' ? '← Regresar' : 'Cancelar'}
      cancelButtonProps={{ style: { display: step === 4 || activado ? 'none' : undefined } }}
      confirmLoading={loading}
      okButtonProps={{
        style: {
          background: step === 3 ? '#d97706' : undefined,
          borderColor: step === 3 ? '#d97706' : undefined
        }
      }}
      width={520}
    >
      {/* Tabs */}
      <div className="lic-tabs">
        <button
          className={`lic-tab${tab === 'comprar' ? ' activo' : ''}`}
          onClick={() => setTab('comprar')}
        >
          <span className="lic-tab-icono">🛒</span>
          Comprar licencia
        </button>
        <button
          className={`lic-tab${tab === 'activar' ? ' activo' : ''}`}
          onClick={() => setTab('activar')}
        >
          <span className="lic-tab-icono">✅</span>
          Ya tengo una key
        </button>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      {/* ── TAB COMPRAR ── */}
      {tab === 'comprar' && (
        <>
          {/* Steps indicator */}
          {step < 4 && (
            <div className="lic-steps">
              {STEPS.map((label, i) => {
                const n = i + 1
                return (
                  <div
                    key={label}
                    className={`lic-step${step === n ? ' activo' : ''}${step > n ? ' completado' : ''}`}
                  >
                    <div className="lic-step-dot">{step > n ? '✓' : n}</div>
                    <div className="lic-step-label">{label}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Step 1 — Plan */}
          {step === 1 && (
            <>
              <div className="lic-planes">
                {PLANES.map((plan) => (
                  <div
                    key={plan.id}
                    className={`lic-plan${planSeleccionado === plan.id ? ' seleccionado' : ''}`}
                    onClick={() => setPlanSeleccionado(plan.id as PlanId)}
                  >
                    <div className="lic-plan-nombre">
                      {plan.nombre}
                      {plan.id === 'profesional' ? ' ⭐' : ''}
                    </div>
                    <div className="lic-plan-precio">${plan.precio.toLocaleString('es-MX')}</div>
                    <div className="lic-plan-periodo">/año (40% desc.)</div>
                    <ul className="lic-plan-features">
                      <li>{plan.rfcs}</li>
                      <li>{plan.dispositivos}</li>
                      {plan.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="amber">
                🏷 Precio de fundador: 40% de descuento el primer año. Solo por tiempo limitado.
              </div>
            </>
          )}

          {/* Step 2 — Datos */}
          {step === 2 && (
            <>
              <div className="">
                Este RFC y la huella de esta máquina quedarán vinculados a tu licencia.
              </div>
              <Input
                placeholder="Nombre completo"
                value={formDatos.nombre}
                onChange={(e) => cambiarDato('nombre', e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <Input
                type="email"
                placeholder="Correo electrónico"
                value={formDatos.email}
                onChange={(e) => cambiarDato('email', e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <Input
                placeholder="RFC del titular"
                value={formDatos.rfc}
                onChange={(e) => cambiarDato('rfc', e.target.value.toUpperCase())}
                style={{ marginBottom: 12 }}
              />
            </>
          )}

          {/* Step 3 — Pago */}
          {step === 3 && (
            <>
              <div className="lic-metodos">
                {METODOS.map((m) => (
                  <button
                    key={m.key}
                    className={`lic-metodo${metodoPago === m.key ? ' seleccionado' : ''}`}
                    onClick={() => setMetodoPago(m.key)}
                  >
                    <span className="lic-metodo-icono">{m.icono}</span>
                    {m.label}
                  </button>
                ))}
              </div>

              {metodoPago === 'tarjeta' && (
                <>
                  <Input
                    placeholder="Nombre del titular"
                    value={formTarjeta.titular}
                    onChange={(e) => cambiarTarjeta('titular', e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                  <Input
                    placeholder="Número de tarjeta"
                    value={formTarjeta.numero}
                    maxLength={19}
                    onChange={(e) => cambiarTarjeta('numero', e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                  <div className="lic-form-row">
                    <Input
                      placeholder="MM/AA"
                      value={formTarjeta.vencimiento}
                      maxLength={5}
                      onChange={(e) => cambiarTarjeta('vencimiento', e.target.value)}
                    />
                    <Input
                      placeholder="CVV"
                      value={formTarjeta.cvv}
                      maxLength={4}
                      onChange={(e) => cambiarTarjeta('cvv', e.target.value)}
                    />
                  </div>
                </>
              )}

              {metodoPago === 'spei' && (
                <div className="">
                  Al continuar se generará una CLABE interbancaria. Tendrás 48 horas para realizar
                  la transferencia. Tu licencia se activará automáticamente al recibir el pago.
                </div>
              )}

              {metodoPago === 'oxxo' && (
                <div className="">
                  Al continuar se generará un código de barras para pago en OXXO. Tendrás 24 horas
                  para realizar el pago. Tu licencia se activará automáticamente.
                </div>
              )}

              <div className="lic-resumen">
                <span className="lic-resumen-label">Plan {planActual.nombre} — 1 año</span>
                <span className="lic-resumen-precio">
                  ${planActual.precio.toLocaleString('es-MX')}
                </span>
              </div>
            </>
          )}

          {/* Step 4 — Éxito */}
          {step === 4 && (
            <div className="lic-exito">
              <div className="lic-exito-icono">🎉</div>
              <div className="lic-exito-titulo">¡Licencia activada!</div>
              <div className="lic-exito-sub">
                Tu licencia quedó vinculada a este dispositivo y RFC
              </div>
              {licenseKeyGenerada && <div className="lic-key-box">{licenseKeyGenerada}</div>}
              <div className="green">
                Guarda esta clave. También la enviamos a tu correo. Si cambias de equipo, úsala para
                reactivar.
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB ACTIVAR ── */}
      {tab === 'activar' && (
        <>
          {activado ? (
            <div className="lic-exito">
              <div className="lic-exito-icono">✅</div>
              <div className="lic-exito-titulo">¡Licencia activada!</div>
              <div className="lic-exito-sub">Ya puedes usar IFRAT en este equipo.</div>
            </div>
          ) : (
            <>
              <div className=" ">
                Ingresa la license key que recibiste por correo al comprar tu licencia.
              </div>
              <Input
                placeholder="IFRAT-XXX-XXXX-XXXX-XXXX"
                value={formActivar.licenseKey}
                onChange={(e) => cambiarActivar('licenseKey', e.target.value.toUpperCase())}
                style={{ marginBottom: 12, fontFamily: 'monospace', letterSpacing: 1 }}
              />
              <Input
                placeholder="RFC del titular"
                value={formActivar.rfc}
                onChange={(e) => cambiarActivar('rfc', e.target.value.toUpperCase())}
                style={{ marginBottom: 12 }}
              />
              <div className="amber">
                ⚠️ Esta máquina quedará registrada como un dispositivo activo de tu licencia.
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

export default ModalLicencia
