import { BrowserContext, Page } from 'playwright'
import { BrowserManager } from './BrowserManager'

export interface DatosCaptcha {
  imagenBase64: string
}

const MAX_REINTENTOS = 3
const ESPERA_ENTRE_REINTENTOS_MS = 5000

export class SatAuthService {
  private paginaLogin: Page | null = null

  constructor(private readonly context: BrowserContext) { }

  async obtenerCaptcha(): Promise<DatosCaptcha> {
    if (this.paginaLogin) {
      await this.paginaLogin.close()
      this.paginaLogin = null
    }

    this.paginaLogin = await this.context.newPage()
    await this.paginaLogin.goto('https://portalcfdi.facturaelectronica.sat.gob.mx/')
    await this.paginaLogin.waitForSelector('#divCaptcha', { timeout: 15000 })

    const imagenBase64 = await this.paginaLogin.$eval(
      '#divCaptcha img',
      (img) => (img as HTMLImageElement).src
    )

    return { imagenBase64 }
  }

  async loginConContrasena(rfc: string, password: string, captcha: string): Promise<Page> {
    if (!this.paginaLogin) {
      throw new Error('Primero debes cargar el captcha')
    }

    const page = this.paginaLogin
    this.paginaLogin = null

    await page.fill('#rfc', rfc)
    await page.fill('#password', password)
    await page.fill('#userCaptcha', captcha.toUpperCase())

    await this.intentarLogin(page, () => page.click('#submit', { timeout: 90000 }), 'contrasena')
    return page
  }

  async loginConEfirma(rutaCer: string, rutaKey: string, contrasenaFiel: string): Promise<Page> {
    const page = this.paginaLogin ?? await this.context.newPage()
    this.paginaLogin = null

    if (!page.url().includes('portalcfdi')) {
      await page.goto('https://portalcfdi.facturaelectronica.sat.gob.mx/')
    }

    await page.waitForSelector('#buttonFiel', { timeout: 15000 })
    await page.click('#buttonFiel')
    await page.waitForSelector('#fileCertificate', { timeout: 10000 })

    await page.setInputFiles('#fileCertificate', rutaCer)
    await page.setInputFiles('#filePrivateKey', rutaKey)
    await page.fill('#privateKeyPassword', contrasenaFiel)

    await this.intentarLogin(page, () => page.click('#submit', { timeout: 90000 }), 'efirma')
    return page
  }

  // Orquesta reintentos — no sabe de SAT, solo reintenta si es timeout
  private async intentarLogin(
    page: Page,
    accion: () => Promise<void>,
    metodoAuth: 'contrasena' | 'efirma',
    intento = 1
  ): Promise<void> {
    try {
      await this.esperarLoginExitoso(page, accion)
    } catch (error: any) {
      const esTimeout = error.message?.includes('Timeout') || error.message?.includes('timeout')
      const esCaptchaInvalido = error.message?.includes('CAPTCHA_INVALIDO')
      const esSaturado = error.message?.includes('SAT_SATURADO')

      if (esCaptchaInvalido || esSaturado) throw error

      // Con contraseña el captcha ya no sirve — falla inmediato
      if (esTimeout && metodoAuth === 'contrasena') {
        throw new Error('SAT_TIMEOUT')
      }

      // Con e.firma se puede reintentar
      if (esTimeout && intento < MAX_REINTENTOS) {
        console.log(`Login timeout (intento ${intento}/${MAX_REINTENTOS}), reintentando en ${ESPERA_ENTRE_REINTENTOS_MS / 1000}s...`)
        await page.waitForTimeout(ESPERA_ENTRE_REINTENTOS_MS)
        await page.goto('https://portalcfdi.facturaelectronica.sat.gob.mx/')
        await page.waitForSelector('#divCaptcha', { timeout: 15000 })
        return this.intentarLogin(page, accion, metodoAuth, intento + 1)
      }

      if (esTimeout) throw new Error('SAT_TIMEOUT')
      throw error
    }
  }
  // Hace una sola cosa: esperar que el login complete y verificar resultado
  private async esperarLoginExitoso(page: Page, accion: () => Promise<void>): Promise<void> {
    await Promise.all([
      page.waitForNavigation({ timeout: 90000 }).catch(() => null),
      accion()
    ])

    await page.waitForTimeout(4000)

    const url = page.url()
    console.log('URL después de login:', url)

    const esPaginaError = await page.$('text=Ha ocurrido un error al procesar').catch(() => null)
    if (esPaginaError) throw new Error('SAT_SATURADO')

    const errorCaptcha = await page.$('#divCapError, .alert-danger, .mensaje-error').catch(() => null)
    if (errorCaptcha) {
      const textoError = await errorCaptcha.textContent().catch(() => '')
      throw new Error(`CAPTCHA_INVALIDO: ${textoError?.trim()}`)
    }

    const llegamosAlPortal = url.includes('portalcfdi.facturaelectronica.sat.gob.mx')
      && !url.includes('login')
      && !url.includes('Login')

    if (!llegamosAlPortal) {
      const mensajeError = await page.$eval(
        '.alert, .error, [class*="error"], [class*="Error"]',
        (el) => el.textContent?.trim()
      ).catch(() => null)

      throw new Error(mensajeError || 'Login fallido: no se pudo acceder al portal')
    }

    console.log('Login exitoso')
  }

  async logout(page: Page): Promise<void> {
    try {
      await page.click('#salir')
    } finally {
      await page.close()
    }
  }

  async cerrarSesion(): Promise<void> {
    if (this.paginaLogin) {
      await this.paginaLogin.close().catch(() => null)
      this.paginaLogin = null
    }
    await BrowserManager.cerrar()
  }
}