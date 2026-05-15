/**
 * SatUnifiedAuthService.ts
 * 
 * Servicio unificado de autenticación para todos los portales SAT.
 * Consolidación de SatAuthService, SatConstanciaService y SatCumplimientoService.
 * 
 * SOLID Principles:
 * - Single Responsibility: Solo maneja autenticación
 * - Open/Closed: Extendible sin modificar existente
 * - Liskov Substitution: Implementa ISatAuthService
 * - Interface Segregation: Interfaces específicas
 * - Dependency Injection: Recibe config e inyectables
 */

import { Page, BrowserContext } from 'playwright'
import { BrowserManager } from './BrowserManager'
import {
    ISatAuthService,
    SatPortalConfig,
    CaptchaData,
    CiecCredentials,
    FielCredentials,
    AuthMethod
} from './SatPortalConfig'
import { IPortalConfigProvider } from './SatPortalConfig'

const MAX_REINTENTOS = 3
const ESPERA_ENTRE_REINTENTOS_MS = 5000

export class SatUnifiedAuthService implements ISatAuthService {
    private context: BrowserContext | null = null
    private paginaActiva: Map<string, Page> = new Map()

    constructor(private configProvider: IPortalConfigProvider) { }

    /**
     * Obtiene el captcha para un portal específico.
     * Reutiliza la página existente si está abierta, sino crea una nueva.
     */
    async obtenerCaptcha(portalId: string): Promise<CaptchaData> {
        const config = this.validarPortal(portalId)

        if (!config.requiresCaptcha) {
            throw new Error(`Portal ${portalId} no requiere captcha`)
        }

        // Reutilizar página existente si está abierta
        let pagina = this.paginaActiva.get(portalId)
        if (!pagina || pagina.isClosed()) {
            pagina = await this.crearPagina()
            this.paginaActiva.set(portalId, pagina)
        }

        try {
            await pagina.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 })

            // Esperar a que cargue el captcha
            await pagina.waitForSelector(config.selectors.captchaImage, { timeout: 15000 })

            // Capturar según el tipo de captcha
            const captchaEl = await pagina.$(config.selectors.captchaImage)
            if (!captchaEl) {
                throw new Error('No se pudo encontrar el elemento del captcha')
            }

            let imagenBase64: string

            // Si es data:image, lo capturamos del atributo src
            const src = await captchaEl.getAttribute('src')
            if (src?.startsWith('data:image')) {
                imagenBase64 = src
            } else {
                // Si no, tomamos screenshot del elemento
                const buffer = await captchaEl.screenshot({ type: 'png' })
                imagenBase64 = `data:image/png;base64,${buffer.toString('base64')}`
            }

