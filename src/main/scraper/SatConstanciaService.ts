import { Page, Frame } from 'playwright'
import { join } from 'path'
import fs from 'fs'

export interface ConstanciaSituacionFiscal {
  rfc: string
  fecha_emision: string
  rutaArchivo?: string
  descripcion: string
}

export type ProgresoCallback = (mensaje: string) => void

const LOGIN_URL = 'https://wwwmat.sat.gob.mx/app/seg/faces/pages/lanzador.jsf?url=/operacion/43824/reimprime-tus-acuses-del-rfc&tipoLogeo=c&target=principal&hostServer=https://wwwmat.sat.gob.mx'
const LOGIN_DOMAIN = 'login.siat.sat.gob.mx'
const PORTAL_DOMAIN = 'wwwmat.sat.gob.mx'
const PORTAL_REPORTE = 'https://wwwmat.sat.gob.mx/operacion/43824/reimprime-tus-acuses-del-rfc'

export class SatConstanciaService {

  async obtenerCaptcha(page: Page): Promise<{ imagenBase64: string }> {
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForURL(`**${LOGIN_DOMAIN}**`, { timeout: 20000 })
    await page.waitForLoadState('networkidle')

    const captchaEl = await page.waitForSelector('img[src^="data:image"]', { timeout: 10000 })
    const screenshot = await captchaEl.screenshot({ type: 'png' })
    return { imagenBase64: `data:image/png;base64,${screenshot.toString('base64')}` }
  }

  async loginCiecYObtenerConstancia(
    page: Page,
    carpetaTemp: string,
    rfc: string,
    password: string,
    captcha: string,
    onProgreso?: ProgresoCallback
  ): Promise<ConstanciaSituacionFiscal> {
    return this.ejecutarFlujoConstancia(
      page, carpetaTemp,
      () => this.llenarFormularioCiec(page, rfc, password, captcha),
      'CIEC', rfc, onProgreso
    )
  }

  async loginFielYObtenerConstancia(
    page: Page,
    carpetaTemp: string,
    rfc: string,
    rutaCer: string,
    rutaKey: string,
    password: string,
    onProgreso?: ProgresoCallback
  ): Promise<ConstanciaSituacionFiscal> {
    return this.ejecutarFlujoConstancia(
      page, carpetaTemp,
      () => this.llenarFormularioFiel(page, rutaCer, rutaKey, password),
      'FIEL', rfc, onProgreso
    )
  }

  // ---------------------------------------------------------------------------

  private async ejecutarFlujoConstancia(
    page: Page,
    carpetaTemp: string,
    accionLogin: () => Promise<void>,
    metodo: string,
    rfc: string,
    onProgreso?: ProgresoCallback
  ): Promise<ConstanciaSituacionFiscal> {
    try {
      onProgreso?.('Conectando con el SAT...')

      if (!page.url().includes(LOGIN_DOMAIN)) {
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForURL(`**${LOGIN_DOMAIN}**`, { timeout: 20000 })
      }

      onProgreso?.(`Iniciando sesión con ${metodo}...`)
      await accionLogin()

      await page.waitForURL('**', { timeout: 40000 })
      console.log(`[SatConstanciaService] URL después de login: ${page.url()}`)

      onProgreso?.('Accediendo al portal de constancias...')
      await page.waitForURL(`**${PORTAL_DOMAIN}**`, { timeout: 40000 })
      await page.waitForLoadState('networkidle', { timeout: 20000 })

      if (!page.url().includes('/operacion/43824')) {
        await page.goto(PORTAL_REPORTE, { waitUntil: 'networkidle', timeout: 30000 })
      }

      if (page.url().includes('error.seg')) {
        throw new Error('El SAT rechazó el acceso al portal. Intenta de nuevo en unos minutos.')
      }

      onProgreso?.('Generando constancia...')
      const frame = await this.obtenerFrameConstancia(page)
      const boton = frame.locator('button:has-text("Generar Constancia"), input[value="Generar Constancia"]')
      await boton.waitFor({ state: 'visible', timeout: 20000 })

      onProgreso?.('Descargando PDF...')
      const rutaArchivo = await this.interceptarYDescargar(page, boton, carpetaTemp)


      // Cerrar cualquier página extra que haya quedado abierta (popups, viewers)
      const paginas = page.context().pages()
      for (const p of paginas) {
        if (p !== page) { await p.close().catch(() => null) }
      }

      return {
        rfc,
        fecha_emision: new Date().toISOString(),
        rutaArchivo,
        descripcion: rutaArchivo
          ? 'Constancia generada y descargada correctamente.'
          : 'No se pudo capturar el PDF automáticamente.'
      }
    } catch (error: any) {
      console.error(`[SatConstanciaService] ${metodo}:`, error)
      return {
        rfc,
        fecha_emision: new Date().toISOString(),
        descripcion: `Error: ${error.message || 'Error desconocido'}`
      }
    }
  }

