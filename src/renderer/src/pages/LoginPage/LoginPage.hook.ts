import { useCallback, useMemo, useState } from 'react'

interface LoginPageApi {
  email: string
  password: string
  setEmail: (v: string) => void
  setPassword: (v: string) => void
  enviando: boolean
  error: string | null
  /** True cuando el backend rechazó las credenciales (incluye email sin verificar). */
  sugerirVerificarCorreo: boolean
  iniciar: () => Promise<void>
}

/** Quita el prefijo "Error: " que añade IpcWrapper al serializar la excepción. */
const limpiarMensaje = (mensaje: string): string => mensaje.replace(/^Error:\s*/i, '').trim()

export const useLoginPage = (onIniciada: () => void): LoginPageApi => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const iniciar = useCallback(async (): Promise<void> => {
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const res = await window.api.iniciarSesion(email.trim(), password)
      if (!res.success || !res.iniciada) {
        setError(limpiarMensaje(res.error ?? 'No se pudo iniciar sesión'))
        return
      }
      onIniciada()
    } catch {
      setError('No se pudo contactar el servidor de IFRAT')
    } finally {
      setEnviando(false)
    }
  }, [email, password, onIniciada])

  // El backend rechaza con el mismo mensaje ("Credenciales erróneas") cuando la
  // contraseña es incorrecta y cuando el correo aún no fue verificado; en ambos
  // casos conviene sugerir revisar la verificación del correo.
  const sugerirVerificarCorreo = useMemo(() => !!error && /credenciales/i.test(error), [error])

  return {
    email,
    password,
    setEmail,
    setPassword,
    enviando,
    error,
    sugerirVerificarCorreo,
    iniciar
  }
}
