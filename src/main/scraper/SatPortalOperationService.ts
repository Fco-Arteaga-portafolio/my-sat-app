import { Page } from 'playwright'
import { SatUnifiedAuthService } from './SatUnifiedAuthService'
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
            return resultado
        } catch (error: any) {
            return this.manejarError(error)
        } finally {
            await this.limpiar()
        }
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