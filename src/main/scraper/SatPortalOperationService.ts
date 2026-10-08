import { Page } from 'playwright'
import { join } from 'path'
import { SatUnifiedAuthService } from './SatUnifiedAuthService'
import { logger } from '../services/LoggerService'
import {
    IPortalConfigProvider,
    ISatOperation,
    SatOperationResult,
    SatCredentials,
    SatOperationOptions
} from './SatPortalConfig'

export abstract class SatPortalOperationService implements ISatOperation {
    protected paginaActiva: Page | null = null

    constructor(
        protected portalId: string,
        protected configProvider: IPortalConfigProvider,
        protected authService: SatUnifiedAuthService
    ) { }

    /**
     * Recibe la página ya autenticada desde el handler.
     * Ya no hace login aquí — eso evita que se abra un segundo navegador.
     */
    async ejecutar(
        page: Page,
        credenciales: SatCredentials,
        options: SatOperationOptions
    ): Promise<SatOperationResult> {
        try {
            options.onProgreso?.('Conectando con el SAT...')
            this.paginaActiva = page
            const resultado = await this.ejecutarOperacion(credenciales, options)
            logger.log(`sat-${this.portalId}`, `Operación finalizada`, {
                rutaArchivo: resultado?.rutaArchivo ?? null
            })
            return resultado
        } catch (error: any) {
            await this.registrarDiagnosticoError(error)
            return this.manejarError(error)
        } finally {
            await this.limpiar()
        }
    }

    /**
     * Deja en los logs todo lo necesario para diagnosticar a distancia:
     * mensaje, URL y título de la página, captura PNG (en la carpeta de logs)
     * y un recorte del HTML visible. Así, con los logs que envía el cliente se
     * ve exactamente en qué pantalla se quedó el SAT.
     */
    protected async registrarDiagnosticoError(error: unknown): Promise<void> {
        const diag: Record<string, unknown> = {
            portal: this.portalId,
            error: error instanceof Error ? error.message : String(error)
        }
        try {
            const pagina = this.paginaActiva
            if (pagina && !pagina.isClosed()) {
                diag.url = pagina.url()
                diag.titulo = await pagina.title().catch(() => '')
                try {
                    const rutaCaptura = join(
                        logger.getLogsDir(),
                        `${this.portalId}-error-${Date.now()}.png`
                    )
                    await pagina.screenshot({ path: rutaCaptura, timeout: 10000 }).catch(() => null)
                    diag.captura = rutaCaptura
                } catch {
                    // La captura es best-effort.
                }
                const html = await pagina.content().catch(() => '')
                if (html) diag.html = html.slice(0, 8000)
            }
        } catch {
            // El diagnóstico nunca debe enmascarar el error original.
        }
        logger.error(`sat-${this.portalId}`, 'Operación fallida', diag)
    }

    async obtenerCaptcha() {
        return this.authService.obtenerCaptcha(this.portalId)
    }

    async cerrarSesion(): Promise<void> {
        if (this.paginaActiva && !this.paginaActiva.isClosed()) {
            await this.paginaActiva.close().catch(() => null)
            this.paginaActiva = null
        }
        await this.authService.cerrarSesion()
    }

    protected abstract ejecutarOperacion(
        credenciales: SatCredentials,
        options: SatOperationOptions
    ): Promise<SatOperationResult>

    protected manejarError(error: any): SatOperationResult {
        const mensaje = error.message || 'Error desconocido'
        console.error(`[${this.portalId}] Error:`, mensaje)
        return {
            fecha_emision: new Date().toISOString(),
            descripcion: `Error: ${mensaje}`
        }
    }

    protected async limpiar(): Promise<void> {
        this.paginaActiva = null
    }
}