import { BrowserWindow } from 'electron'
import { IpcWrapper } from './IpcWrapper'
import { SesionService } from '../services/SesionService'
import { BackendService, TokenRechazadoError } from '../services/BackendService'

/**
 * Handler de sesión del escritorio: login directo con las mismas credenciales
 * que el sitio web, renovación silenciosa (refresh token) y declaración
 * automática de la máquina tras cada acceso.
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
     * Si el backend no responde (offline) se conserva la sesión guardada; solo
     * un rechazo real (401/403) manda de vuelta a la pantalla de login.
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
          this.limpiarSesion()
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
      this.limpiarSesion()
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

  private limpiarSesion(): void {
    this.sesionService.limpiar()
    BrowserWindow.getAllWindows()[0]?.webContents.send('sesion-token-rechazado')
  }
}
