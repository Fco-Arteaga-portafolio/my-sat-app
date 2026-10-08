import { BrowserWindow } from 'electron'
import { IpcWrapper } from './IpcWrapper'
import { SesionService } from '../services/SesionService'
import { BackendService, TokenRechazadoError } from '../services/BackendService'

/**
 * Handler de sesión del escritorio: login directo con las mismas credenciales
 * que el sitio web, renovación silenciosa (refresh token) y re-login en segundo
 * plano con las credenciales guardadas cuando el refresh token expira o se
 * revoca. La pantalla de login solo aparece si hasta las credenciales
 * guardadas fallan (p. ej. la contraseña cambió en la web).
 */
export class SesionHandler {
  constructor(
    private readonly sesionService: SesionService,
    private readonly backendService: BackendService
  ) {}

  registrar(): void {
    IpcWrapper.handle('obtener-estado-sesion', async () => ({
      iniciada: this.sesionService.estaIniciada()
    }))

    /**
     * Silent login: renueva el par de tokens con el refreshToken persistido.
     * Si el backend no responde (offline) se conserva la sesión guardada. Si el
     * refresh token fue rechazado (401/403 porque expiró o se revocó), se
     * intenta un re-login en segundo plano con las credenciales guardadas; solo
     * si eso también falla se regresa a la pantalla de login.
     */
    IpcWrapper.handle('renovar-sesion', async () => {
      const sesion = this.sesionService.obtenerSesion()
      if (!sesion) return { iniciada: false }

      try {
        const renovada = await this.backendService.renovarSesion(sesion.refreshToken)
        this.sesionService.guardarSesion(renovada)
        await this.vincularMaquinaAutomatica(renovada.token)
        await this.sesionService.sincronizarResumen()
        return { iniciada: true, nombre: renovada.nombre, email: renovada.email }
      } catch (error) {
        if (error instanceof TokenRechazadoError) {
          const restaurada = await this.reintentarLoginEnSegundoPlano()
          if (restaurada) return restaurada
          this.sesionService.limpiar()
          return { iniciada: false }
        }
        return { iniciada: true, nombre: sesion.nombre, email: sesion.email }
      }
    })

    IpcWrapper.handle('iniciar-sesion', async (_, datos: { email?: string; password?: string }) => {
      const email = datos?.email?.trim().toLowerCase()
      if (!email || !datos?.password) throw new Error('Ingresa tu correo y contraseña')

      const credenciales = await this.backendService.login(email, datos.password)
      this.sesionService.guardarSesion(credenciales)
      // Guarda las credenciales (cifradas) para nunca volver a pedir login.
      this.sesionService.guardarCredencialesLogin(email, datos.password)
      await this.vincularMaquinaAutomatica(credenciales.token)
      await this.sesionService.sincronizarResumen()
      return { iniciada: true, nombre: credenciales.nombre, email: credenciales.email }
    })

    IpcWrapper.handle('cerrar-sesion', async () => {
      const jwt = this.sesionService.obtenerJwt()
      if (jwt) {
        try {
          await this.backendService.cerrarSesion(jwt)
        } catch {
          // Mejor esfuerzo: el cierre local es lo importante.
        }
      }
      // Logout explícito: borra todo (incluidas las credenciales guardadas) y
      // NO re-loguea en segundo plano. El usuario decidió salir de su cuenta.
      this.sesionService.limpiar()
      BrowserWindow.getAllWindows()[0]?.webContents.send('sesion-token-rechazado')
      return {}
    })

    IpcWrapper.handle('obtener-cuenta', async () => {
      const sesion = this.sesionService.obtenerSesion()
      return sesion ? { nombre: sesion.nombre, email: sesion.email } : null
    })
  }

  /**
   * Declara la máquina en la cuenta (idempotente, `yaExistia`). No bloquea el
   * login si falla: el mensaje de cupo se verá en su momento.
   */
  private async vincularMaquinaAutomatica(jwt: string): Promise<void> {
    try {
      await this.backendService.vincularMaquina(jwt, this.sesionService.obtenerHardwareId())
    } catch {
      // No bloquea el login.
    }
  }

  /**
   * Re-loguea en segundo plano con las credenciales guardadas en la BD.
   * Devuelve la sesión restaurada o null si no hay credenciales guardadas o las
   * credenciales ya no son válidas (p. ej. cambiaron la contraseña en la web).
   */
  private async reintentarLoginEnSegundoPlano(): Promise<{
    iniciada: true
    nombre: string
    email: string
  } | null> {
    const credenciales = this.sesionService.obtenerCredenciales()
    if (!credenciales) return null
    try {
      const sesion = await this.backendService.login(credenciales.usuario, credenciales.contrasena)
      this.sesionService.guardarSesion(sesion)
      await this.vincularMaquinaAutomatica(sesion.token)
      await this.sesionService.sincronizarResumen()
      console.log('Sesión restaurada en segundo plano con las credenciales guardadas')
      return { iniciada: true, nombre: sesion.nombre, email: sesion.email }
    } catch {
      return null
    }
  }
}
