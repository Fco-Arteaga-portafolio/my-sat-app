import { ipcMain, app, BrowserWindow } from 'electron'
import { Page } from 'playwright'
import { SatUnifiedAuthService } from '../scraper/SatUnifiedAuthService'
import { ConfiguracionService } from '../services/ConfiguracionService'
import { CaptchaData, SatOperationResult, CiecCredentials, FielCredentials } from '../scraper/SatPortalConfig'
import { IPortalConfigProvider } from '../scraper/SatPortalConfig'

interface IOperationServiceRegistry {
    [portalId: string]: {
        obtenerCaptcha: () => Promise<CaptchaData>
        ejecutar: (page: Page, credenciales: any, options: any) => Promise<SatOperationResult>
        cerrarSesion: () => Promise<void>
    }
}

export class UnifiedSatHandler {
    constructor(
        private configuracionService: ConfiguracionService,
        private operationServices: IOperationServiceRegistry,
        private authService: SatUnifiedAuthService,
        private configProvider: IPortalConfigProvider   // ← estaba faltando
    ) { }

    registrarServicioOperacion(
        portalId: string,
        servicio: IOperationServiceRegistry[string]
    ): void {
        this.operationServices[portalId] = servicio
    }

    registrar(): void {
        ipcMain.handle('obtener-captcha-dinamico', async (_, { portalId }: { portalId: string }) => {
            try {
                this.validarPortal(portalId)
                const captcha = await this.authService.obtenerCaptcha(portalId)
                return { success: true, data: captcha }
            } catch (error) {
                console.error(`[UnifiedSatHandler] Error obteniendo captcha para ${portalId}:`, error)
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Error obteniendo captcha'
                }
            }
        })

