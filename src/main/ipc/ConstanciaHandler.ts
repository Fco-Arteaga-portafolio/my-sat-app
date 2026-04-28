import { ipcMain, app, BrowserWindow } from 'electron'
import { Page } from 'playwright'
import { BrowserManager } from '../scraper/BrowserManager'
import { SatConstanciaService } from '../scraper/SatConstanciaService'
import { ConfiguracionService } from '../services/ConfiguracionService'

export class ConstanciaHandler {
  private constanciaService: SatConstanciaService
  private configuracionService: ConfiguracionService
  private paginaActiva: Page | null = null

  constructor(configuracionService: ConfiguracionService) {
    this.constanciaService = new SatConstanciaService()
    this.configuracionService = configuracionService
  }

  registrar(): void {

    ipcMain.handle('constancia-obtener-captcha', async () => {
      try {
        await this.cerrarPaginaActiva()
        const contexto = await BrowserManager.newContext()
        this.paginaActiva = await contexto.newPage()
        const captcha = await this.constanciaService.obtenerCaptcha(this.paginaActiva)
        return { success: true, data: captcha }
      } catch (error) {
        console.error('[ConstanciaHandler] obtener-captcha:', error)
        await this.cerrarPaginaActiva()
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Error obteniendo captcha'
        }
      }
    })

    ipcMain.handle('constancia-obtener-constancia', async (_, data: { captcha?: string }) => {
      try {
        const config = this.configuracionService.obtener()
        if (!config?.rfc) {
          return { success: false, error: 'No hay RFC configurado. Ve a Configuración primero.' }
        }

        const carpetaTemp = config.carpetaDescarga || app.getPath('downloads')
        const tipoLogin = config.metodoAuth ?? 'contrasena'

        const onProgreso = (mensaje: string) => {
          BrowserWindow.getAllWindows()[0]?.webContents.send('progreso-constancia', mensaje)
        }

        let constancia

        if (tipoLogin === 'efirma') {
          await this.cerrarPaginaActiva()
          const contexto = await BrowserManager.newContext()
          this.paginaActiva = await contexto.newPage()

          constancia = await this.constanciaService.loginFielYObtenerConstancia(
            this.paginaActiva,
            carpetaTemp,
            config.rfc,
            config.rutaCer ?? '',
            config.rutaKey ?? '',
            config.contrasenaFiel ?? '',
            onProgreso
          )
        } else {
          if (!this.paginaActiva || this.paginaActiva.isClosed()) {
            return { success: false, error: 'La sesión expiró. Recarga el captcha e intenta de nuevo.' }
          }
          if (!data.captcha?.trim()) {
            return { success: false, error: 'El captcha es requerido.' }
          }

          constancia = await this.constanciaService.loginCiecYObtenerConstancia(
            this.paginaActiva,
            carpetaTemp,
            config.rfc,
            config.contrasena ?? '',
            data.captcha,
            onProgreso
          )
        }

        return { success: true, data: constancia }
      } catch (error) {
        console.error('[ConstanciaHandler] obtener-constancia:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Error obteniendo constancia'
        }
      } finally {
        await this.cerrarPaginaActiva()
      }
    })

    ipcMain.handle('constancia-cerrar-sesion', async () => {
      await this.cerrarPaginaActiva()
      return { success: true }
    })
  }

  private async cerrarPaginaActiva(): Promise<void> {
    if (this.paginaActiva && !this.paginaActiva.isClosed()) {
      await this.paginaActiva.context().close().catch(() => null)
    }
    this.paginaActiva = null
  }
}
