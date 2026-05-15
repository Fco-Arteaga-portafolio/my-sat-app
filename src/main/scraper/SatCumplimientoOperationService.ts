/**
 * SatCumplimientoOperationService.ts
 * 
 * Implementación específica para la operación de Opinión de Cumplimiento.
 * Hereda de SatPortalOperationService y reutiliza la autenticación.
 */

import * as fs from 'fs'
import { join } from 'path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
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

            options.onProgreso?.('Navegando al portal de cumplimiento...')
            await this.paginaActiva.waitForURL(`**${config.portalDomain}**`, { timeout: 20000 })
            await this.paginaActiva.waitForTimeout(2000)

            options.onProgreso?.('Descargando opinión...')
            await this.paginaActiva.goto(config.portalRoute || config.baseUrl, {
                waitUntil: 'commit',
                timeout: 45000
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
     * @private
     */
    private configurarInterceptacionPdf(
        page: any,
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
                    } catch {
                        // Continuar intentando
                    }
                }
            }

            page.on('response', handler)
        })
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
