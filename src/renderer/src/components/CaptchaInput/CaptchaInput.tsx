import { forwardRef, useImperativeHandle } from 'react'
import { Input, Button, Alert } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useCaptchaInput } from './useCaptchaInput'
import './CaptchaInput.css'

export interface CaptchaInputRef {
  limpiar: () => void
}

interface CaptchaInputProps {
  disabled?: boolean
  onCaptchaChange?: (texto: string, listo: boolean) => void
}

const CaptchaInput = forwardRef<CaptchaInputRef, CaptchaInputProps>(
  ({ disabled, onCaptchaChange }, ref) => {
    const { captchaImg, captchaTexto, setCaptchaTexto, loading, error, cargarCaptcha, limpiar } = useCaptchaInput()

    useImperativeHandle(ref, () => ({ limpiar }), [])

    const handleTexto = (valor: string) => {
      const upper = valor.toUpperCase()
      setCaptchaTexto(upper)
      onCaptchaChange?.(upper, !!captchaImg && !!upper.trim())
    }

    return (
      <div className="captcha-input-container">
        {error && <Alert message={error} type="error" showIcon className="captcha-input-alert" />}

        <div className="captcha-input-row">
          <div className="captcha-input-img-wrap">
            {captchaImg
              ? <img src={captchaImg} alt="Captcha" className="captcha-input-img" />
              : <div className="captcha-input-placeholder">Sin captcha</div>
            }
            <Button
              icon={<ReloadOutlined />}
              onClick={cargarCaptcha}
              loading={loading}
              disabled={disabled}
              size="small"
            >
              {captchaImg ? 'Recargar' : 'Cargar captcha'}
            </Button>
          </div>

          {captchaImg && (
            <div className="captcha-input-field">
              <Input
                value={captchaTexto}
                onChange={(e) => handleTexto(e.target.value)}
                placeholder="Escribe el captcha"
                maxLength={6}
                disabled={disabled}
                onPressEnter={() => onCaptchaChange?.(captchaTexto, !!captchaImg && !!captchaTexto.trim())}
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