        ipcMain.handle('ejecutar-operacion-dinamica', async (_event, { portalId, credenciales }: {
            portalId: string
            credenciales: any
        }) => {
            try {
                this.validarPortal(portalId)

                const config = this.configuracionService.obtener()
                if (!config?.rfc) {
                    return { success: false, error: 'No hay RFC configurado. Ve a Configuración primero.' }
                }

                const operationService = this.operationServices[portalId]
                if (!operationService) {
                    throw new Error(`No hay servicio de operación registrado para ${portalId}`)
                }

                const carpetaTemp = config.carpetaDescarga || app.getPath('downloads')
                const tipoLogin = config.metodoAuth ?? 'contrasena'

                const onProgreso = (mensaje: string) => {
                    BrowserWindow.getAllWindows()[0]?.webContents.send(`progreso-${portalId}`, mensaje)
                }

                const credencialesFinal = this.prepararCredenciales(credenciales, tipoLogin, config)

                // ✅ El handler hace el login — reutiliza la página donde ya cargó el captcha
                const paginaAutenticada = await this.autenticar(portalId, tipoLogin, credencialesFinal)

                // ✅ Pasa la página lista al operation service — ya no abre nada nuevo
                const resultado = await operationService.ejecutar(paginaAutenticada, credencialesFinal, {
                    carpetaTemp,
                    onProgreso
                })

                return { success: true, data: resultado }
            } catch (error) {
                console.error(`[UnifiedSatHandler] Error ejecutando operación en ${portalId}:`, error)
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Error ejecutando operación'
                }
            }
        })

        ipcMain.handle('cerrar-sesion-dinamica', async (_, { portalId }: { portalId: string }) => {
            try {
                const operationService = this.operationServices[portalId]
                if (operationService) {
                    await operationService.cerrarSesion()
                }
                return { success: true }
            } catch (error) {
                console.error(`[UnifiedSatHandler] Error cerrando sesión en ${portalId}:`, error)
                return { success: false, error: String(error) }
            }
        })

        this.registrarHandlersLegacy()
    }

    private async autenticar(
        portalId: string,
        tipoLogin: string,
        credenciales: any
    ): Promise<Page> {
        if (tipoLogin === 'efirma') {
            return this.authService.loginFiel(portalId, credenciales as FielCredentials)
        } else {
            return this.authService.loginCiec(portalId, credenciales as CiecCredentials)
        }
    }

    private registrarHandlersLegacy(): void {
        // Constancia
        ipcMain.handle('constancia-obtener-captcha', async () => {
            try {
                this.validarPortal('constancia')
                const captcha = await this.authService.obtenerCaptcha('constancia')
                return { success: true, data: captcha }
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Error obteniendo captcha'
                }
            }
        })

        ipcMain.handle('constancia-obtener-constancia', async (_, data: { captcha?: string }) => {
            try {
                this.validarPortal('constancia')
                const config = this.configuracionService.obtener()
                if (!config?.rfc) {
                    return { success: false, error: 'No hay RFC configurado' }
                }

                const carpetaTemp = config.carpetaDescarga || app.getPath('downloads')
                const tipoLogin = config.metodoAuth ?? 'contrasena'

                const onProgreso = (mensaje: string) => {
                    BrowserWindow.getAllWindows()[0]?.webContents.send('progreso-constancia', mensaje)
                }

                const operationService = this.operationServices['constancia']
                if (!operationService) {
                    throw new Error('No hay servicio registrado para constancia')
                }

                const credencialesFinal = this.prepararCredenciales(data, tipoLogin, config)
                const paginaAutenticada = await this.autenticar('constancia', tipoLogin, credencialesFinal)
                const resultado = await operationService.ejecutar(paginaAutenticada, credencialesFinal, {
                    carpetaTemp,
                    onProgreso
                })

                return { success: true, data: resultado }
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Error ejecutando operación'
                }
            }
        })

        ipcMain.handle('constancia-cerrar-sesion', async () => {
            try {
                const operationService = this.operationServices['constancia']
                if (operationService) await operationService.cerrarSesion()
                return { success: true }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })

        // Cumplimiento
        ipcMain.handle('cumplimiento-obtener-captcha', async () => {
            try {
                this.validarPortal('cumplimiento')
                const captcha = await this.authService.obtenerCaptcha('cumplimiento')
                return { success: true, data: captcha }
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Error obteniendo captcha'
                }
            }
        })

        ipcMain.handle('cumplimiento-obtener-opinion', async (_, data: { captcha?: string }) => {
            try {
                this.validarPortal('cumplimiento')
                const config = this.configuracionService.obtener()
                if (!config?.rfc) {
                    return { success: false, error: 'No hay RFC configurado' }
                }

                const carpetaTemp = config.carpetaDescarga || app.getPath('downloads')
                const tipoLogin = config.metodoAuth ?? 'contrasena'

                const onProgreso = (mensaje: string) => {
                    BrowserWindow.getAllWindows()[0]?.webContents.send('progreso-cumplimiento', mensaje)
                }

                const operationService = this.operationServices['cumplimiento']
                if (!operationService) {
                    throw new Error('No hay servicio registrado para cumplimiento')
                }

                const credencialesFinal = this.prepararCredenciales(data, tipoLogin, config)
                const paginaAutenticada = await this.autenticar('cumplimiento', tipoLogin, credencialesFinal)
                const resultado = await operationService.ejecutar(paginaAutenticada, credencialesFinal, {
                    carpetaTemp,
                    onProgreso
                })

                return { success: true, data: resultado }
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Error ejecutando operación'
                }
            }
        })

        ipcMain.handle('cumplimiento-cerrar-sesion', async () => {
            try {
                const operationService = this.operationServices['cumplimiento']
                if (operationService) await operationService.cerrarSesion()
                return { success: true }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })
    }

    private prepararCredenciales(credenciales: any, tipoLogin: string, config: any): any {
        if (tipoLogin === 'efirma') {
            return {
                rutaCer: config.rutaCer ?? '',
                rutaKey: config.rutaKey ?? '',
                contrasenaFiel: config.contrasenaFiel ?? ''
            }
        } else {
            return {
                rfc: config.rfc ?? '',
                password: config.contrasena ?? '',
                captcha: credenciales.captcha ?? ''
            }
        }
    }

    private validarPortal(portalId: string): void {
        if (!this.configProvider.existePortal(portalId)) {
            throw new Error(`Portal ${portalId} no existe`)
        }
    }
}