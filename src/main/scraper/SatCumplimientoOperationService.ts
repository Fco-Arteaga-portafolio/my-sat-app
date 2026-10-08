/**
 * SatCumplimientoOperationService.ts
 * 
 * Implementación específica para la operación de Opinión de Cumplimiento.
 * Hereda de SatPortalOperationService y reutiliza la autenticación.
 */

import * as fs from 'fs'
import { join } from 'path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import { BrowserContext, Page } from 'playwright'
import { logger } from '../services/LoggerService'
import { SatPortalOperationService } from './SatPortalOperationService'
import { SatUnifiedAuthService } from './SatUnifiedAuthService'
import { IPortalConfigProvider, SatOperationResult, SatCredentials, SatOperationOptions } from './SatPortalConfig'

export interface OpinionCumplimiento extends SatOperationResult {
    resultado: 'positivo' | 'negativo' | 'unknown'
    fecha_vigencia?: string
    rutaArchivo?: string
}

export class SatCumplimientoOperationService extends SatPortalOperationService {
    constructor(configProvider: IPortalConfigProvider, authService: SatUnifiedAuthService) {
        super('cumplimiento', configProvider, authService)
    }

    /**
     * Ejecuta la operación de obtener opinión de cumplimiento.
     */
    protected async ejecutarOperacion(
        _credenciales: SatCredentials,
        options: SatOperationOptions
    ): Promise<OpinionCumplimiento> {
        if (!this.paginaActiva) {
            throw new Error('No hay página activa')
        }

        const config = this.configProvider.obtenerConfiguracion(this.portalId)!

        try {
            options.onProgreso?.('Configurando descarga de PDF...')
            const pdfPromesa = this.configurarInterceptacionPdf(
                this.paginaActiva,
                options.carpetaTemp
            )
            // Si la operación muere antes de esperar la promesa, que su rechazo
            // posterior no se quede como unhandled rejection.
            pdfPromesa.catch(() => null)

            options.onProgreso?.('Navegando al portal de cumplimiento...')
            await this.paginaActiva.waitForURL(`**${config.portalDomain}**`, { timeout: 20000 })
            logger.log('sat-cumplimiento', 'Portal alcanzado tras login', { url: this.paginaActiva.url() })
            await this.paginaActiva.waitForTimeout(2000)

            options.onProgreso?.('Descargando opinión...')
            await this.paginaActiva.goto(config.portalRoute || config.baseUrl, {
                waitUntil: 'commit',
                timeout: 45000
            })
            logger.log('sat-cumplimiento', 'Ruta de opinión solicitada', {
                ruta: config.portalRoute || config.baseUrl
            })

            await this.paginaActiva
                .waitForSelector('sat-mf-reporte-opinion-contribuyente-root', { timeout: 30000 })
                .catch(() => null)

            const rutaArchivo = await pdfPromesa

            options.onProgreso?.('Procesando resultado...')
            const resultado = await this.formatearRespuesta(rutaArchivo)

            return resultado
        } catch (error) {
            throw error
        }
    }

