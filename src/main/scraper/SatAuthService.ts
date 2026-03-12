import { BrowserContext, Page } from 'playwright'

export interface DatosCaptcha {
  imagenBase64: string
}

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

    await this.esperarLoginExitoso(page, () => page.click('#submit'))
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

    await this.esperarLoginExitoso(page, () => page.click('#submit'))
    return page
  }

  private async esperarLoginExitoso(page: Page, accion: () => Promise<void>): Promise<void> {
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }).catch(() => null),
      accion()
    ])

    await page.waitForTimeout(2000)

    const url = page.url()
    console.log('URL después de login:', url)

    // Detectar saturación del SAT
    const esPaginaError = await page.$('text=Ha ocurrido un error al procesar').catch(() => null)
    if (esPaginaError) {
      throw new Error('SAT_SATURADO')
    }

    // Detectar captcha incorrecto o credenciales inválidas
    const errorCaptcha = await page.$('#divCapError, .alert-danger, .mensaje-error').catch(() => null)
    if (errorCaptcha) {
      const textoError = await errorCaptcha.textContent().catch(() => '')
      throw new Error(`CAPTCHA_INVALIDO: ${textoError?.trim()}`)
    }

    // Verificar que realmente llegamos al portal
    const llegamosAlPortal = url.includes('portalcfdi.facturaelectronica.sat.gob.mx')
      && !url.includes('login')
      && !url.includes('Login')

    if (!llegamosAlPortal) {
      // Intentar detectar cualquier mensaje de error en la página
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

  async loginConContrasenaDirecto(rfc: string, password: string, captcha: string): Promise<Page> {
    const page = await this.context.newPage()
    await page.goto('https://portalcfdi.facturaelectronica.sat.gob.mx/')
    await page.waitForSelector('#divCaptcha', { timeout: 15000 })

    await page.fill('#rfc', rfc)
    await page.fill('#password', password)
    await page.fill('#userCaptcha', captcha.toUpperCase())

    await this.esperarLoginExitoso(page, () => page.click('#submit'))
    return page
  }
}