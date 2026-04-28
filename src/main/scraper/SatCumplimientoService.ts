import { Page } from 'playwright'
import { join } from 'path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import fs from 'fs'

export interface OpinionCumplimiento {
    resultado: 'positivo' | 'negativo' | 'unknown'
    fecha_emision: string
    fecha_vigencia?: string
    descripcion: string
    rutaArchivo?: string
}

export type ProgresoCallback = (mensaje: string) => void

const CUMPLIMIENTO_PORTAL = 'https://ptsc32d.clouda.sat.gob.mx'
const LOGIN_DOMAIN = 'loginda.siat.sat.gob.mx'
const RUTA_REPORTE = 'https://ptsc32d.clouda.sat.gob.mx/#/reporteOpinion32DContribuyente'
const MAX_REINTENTOS = 3

export class SatCumplimientoService {

    async obtenerCaptcha(page: Page): Promise<{ imagenBase64: string }> {
        await page.goto(CUMPLIMIENTO_PORTAL, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForURL(`**${LOGIN_DOMAIN}**`, { timeout: 20000 })

        const captchaEl = await page.waitForSelector('img[src^="data:image"]', { timeout: 10000 })
        const screenshot = await captchaEl.screenshot({ type: 'png' })
        return { imagenBase64: `data:image/png;base64,${screenshot.toString('base64')}` }
    }

    async loginCiecYObtenerOpinion(
        page: Page,
        carpetaTemp: string,
        rfc: string,
        password: string,
        captcha: string,
        onProgreso?: ProgresoCallback
    ): Promise<OpinionCumplimiento> {
        const accionLogin = async () => {
            await this.llenarFormularioCiec(page, rfc, password, captcha)
        }
        return this.ejecutarFlujoOpinion(page, carpetaTemp, accionLogin, 'contrasena', onProgreso)
    }

    async loginFielYObtenerOpinion(
        page: Page,
        carpetaTemp: string,
        rutaCer: string,
        rutaKey: string,
        password: string,
        onProgreso?: ProgresoCallback
    ): Promise<OpinionCumplimiento> {
        const accionLogin = async () => {
            await this.llenarFormularioFiel(page, rutaCer, rutaKey, password)
        }
        return this.ejecutarFlujoOpinion(page, carpetaTemp, accionLogin, 'efirma', onProgreso)
    }

    // ---------------------------------------------------------------------------

    private async ejecutarFlujoOpinion(
        page: Page,
        carpetaTemp: string,
        accionLogin: () => Promise<void>,
        metodo: 'contrasena' | 'efirma',
        onProgreso?: ProgresoCallback
    ): Promise<OpinionCumplimiento> {
        try {
            onProgreso?.('Conectando con el SAT...')
            const pdfPromesa = this.configurarInterceptacionPdf(page, carpetaTemp)

            onProgreso?.('Iniciando sesión...')
            await this.intentarLogin(page, accionLogin, metodo)

            onProgreso?.('Generando reporte de cumplimiento...')
            const rutaArchivo = await this.navegarYCapturarReporte(page, pdfPromesa, onProgreso)

            onProgreso?.('Procesando resultado...')
            return this.formatearRespuesta(rutaArchivo)

        } catch (error: any) {
            return this.manejarError(metodo === 'contrasena' ? 'CIEC' : 'FIEL', error)
        }
    }

    private async intentarLogin(
        page: Page,
        accion: () => Promise<void>,
        metodoAuth: 'contrasena' | 'efirma',
        intento = 1
    ): Promise<void> {
        try {
            await accion()

            const resultado = await Promise.race([
                page.waitForSelector('.alert-danger, #msgError, #pnlError', { timeout: 7000 })
                    .then(async (el) => ({ tipo: 'ERROR', texto: await el?.innerText() })),
                page.waitForSelector('a[href*="Logout"], .separador-menu, #header', { timeout: 20000 })
                    .then(() => ({ tipo: 'EXITO', texto: null })),
                page.waitForURL(`**/ptsc32d.clouda.sat.gob.mx/#/`, { timeout: 20000 })
                    .then(() => ({ tipo: 'EXITO', texto: null }))
            ])

            if (resultado?.tipo === 'ERROR') {
                const txt = resultado.texto?.toLowerCase() || ''
                if (txt.includes('captcha')) throw new Error('CAPTCHA_INVALIDO')
                if (txt.includes('rfc') || txt.includes('contraseña') || txt.includes('acceso'))
                    throw new Error('CREDENCIALES_INVALIDAS')
                throw new Error(resultado.texto || 'ERROR_DESCONOCIDO_SAT')
            }

            console.log('[SatCumplimientoService] Login verificado con éxito')

        } catch (error: any) {
            if (error.message === 'CAPTCHA_INVALIDO' || error.message === 'CREDENCIALES_INVALIDAS') {
                throw error
            }

            const esTimeout = error.message?.toLowerCase().includes('timeout')

            if (esTimeout && intento < MAX_REINTENTOS) {
                console.log(`[SatCumplimientoService] Timeout (intento ${intento}/${MAX_REINTENTOS}), verificando estado...`)

                const estaAdentro = await page.evaluate(() =>
                    document.body.innerText.includes('Cerrar sesión') || !!document.querySelector('.separador-menu')
                ).catch(() => false)

                if (estaAdentro) {
                    console.log('[SatCumplimientoService] Ya estamos adentro, continuando...')
                    return
                }

                await page.goto(CUMPLIMIENTO_PORTAL, { waitUntil: 'networkidle' })
                return this.intentarLogin(page, accion, metodoAuth, intento + 1)
            }

            throw error
        }
    }

    private async navegarYCapturarReporte(
        page: Page,
        pdfPromesa: Promise<string | undefined>,
        onProgreso?: ProgresoCallback
    ): Promise<string | undefined> {
        await page.waitForURL(`**ptsc32d.clouda.sat.gob.mx**`, { timeout: 20000 })
        await page.waitForTimeout(2000)

        onProgreso?.('Descargando PDF de opinión...')
        await page.goto(RUTA_REPORTE, { waitUntil: 'commit', timeout: 45000 })
        await page.waitForSelector('sat-mf-reporte-opinion-contribuyente-root', { timeout: 30000 }).catch(() => null)

        return await pdfPromesa
    }

    private async configurarInterceptacionPdf(
        page: Page,
        carpetaTemp: string
    ): Promise<string | undefined> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                page.removeListener('response', handler)
                resolve(undefined)
            }, 60000)

            const handler = async (response: any) => {
                const url = response.url()
                const contentType = (response.headers()['content-type'] || '').toLowerCase()

                if (url.includes('GeneraOpinion') || contentType.includes('pdf')) {
                    try {
                        const buffer = await response.body()
                        if (buffer.length > 5000) {
                            const rutaFinal = join(carpetaTemp, `opinion_${Date.now()}.pdf`)
                            fs.writeFileSync(rutaFinal, buffer)
                            clearTimeout(timer)
                            page.removeListener('response', handler)
                            resolve(rutaFinal)
                        }
                    } catch { }
                }
            }
            page.on('response', handler)
        })
    }

    private async formatearRespuesta(rutaArchivo?: string): Promise<OpinionCumplimiento> {
        let resultado: 'positivo' | 'negativo' | 'unknown' = 'unknown'

        if (rutaArchivo) {
            resultado = await this.determinarResultadoDesdePdf(rutaArchivo)
        }

        return {
            resultado,
            fecha_emision: new Date().toISOString(),
            descripcion: rutaArchivo ? 'Procesado con éxito.' : 'Error: PDF no capturado.',
            rutaArchivo
        }
    }

    private manejarError(tipo: string, error: any): OpinionCumplimiento {
        const msg = error.message || 'Error desconocido'
        console.error(`[SatCumplimientoService] ${tipo}: ${msg}`)
        return {
            resultado: 'unknown',
            fecha_emision: new Date().toISOString(),
            descripcion: `FALLO_${tipo}: ${msg}`
        }
    }

    private async determinarResultadoDesdePdf(
        ruta: string
    ): Promise<'positivo' | 'negativo' | 'unknown'> {
        try {
            const buffer = fs.readFileSync(ruta)
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
            const pdf = await loadingTask.promise

            let textoCompleto = ''
            for (let i = 1; i <= pdf.numPages; i++) {
                const pagina = await pdf.getPage(i)
                const content = await pagina.getTextContent()
                textoCompleto += content.items.map((item: any) => item.str).join(' ') + '\n'
            }

            const texto = textoCompleto.toUpperCase()
            if (texto.includes('POSITIVO')) return 'positivo'
            if (texto.includes('NEGATIVO')) return 'negativo'
            return 'unknown'

        } catch (error) {
            console.error('[SatCumplimientoService] Error procesando PDF:', error)
            return 'unknown'
        }
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