            return {
                imagenBase64,
                timestamp: Date.now()
            }
        } catch (error) {
            // No eliminar la página - la mantenemos para intentar login
            throw error
        }
    }

    /**
     * Login con credenciales CIEC (RFC + Contraseña + Captcha).
     * Reutiliza la página existente o crea una nueva si no existe.
     */
    async loginCiec(portalId: string, credentials: CiecCredentials): Promise<Page> {
        const config = this.validarPortal(portalId)

        if (!config.authMethods.includes('ciec')) {
            throw new Error(`Portal ${portalId} no soporta autenticación CIEC`)
        }

        // Reutilizar página existente si está abierta
        let pagina = this.paginaActiva.get(portalId)
        if (!pagina || pagina.isClosed()) {
            pagina = await this.crearPagina()
            this.paginaActiva.set(portalId, pagina)
        }

        try {
            // Llenar formulario CIEC
            await this.llenarFormularioCiec(pagina, config, credentials)

            // Intentar login
            await this.intentarLogin(
                pagina,
                config,
                () => pagina!.click(config.selectors.submitButton, { timeout: 90000 }),
                'ciec'
            )

            // Mantener la página abierta para operaciones posteriores
            return pagina
        } catch (error) {
            // No cerrar la página aquí - se cerrará en cerrarSesion()
            throw error
        }
    }

    /**
     * Login con credenciales FIEL (Certificado).
     * Reutiliza la página existente o crea una nueva si no existe.
     */
    async loginFiel(portalId: string, credentials: FielCredentials): Promise<Page> {
        const config = this.validarPortal(portalId)

        if (!config.authMethods.includes('fiel')) {
            throw new Error(`Portal ${portalId} no soporta autenticación FIEL`)
        }

        // Reutilizar página existente si está abierta
        let pagina = this.paginaActiva.get(portalId)
        if (!pagina || pagina.isClosed()) {
            const context = await this.obtenerContext()
            pagina = await context.newPage()
            this.paginaActiva.set(portalId, pagina)
        }

        try {
            await pagina.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 })

            // Algunos portales tienen botón específico para FIEL
            if (config.selectors.fielButton) {
                try {
                    await pagina.click(config.selectors.fielButton, { timeout: 10000 })
                    await pagina.waitForTimeout(500)
                } catch {
                    // Continuar si no existe el botón
                }
            }

            // Cargar certificados
            await pagina.setInputFiles(config.selectors.cerFileInput, credentials.rutaCer)
            await pagina.setInputFiles(config.selectors.keyFileInput, credentials.rutaKey)
            await pagina.fill(config.selectors.fielPasswordField, credentials.contrasenaFiel)

            // Intentar login
            await this.intentarLogin(
                pagina,
                config,
                () => pagina!.click(config.selectors.submitButton, { timeout: 90000 }),
                'fiel'
            )

            // Mantener la página abierta para operaciones posteriores
            return pagina
        } catch (error) {
            // No cerrar la página aquí - se cerrará en cerrarSesion()
            throw error
        }
    }

    /**
     * Cierra la sesión.
     */
    async cerrarSesion(): Promise<void> {
        for (const pagina of this.paginaActiva.values()) {
            await pagina.close().catch(() => null)
        }
        this.paginaActiva.clear()

        if (this.context) {
            await this.context.close().catch(() => null)
            this.context = null
        }

        await BrowserManager.cerrar()
    }

    /**
     * Valida que el portal existe.
     * @private
     */
    private validarPortal(portalId: string): SatPortalConfig {
        const config = this.configProvider.obtenerConfiguracion(portalId)
        if (!config) {
            throw new Error(`Portal ${portalId} no encontrado`)
        }
        return config
    }

    /**
     * Obtiene o crea el contexto del navegador.
     * @private
     */
    private async obtenerContext(): Promise<BrowserContext> {
        if (!this.context) {
            this.context = await BrowserManager.newContext()
        }
        return this.context
    }

    /**
     * Crea una nueva página en el contexto.
     * @private
     */
    private async crearPagina(): Promise<Page> {
        const context = await this.obtenerContext()
        return await context.newPage()
    }

    /**
     * Llena el formulario CIEC.
     * @private
     */
    private async llenarFormularioCiec(
        pagina: Page,
        config: SatPortalConfig,
        credentials: CiecCredentials
    ): Promise<void> {
        await pagina.fill(config.selectors.rfcField, credentials.rfc)
        await pagina.fill(config.selectors.passwordField, credentials.password)

        if (credentials.captcha) {
            await pagina.fill(config.selectors.captchaField, credentials.captcha.toUpperCase())
        }
    }

    /**
     * Intenta hacer login con manejo de reintentos.
     * @private
     */
    private async intentarLogin(
        pagina: Page,
        config: SatPortalConfig,
        accion: () => Promise<void>,
        metodoAuth: AuthMethod,
        intento: number = 1
    ): Promise<void> {
        try {
            await this.esperarLoginExitoso(pagina, config, accion)
        } catch (error: any) {
            const esTimeout = error.message?.includes('Timeout') || error.message?.includes('timeout')
            const esCaptchaInvalido = error.message?.includes('CAPTCHA_INVALIDO')

            if ((esTimeout || esCaptchaInvalido) && intento < MAX_REINTENTOS) {
                console.log(
                    `[SatUnifiedAuthService] ${metodoAuth.toUpperCase()} intento ${intento}/${MAX_REINTENTOS}, reintentando en ${ESPERA_ENTRE_REINTENTOS_MS / 1000}s...`
                )

                await pagina.waitForTimeout(ESPERA_ENTRE_REINTENTOS_MS)
                await pagina.goto(config.loginUrl, { waitUntil: 'networkidle' })
                return this.intentarLogin(pagina, config, accion, metodoAuth, intento + 1)
            }

            throw error
        }
    }

    /**
     * Espera a que el login sea exitoso.
     * @private
     */
    private async esperarLoginExitoso(
        pagina: Page,
        _config: SatPortalConfig,
        accion: () => Promise<void>
    ): Promise<void> {
        const loginTimeoutPromise = new Promise<void>((resolve, reject) => {
            pagina.once('framenavigated', () => {
                resolve()
            })
            setTimeout(() => {
                reject(new Error('Timeout esperando respuesta del servidor'))
            }, 120000)
        })

        await accion()

        try {
            await Promise.race([
                loginTimeoutPromise,
                pagina.waitForNavigation({ timeout: 120000 }).catch(() => null),
                pagina.waitForURL('**', { timeout: 120000 }).catch(() => null)
            ])
        } catch {
            // Continuar incluso si hay error
        }

        // Validar si hubo error de captcha o credenciales
        try {
            const msgError = await pagina.evaluate(() => {
                const textos = [
                    document.body.innerText,
                    document.querySelector('.alert')?.textContent,
                    document.querySelector('.error')?.textContent,
                    document.querySelector('#msgError')?.textContent
                ].filter(t => t)

                return textos.join(' ').toLowerCase()
            })

            if (msgError.includes('captcha')) {
                throw new Error('CAPTCHA_INVALIDO')
            }
            if (msgError.includes('rfc') || msgError.includes('contraseña') || msgError.includes('acceso')) {
                throw new Error('CREDENCIALES_INVALIDAS')
            }
        } catch (error: any) {
            if (error.message?.includes('INVALIDO')) throw error
        }
    }
}
