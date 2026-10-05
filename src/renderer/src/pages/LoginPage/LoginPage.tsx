import { ReactElement } from 'react'
import { Alert, Button, Card, Input, Typography } from 'antd'
import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { useLoginPage } from './LoginPage.hook'
import './LoginPage.css'

const LoginPage = ({ onIniciada }: { onIniciada: () => void }): ReactElement => {
  const {
    email,
    password,
    setEmail,
    setPassword,
    enviando,
    error,
    sugerirVerificarCorreo,
    iniciar
  } = useLoginPage(onIniciada)

  return (
    <div className="login-pantalla">
      <Card className="login-tarjeta">
        <Typography.Title level={3} className="login-titulo">
          Inicia sesión con tu cuenta IFRAT
        </Typography.Title>
        <Typography.Paragraph className="login-subtitulo">
          Usa el mismo correo y contraseña con los que entras a <strong>ifrat.ar-sa.com.mx</strong>.
          Esta máquina quedará vinculada a tu cuenta automáticamente.
        </Typography.Paragraph>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void iniciar()
          }}
          noValidate
        >
          <label htmlFor="login-email" className="login-label">
            Correo
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            prefix={<MailOutlined />}
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={enviando}
            size="large"
          />

          <label htmlFor="login-password" className="login-label">
            Contraseña
          </label>
          <Input.Password
            id="login-password"
            autoComplete="current-password"
            prefix={<LockOutlined />}
            placeholder="Tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={enviando}
            size="large"
          />

          {error && <Alert type="error" message={error} showIcon className="login-error" />}

          {sugerirVerificarCorreo && (
            <Alert
              type="warning"
              showIcon
              message="¿Acabas de registrarte?"
              description="Verifica tu correo (revisa la bandeja de entrada) antes de iniciar sesión en el escritorio."
              className="login-verificar-correo"
            />
          )}

          <Button
            type="primary"
            htmlType="submit"
            loading={enviando}
            block
            size="large"
            className="login-boton"
          >
            Iniciar sesión
          </Button>
        </form>
      </Card>
    </div>
  )
}

export default LoginPage
