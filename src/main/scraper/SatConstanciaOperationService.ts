/**
 * SatConstanciaOperationService.ts
 * 
 * Implementación específica para la operación de Constancia.
 * Hereda de SatPortalOperationService y reutiliza la autenticación.
 */

import { Page, Frame } from 'playwright'
import * as fs from 'fs'
import { join } from 'path'
import { SatPortalOperationService } from './SatPortalOperationService'
import { SatUnifiedAuthService } from './SatUnifiedAuthService'
import { IPortalConfigProvider, SatOperationResult, SatCredentials, SatOperationOptions } from './SatPortalConfig'

export interface ConstanciaSituacionFiscal extends SatOperationResult {
    rfc: string
    rutaArchivo?: string
}

export class SatConstanciaOperationService extends SatPortalOperationService {
    constructor(configProvider: IPortalConfigProvider, authService: SatUnifiedAuthService) {
        super('constancia', configProvider, authService)
    }

    /**
     * Ejecuta la operación de obtener constancia.
     */
    protected async ejecutarOperacion(
        credenciales: SatCredentials,
        options: SatOperationOptions
    ): Promise<ConstanciaSituacionFiscal> {
        if (!this.paginaActiva) {
            throw new Error('No hay página activa')
        }

        const config = this.configProvider.obtenerConfiguracion(this.portalId)!
        const rfc = 'rfc' in credenciales ? credenciales.rfc : ''

        try {
            options.onProgreso?.('Accediendo al portal de constancias...')

            // Navegar al portal
            await this.paginaActiva.waitForURL(`**${config.portalDomain}**`, { timeout: 40000 })
            await this.paginaActiva.waitForLoadState('networkidle', { timeout: 20000 })

            if (!this.paginaActiva.url().includes('/operacion/43824')) {
                await this.paginaActiva.goto(config.portalRoute || config.baseUrl, {
                    waitUntil: 'networkidle',
                    timeout: 30000
                })
            }

            if (this.paginaActiva.url().includes('error.seg')) {
                throw new Error(
                    'El SAT rechazó el acceso al portal. Intenta de nuevo en unos minutos.'
                )
            }

            options.onProgreso?.('Generando constancia...')
            const frame = await this.obtenerFrameConstancia(this.paginaActiva)

            const boton = frame.locator(
                'button:has-text("Generar Constancia"), input[value="Generar Constancia"]'
            )
            await boton.waitFor({ state: 'visible', timeout: 20000 })

            options.onProgreso?.('Descargando PDF...')
            const rutaArchivo = await this.interceptarYDescargar(
                this.paginaActiva,
                boton,
                options.carpetaTemp
            )

            // Cerrar cualquier página extra
            const paginas = this.paginaActiva.context().pages()
            for (const p of paginas) {
                if (p !== this.paginaActiva) {
                    await p.close().catch(() => null)
                }
            }

            return {
                rfc,
                fecha_emision: new Date().toISOString(),
                rutaArchivo,
                descripcion: rutaArchivo
                    ? 'Constancia generada y descargada correctamente.'
                    : 'No se pudo capturar el PDF automáticamente.'
            }
        } catch (error) {
            throw error
        }
    }

    /**
     * Obtiene el frame donde está el formulario de constancia.
     * @private
     */
    private async obtenerFrameConstancia(page: Page): Promise<Frame> {
        const config = this.configProvider.obtenerConfiguracion(this.portalId)!

        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

        const iframeEl = await page.waitForSelector(config.selectors.iframe || '#iframetoload', {
            timeout: 15000
        })

        const frame = await iframeEl.contentFrame()
        if (!frame) {
            throw new Error('No se pudo obtener el frame del iframe')
        }

        return frame
    }

    /**
     * Intercepta y descarga el PDF de la constancia.
     * @private
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
                            console.log('[SatConstanciaOperationService] Constancia capturada:', rutaFinal)
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

            page.context().once('page', (p) => {
                popupRef = p
            })

            boton.click().catch(() => null)
        })
    }
}
