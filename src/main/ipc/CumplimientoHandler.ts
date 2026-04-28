import { ipcMain, app, BrowserWindow } from 'electron'
import { Page } from 'playwright'
import { BrowserManager } from '../scraper/BrowserManager'
import { SatCumplimientoService } from '../scraper/SatCumplimientoService'
import { ConfiguracionService } from '../services/ConfiguracionService'

export class CumplimientoHandler {
    private cumplimientoService: SatCumplimientoService
    private configuracionService: ConfiguracionService
    private paginaActiva: Page | null = null

    constructor(configuracionService: ConfiguracionService) {
        this.cumplimientoService = new SatCumplimientoService()
        this.configuracionService = configuracionService
    }

    registrar(): void {

        ipcMain.handle('cumplimiento-obtener-captcha', async () => {
            try {
                await this.cerrarPaginaActiva()
                const contexto = await BrowserManager.newContext()
                this.paginaActiva = await contexto.newPage()
                const captcha = await this.cumplimientoService.obtenerCaptcha(this.paginaActiva)
                return { success: true, data: captcha }
            } catch (error) {
                console.error('[CumplimientoHandler] obtener-captcha:', error)
                await this.cerrarPaginaActiva()
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Error obteniendo captcha'
                }
            }
        })

        ipcMain.handle('cumplimiento-obtener-opinion', async (_, data: { captcha?: string }) => {
            try {
                const config = this.configuracionService.obtener()
                if (!config?.rfc) {
                    return { success: false, error: 'No hay RFC configurado. Ve a Configuración primero.' }
                }

                const carpetaTemp = config.carpetaDescarga || app.getPath('downloads')
                const tipoLogin = config.metodoAuth ?? 'contrasena'

                const onProgreso = (mensaje: string) => {
                    BrowserWindow.getAllWindows()[0]?.webContents.send('progreso-cumplimiento', mensaje)
                }

                let opinion

                if (tipoLogin === 'efirma') {
                    await this.cerrarPaginaActiva()
                    const contexto = await BrowserManager.newContext()
                    this.paginaActiva = await contexto.newPage()

                    opinion = await this.cumplimientoService.loginFielYObtenerOpinion(
                        this.paginaActiva,
                        carpetaTemp,
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

                    opinion = await this.cumplimientoService.loginCiecYObtenerOpinion(
                        this.paginaActiva,
                        carpetaTemp,
                        config.rfc,
                        config.contrasena ?? '',
                        data.captcha,
                        onProgreso
                    )
                }

                return { success: true, data: opinion }
            } catch (error) {
                console.error('[CumplimientoHandler] obtener-opinion:', error)
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Error obteniendo opinión'
                }
            } finally {
                await this.cerrarPaginaActiva()
            }
        })

        ipcMain.handle('cumplimiento-cerrar-sesion', async () => {
            await this.cerrarPaginaActiva()
            return { success: true }
        })
    }

    private async cerrarPaginaActiva(): Promise<void> {
        if (this.paginaActiva && !this.paginaActiva.isClosed()) {
            await this.paginaActiva.close().catch(() => null)
        }
        this.paginaActiva = null
    }
}