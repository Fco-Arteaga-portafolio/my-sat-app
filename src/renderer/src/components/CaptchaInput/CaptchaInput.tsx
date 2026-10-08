import { forwardRef, useImperativeHandle, useEffect } from 'react'
import { Input, Button, Alert } from 'antd'
import { ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useCaptchaInput } from './useCaptchaInput'
import './CaptchaInput.css'

export interface CaptchaInputRef {
  limpiar: () => void
}

interface CaptchaInputProps {
  portalId: string
  disabled?: boolean
  onCaptchaChange?: (texto: string, listo: boolean) => void
}

const CaptchaInput = forwardRef<CaptchaInputRef, CaptchaInputProps>(
  ({ portalId, disabled, onCaptchaChange }, ref) => {
    const {
      captchaImg,
      captchaTexto,
      setCaptchaTexto,
      loading,
      error,
      sesionActiva,
      cargarCaptcha,
      limpiar
    } = useCaptchaInput(portalId)

    useImperativeHandle(ref, () => ({ limpiar }), [])

    // Sesión SAT vigente: habilitar el envío sin captcha.
    useEffect(() => {
      if (sesionActiva) onCaptchaChange?.('', true)
    }, [sesionActiva])

    // Al perder la sesión o recargar, deshabilitar el envío hasta tener captcha.
    useEffect(() => {
      if (!sesionActiva && !captchaImg) onCaptchaChange?.('', false)
    }, [sesionActiva, captchaImg])

    const handleTexto = (valor: string) => {
      const upper = valor.toUpperCase()
      setCaptchaTexto(upper)
      onCaptchaChange?.(upper, !!captchaImg && !!upper.trim())
    }

    return (
      <div className="captcha-input-container">
        {error && <Alert message={error} type="error" showIcon className="captcha-input-alert" />}

        {sesionActiva && (
          <Alert
            message="Sesión con el SAT activa — no se requiere captcha"
            description="Se reutilizó la sesión guardada de una visita anterior. Si el SAT la expira, se volverá a pedir el captcha."
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            className="captcha-input-alert"
          />
        )}

        <div className="captcha-input-row">
          <div className="captcha-input-img-wrap">
            {sesionActiva ? (
              <div className="captcha-input-placeholder">Sesión activa</div>
            ) : captchaImg ? (
              <img src={captchaImg} alt="Captcha" className="captcha-input-img" />
            ) : (
              <div className="captcha-input-placeholder">Sin captcha</div>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={cargarCaptcha}
              loading={loading}
              disabled={disabled}
              size="small"
            >
              {sesionActiva ? 'Comprobar sesión' : captchaImg ? 'Recargar' : 'Cargar captcha'}
            </Button>
          </div>

          {captchaImg && !sesionActiva && (
            <div className="captcha-input-field">
              <Input
                value={captchaTexto}
                onChange={(e) => handleTexto(e.target.value)}
                placeholder="Escribe el captcha"
                maxLength={6}
                disabled={disabled}
                onPressEnter={() =>
                  onCaptchaChange?.(captchaTexto, !!captchaImg && !!captchaTexto.trim())
                }
              />
            </div>
          )}
        </div>
      </div>
    )
  }
)

CaptchaInput.displayName = 'CaptchaInput'

export default CaptchaInput