  /**
   * Registra el interceptor de ruta ANTES del clic para atrapar el PDF
   * cuando el botón abre el popup con IdcGeneraConstancia.jsf.
   * Cierra el popup automáticamente tras capturar el buffer.
   */
  private interceptarYDescargar(
    page: Page,
    boton: ReturnType<Frame['locator']>,
    carpetaTemp: string
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      let resuelto = false
      let popupRef: Page | null = null

      const limpiar = () => {
        page.context().unroute('**IdcGeneraConstancia**').catch(() => null)
      }

      const timer = setTimeout(() => {
        limpiar()
        resolve(undefined)
      }, 30000)

      page.context().route('**IdcGeneraConstancia**', async (route) => {
        try {
          const response = await route.fetch()
          const contentType = response.headers()['content-type'] ?? ''

          if (contentType.includes('pdf')) {
            const buffer = Buffer.from(await response.body())
            if (buffer.length > 5000 && !resuelto) {
              resuelto = true
              const rutaFinal = join(carpetaTemp, `constancia_${Date.now()}.pdf`)
              fs.writeFileSync(rutaFinal, buffer)
              console.log('[SatConstanciaService] Constancia capturada:', rutaFinal)
              clearTimeout(timer)
              limpiar()
              await route.fulfill({ response }).catch(() => null)
              await popupRef?.close().catch(() => null)
              resolve(rutaFinal)
              return
            }
          }

          await route.fulfill({ response }).catch(() => null)
        } catch {
          await route.abort().catch(() => null)
        }
      })

      // once DESPUÉS del route y ANTES del clic
      page.context().once('page', (p) => { popupRef = p })

      boton.click().catch(() => null)
    })
  }
  private async obtenerFrameConstancia(page: Page): Promise<Frame> {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)
    const iframeEl = await page.waitForSelector('#iframetoload', { timeout: 15000 })
    const frame = await iframeEl.contentFrame()
    if (!frame) throw new Error('No se pudo acceder al iframe de constancias')
    await frame.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)
    return frame
  }

  private async llenarFormularioCiec(
    page: Page,
    rfc: string,
    password: string,
    captcha: string
  ): Promise<void> {
    await page.waitForSelector('#rfc', { timeout: 10000 })
    await page.fill('#rfc', rfc)
    await page.fill('#password', password)

    const captchaSelector = 'input[id*="captcha" i], input[name*="captcha" i], input[placeholder*="captcha" i]'
    await page.waitForSelector(captchaSelector, { timeout: 5000 })
    await page.click(captchaSelector)
    await page.fill(captchaSelector, '')
    await page.type(captchaSelector, captcha, { delay: 50 })
    await page.click('#submit')
  }

  private async llenarFormularioFiel(
    page: Page,
    rutaCer: string,
    rutaKey: string,
    password: string
  ): Promise<void> {
    const tabFiel = page.locator('a:has-text("e.firma")')
    if (await tabFiel.count() > 0) await tabFiel.first().click()

    await page.setInputFiles('input[accept*=".cer"]', rutaCer)
    await page.setInputFiles('input[accept*=".key"]', rutaKey)
    await page.fill('input[type="password"]', password)
    await page.click('#submit')
  }
}