    /**
     * Configura el interceptor para capturar el PDF.
     *
     * Se suscribe a nivel de CONTEXTO (no de página): si el SAT abre el PDF en
     * una pestaña nueva, la respuesta viaja por esa página y un listener de la
     * página principal nunca la vería. Si el cuerpo no se puede leer (visor de
     * PDF de Chromium que pide el archivo por rangos), se reintenta una vez con
     * una petición directa usando las cookies de la sesión.
     *
     * Si el SAT no entrega el PDF en 60 s, la promesa se RECHAZA (error real,
     * no un "éxito" sin archivo).
     * @private
     */
    private configurarInterceptacionPdf(
        page: Page,
        carpetaTemp: string
    ): Promise<string> {
        const context = page.context()
        const candidatos: Array<Record<string, any>> = []
        let resuelto = false
        let reintentoHecho = false

        return new Promise<string>((resolve, reject) => {
            const limpiar = (): void => {
                clearTimeout(timer)
                context.removeListener('response', handler)
            }

            const guardar = (buffer: Buffer): boolean => {
                try {
                    const rutaFinal = join(carpetaTemp, `opinion_${Date.now()}.pdf`)
                    fs.writeFileSync(rutaFinal, buffer)
                    logger.log('sat-cumplimiento', 'PDF de opinión capturado', { ruta: rutaFinal, bytes: buffer.length })
                    limpiar()
                    resolve(rutaFinal)
                    return true
                } catch (error) {
                    logger.warn('sat-cumplimiento', 'No se pudo guardar el PDF capturado', { error: String(error) })
                    return false
                }
            }

            const timer = setTimeout(() => {
                if (resuelto) return
                limpiar()
                logger.warn('sat-cumplimiento', 'Tiempo agotado sin capturar el PDF', {
                    url: page.url(),
                    candidatos
                })
                reject(
                    new Error(
                        'El SAT no entregó el PDF de la opinión dentro del tiempo límite. ' +
                        'Vuelve a intentarlo; si persiste, exporta los logs de soporte desde Soporte.'
                    )
                )
            }, 60000)

            const handler = async (response: any) => {
                if (resuelto) return
                const url = response.url()
                const contentType = (response.headers()['content-type'] || '').toLowerCase()
                const esPdf =
                    url.includes('GeneraOpinion') ||
                    contentType.includes('pdf') ||
                    url.toLowerCase().includes('.pdf')
                if (!esPdf) return

                let buffer: Buffer | undefined
                try {
                    buffer = await response.body()
                } catch (error) {
                    candidatos.push({ url, status: response.status(), contentType, error: String(error) })
                    logger.warn('sat-cumplimiento', 'Cuerpo de respuesta PDF ilegible', { url, error: String(error) })
                }

                if ((!buffer || buffer.length <= 5000) && !reintentoHecho) {
                    reintentoHecho = true
                    const relectura = await this.refetchPdf(context, url)
                    if (relectura && relectura.length > 5000) buffer = relectura
                }

                if (!buffer) return

                candidatos.push({ url, status: response.status(), contentType, bytes: buffer.length })
                logger.log('sat-cumplimiento', 'Respuesta candidata a PDF', {
                    url,
                    status: response.status(),
                    contentType,
                    bytes: buffer.length
                })

                if (buffer.length > 5000) {
                    resuelto = true
                    if (!guardar(buffer)) resuelto = false
                }
            }

            context.on('response', handler)
        })
    }

    /**
     * Relectura directa de un PDF con las cookies de la sesión (cuando el
     * visor de PDF del navegador lo pide por rangos y body() viene truncado).
     * @private
     */
    private async refetchPdf(context: BrowserContext, url: string): Promise<Buffer | undefined> {
        try {
            const respuesta = await context.request.get(url, { timeout: 30000 })
            if (!respuesta.ok()) return undefined
            const cuerpo = Buffer.from(await respuesta.body())
            logger.log('sat-cumplimiento', 'Relectura directa del PDF', { url, bytes: cuerpo.length })
            return cuerpo
        } catch (error) {
            logger.warn('sat-cumplimiento', 'Relectura directa del PDF falló', { url, error: String(error) })
            return undefined
        }
    }

    /**
     * Formatea la respuesta de la opinión.
     * @private
     */
    private async formatearRespuesta(
        rutaArchivo?: string
    ): Promise<OpinionCumplimiento> {
        let resultado: 'positivo' | 'negativo' | 'unknown' = 'unknown'

        if (rutaArchivo) {
            resultado = await this.determinarResultadoDesdePdf(rutaArchivo)
        }

        return {
            resultado,
            fecha_emision: new Date().toISOString(),
            descripcion: rutaArchivo
                ? 'Procesado con éxito.'
                : 'Error: PDF no capturado.',
            rutaArchivo
        }
    }

    /**
     * Determina si la opinión es positiva o negativa leyendo el PDF.
     * @private
     */
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
        } catch {
            return 'unknown'
        }
    }
}
