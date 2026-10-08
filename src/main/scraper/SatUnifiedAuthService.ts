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
import { logger } from '../services/LoggerService'
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
            // domcontentloaded basta: el formulario es HTML del servidor y el
            // captcha viene inline (data:image). networkidle puede "no resolver"
            // nunca si el SAT mantiene conexiones abiertas.
            await pagina.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

            // ¿Las cookies guardadas siguen vivas? Si el IDP redirige al portal y
            // no muestra el formulario, no hay nada que pedirle al usuario.
            if (await this.detectarSesionActiva(pagina, config)) {
                logger.log('sat-auth', `${portalId}: sesión SAT vigente (cookies reanudadas) — sin captcha`)
                return { imagenBase64: '', sesionActiva: true, timestamp: Date.now() }
            }

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
            // Página en blanco (no vino del flujo de captcha): navegar al login.
            if (!/^https?:/i.test(pagina.url())) {
                await pagina.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
            }

            // Sesión vigente (cookies reanudadas): no se vuelve a pedir ni a enviar login.
            if (await this.detectarSesionActiva(pagina, config)) {
                logger.log('sat-auth', `${portalId}: sesión SAT vigente, se omite login CIEC`)
                return pagina
            }

            // Llenar formulario CIEC
            await this.llenarFormularioCiec(pagina, config, credentials)

            // Intentar login
            await this.intentarLogin(
                pagina,
                config,
                () => pagina!.click(config.selectors.submitButton, { timeout: 90000 }),
                'ciec'
            )

            logger.log('sat-auth', `${portalId}: login CIEC exitoso`)
            // Mantener la página abierta para operaciones posteriores
            return pagina
        } catch (error) {
            // No cerrar la página aquí - se cerrará en cerrarSesion()
            logger.error('sat-auth', `${portalId}: login CIEC falló`, { error: String(error) })
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
            await pagina.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

            // Sesión vigente (cookies reanudadas): el IDP no muestra el formulario.
            if (await this.detectarSesionActiva(pagina, config)) {
                logger.log('sat-auth', `${portalId}: sesión SAT vigente, se omite login e.firma`)
                return pagina
            }

            // Cambio a e.firma con reintentos: el botón del SAT se habilita por JS
            // asíncrono y un clic antes de que cargue no surte efecto (no navega al
            // formulario e.firma). Se verifica que el formulario realmente aparezca.
            const hayFormularioFiel = (): Promise<boolean> =>
                pagina
                    .waitForSelector(config.selectors.cerFileInput, { state: 'attached', timeout: 3500 })
                    .then(() => true)
                    .catch(() => false)

            if (!(await hayFormularioFiel()) && config.selectors.fielButton) {
                const MAX_INTENTOS_FIEL = 4
                for (let i = 0; i < MAX_INTENTOS_FIEL; i++) {
                    try {
                        await pagina.click(config.selectors.fielButton, { timeout: 8000 })
                    } catch {
                        // El clic puede no surtir efecto si el JS del SAT aún no carga;
                        // el siguiente intento del bucle lo repite.
                    }
                    await pagina.waitForTimeout(1200)
                    if (await hayFormularioFiel()) break
                }
            }

            const formularioFiel = await pagina
                .waitForSelector(config.selectors.cerFileInput, { state: 'attached', timeout: 5000 })
                .catch(() => null)
            if (!formularioFiel) {
                throw new Error(
                    'No se encontró el formulario de e.firma. El SAT pudo haber cambiado su página de acceso o haberse ' +
                    'reiniciado; verifica tu configuración de e.firma (.cer/.key) y vuelve a intentar.'
                )
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

            logger.log('sat-auth', `${portalId}: login e.firma exitoso`)
            // Mantener la página abierta para operaciones posteriores
            return pagina
        } catch (error) {
            // No cerrar la página aquí - se cerrará en cerrarSesion()
            logger.error('sat-auth', `${portalId}: login e.firma falló`, { error: String(error) })
            throw error
        }
    }

    /**
     * Cierra la sesión.
     */
    async cerrarSesion(): Promise<void> {
        // Persistir la sesión SAT antes de destruir el contexto: la próxima
        // ejecución reutiliza las cookies y no vuelve a pedir credenciales.
        if (this.context) {
            try {
                await this.context.storageState({ path: BrowserManager.sesionSatFile })
                logger.log('sat-auth', `Sesión SAT guardada en ${BrowserManager.sesionSatFile}`)
            } catch (error) {
                logger.warn('sat-auth', `No se pudo guardar la sesión SAT: ${String(error)}`)
            }
        }

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
     * Detecta si la página ya tiene sesión vigente en el portal: la URL es
     * http(s) y NO se muestra el formulario de login (rfc/e.firma). Pasa cuando
     * las cookies reanudadas redirigen al portal en vez de pedir credenciales.
     * @private
     */
    private async detectarSesionActiva(pagina: Page, config: SatPortalConfig): Promise<boolean> {
        if (!/^https?:/i.test(pagina.url())) return false // about:blank u otras
        const selectores = [config.selectors.rfcField, config.selectors.cerFileInput]
            .filter(Boolean)
            .join(', ')
        if (!selectores) return false
        const hayFormulario = await pagina
            .waitForSelector(selectores, { timeout: 8000 })
            .then(() => true)
            .catch(() => false)
        return !hayFormulario
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
            await this.esperarLoginExitoso(pagina, config, accion, metodoAuth)
        } catch (error: any) {
            const esTimeout = error.message?.includes('Timeout') || error.message?.includes('timeout')
            const esCaptchaInvalido = error.message?.includes('CAPTCHA_INVALIDO')

            // Un captcha incorrecto rellena el MISMO texto sobre una imagen nueva:
            // reintentar es fútil, y el goto intermedio puede incluso enviar un
            // formulario en blanco al SAT ("campos requeridos"). Se falla rápido
            // para que el usuario recargue el captcha e intente de nuevo.
            if (esCaptchaInvalido) {
                throw error
            }

            // e.firma: NO reintentar con el goto genérico. Ese reintento navega a la
            // página CIEC y re-ejecuta el clic sobre un formulario vacío (basura).
            // El primer intento ya tiene un tope generoso; si el SAT no respondió,
            // fallar con un mensaje claro y dejar que el usuario reintente la descarga.
            if (esTimeout && metodoAuth === 'fiel') {
                throw new Error(
                    'El SAT tardó demasiado en responder el inicio de sesión con e.firma ' +
                    '(el SAT puede estar saturado). Cierra la ventana del navegador que se abrió ' +
                    'y vuelve a intentar la descarga.'
                )
            }

            if (esTimeout && intento < MAX_REINTENTOS) {
                console.log(
                    `[SatUnifiedAuthService] ${metodoAuth.toUpperCase()} intento ${intento}/${MAX_REINTENTOS}, reintentando en ${ESPERA_ENTRE_REINTENTOS_MS / 1000}s...`
                )

                await pagina.waitForTimeout(ESPERA_ENTRE_REINTENTOS_MS)
                await pagina.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
                return this.intentarLogin(pagina, config, accion, metodoAuth, intento + 1)
            }

            throw error
        }
    }

    /**
     * Espera a que el login sea exitoso.
     *
     * Por qué NO se usa waitForURL('**') para detectar "hubo navegación":
     * waitForURL con un glob que ya coincide con la URL actual resuelve al
     * instante (~4ms), ANTES de que el SAT responda el POST del login. Eso hacía
     * que el login "terminara" sin haber terminado y la operación posterior
     * muriera con timeout esperando el dominio del portal.
     *
     * El criterio es determinista:
     * - EXITO  → la URL llega al dominio del portal (el login del SAT ocurre en
     *            loginda/login.siat/cfdiau, NUNCA en el dominio del portal).
     * - ERROR  → el SAT recarga la página de login mostrando #msgError/.alert.
     * @private
     */
    private async esperarLoginExitoso(
        pagina: Page,
        config: SatPortalConfig,
        accion: () => Promise<void>,
        metodoAuth: AuthMethod = 'ciec'
    ): Promise<void> {
        // El SAT e.firma tarda más que CIEC en firmar y redirigir; con el SAT lento,
        // un tope corto mataría un login que SÍ iba a completarse. La detección de
        // errores reales es inmediata (rama de error), así que el tope largo solo
        // aplica a logins estancados.
        const TIEMPO_LOGIN = metodoAuth === 'fiel' ? 300000 : 120000

        const dominioDestino = config.portalDomain || config.loginDomain
        // El logueo del SAT ocurre en loginda/login.siat/cfdiau, NUNCA en el host
        // del portal. Pero la URL del login SÍ contiene el host del portal dentro
        // del parámetro encodificado target/redirect_uri (ej. loginda...?...,
        // &target=...ptsc32d.clouda.sat.gob.mx...), por lo que un glob
        // ('**dominio**') da falsos "éxito". Se ancla al INICIO de la URL: solo
        // cuenta como éxito cuando la página YA tiene al portal como host real.
        const hostExito = new RegExp(
            `^https?://${dominioDestino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[/:?#]|$)`,
            'i'
        )

        // Disparar la acción SIN bloquear la detección: el clic en "Enviar" del SAT
        // puede quedarse esperando actionability (overlay de carga) mientras la página
        // procesa la firma; el resultado del login NO debe depender de que ese clic
        // "termine". Si el clic falla, la carrera de detección decide el resultado.
        Promise.resolve().then(accion).catch(() => false)

        const espera = await Promise.race([
            // Éxito: la URL llega al portal tras el login (redirección OAuth, dashboard)
            pagina
                .waitForURL(hostExito, { timeout: TIEMPO_LOGIN })
                .then(() => 'exito' as const)
                .catch(() => 'timeout' as const),
            // Éxito alterno: el formulario de login desapareció y la ruta ya no es la
            // del IDP (/nidp/). Cubre portales donde el destino NO cambia de host
            // (cfdiau) sin caer en falsos éxitos: un reload por errores sigue en /nidp/
            // y mantiene #submit.
            pagina
                .waitForFunction(
                    ({ selLogin, pathNidp }) => {
                        if (document.querySelector(selLogin)) return false
                        return !location.pathname.startsWith(pathNidp)
                    },
                    { selLogin: '#submit', pathNidp: '/nidp' },
                    { timeout: TIEMPO_LOGIN, polling: 500 }
                )
                .then(() => 'exito' as const)
                .catch(() => 'timeout' as const),
            // Error REAL: mensaje visible con contenido de error. Un .alert-danger
            // vacío o transitorio (la página e.firma de cfdiau muestra uno mientras
            // valida la firma) NO cuenta como fallo.
            pagina
                .waitForFunction(
                    ({ selErrores, rxErrores }) => {
                        for (const sel of selErrores) {
                            const el = document.querySelector(sel)
                            if (!el) continue
                            const r = (el as HTMLElement).getBoundingClientRect()
                            if (r.width <= 0 || r.height <= 0) continue
                            const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
                            if (t && rxErrores.test(t.toLowerCase())) {
                                return t
                            }
                        }
                        return null
                    },
                    {
                        selErrores: ['#msgError', '.alert-danger', '#pnlError', '.error'],
                        rxErrores:
                            /captcha|contrase|password|rfc|clave|llave|credencial|usuario|incorrect|invál|no válid|vigencia|caduc|firma|certificado|imagen|no es correct|requerid|obligator/
                    },
                    { timeout: TIEMPO_LOGIN, polling: 500 }
                )
                .then(async (handle) => {
                    const texto = handle ? String((await handle.jsonValue()) || '') : ''
                    return { tipo: 'error' as const, texto }
                })
                .catch(() => 'timeout' as const),
            new Promise<'timeout'>((resolve) =>
                setTimeout(() => resolve('timeout' as const), TIEMPO_LOGIN)
            )
        ])

        if (espera === 'exito') return
        if (espera === 'timeout') {
            throw new Error('Timeout esperando respuesta del servidor')
        }

        const texto = (espera.texto || '').toLowerCase()
        if (texto.includes('captcha')) {
            throw new Error('CAPTCHA_INVALIDO')
        }
        if (
            texto.includes('rfc') ||
            texto.includes('contraseña') ||
            texto.includes('password') ||
            texto.includes('acceso')
        ) {
            throw new Error('CREDENCIALES_INVALIDAS')
        }
        throw new Error(`El SAT rechazó el inicio de sesión: ${espera.texto}`)
    }
}
