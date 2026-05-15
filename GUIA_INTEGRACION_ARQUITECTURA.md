/\*\*

- GUÍA DE INTEGRACIÓN
-
- Este archivo muestra cómo los handlers legacy se integran con los nuevos servicios
- para mantener compatibilidad mientras se migra a la arquitectura unificada.
  \*/

// ============================================================================
// ANTES (Legacy - Código duplicado)
// ============================================================================

/\*
// ConstanciaHandler.ts (VIEJO)
export class ConstanciaHandler {
private constanciaService: SatConstanciaService
private paginaActiva: Page | null = null

registrar(): void {
ipcMain.handle('constancia-obtener-captcha', async () => {
const contexto = await BrowserManager.newContext()
this.paginaActiva = await contexto.newPage()
const captcha = await this.constanciaService.obtenerCaptcha(this.paginaActiva)
return { success: true, data: captcha }
})
}
}

// CumplimientoHandler.ts (VIEJO)
export class CumplimientoHandler {
private cumplimientoService: SatCumplimientoService
private paginaActiva: Page | null = null

registrar(): void {
ipcMain.handle('cumplimiento-obtener-captcha', async () => {
const contexto = await BrowserManager.newContext()
this.paginaActiva = await contexto.newPage()
const captcha = await this.cumplimientoService.obtenerCaptcha(this.paginaActiva)
return { success: true, data: captcha }
})
}
}

// PROBLEMAS:
// 1. Código idéntico en dos handlers
// 2. Selectores CSS hardcodeados en servicios
// 3. Lógica de autenticación repetida
// 4. Difícil agregar nuevo portal
// 5. Testing complicado
\*/

// ============================================================================
// DESPUÉS (Nueva arquitectura - Código limpio y DRY)
// ============================================================================

/\*
// 1. Una sola configuración JSON
{
"portals": [
{
"id": "constancia",
"name": "Constancia de Situación Fiscal",
"selectors": { "captchaImage": "img[src^=\"data:image\"]", ... }
},
{
"id": "cumplimiento",
"name": "Opinión de Cumplimiento",
"selectors": { "captchaImage": "img[src^=\"data:image\"]", ... }
}
]
}

// 2. Un servicio de autenticación reutilizable
const authService = new SatUnifiedAuthService(configProvider)
await authService.obtenerCaptcha('constancia')
await authService.obtenerCaptcha('cumplimiento')

// 3. Servicios de operación específicos que heredan la base
class SatConstanciaOperationService extends SatPortalOperationService { }
class SatCumplimientoOperationService extends SatPortalOperationService { }

// 4. Un handler dinámico que sirve para todos
const unifiedHandler = new UnifiedSatHandler(configuracionService, {
'constancia': constanciaService,
'cumplimiento': cumplimientoService,
'nuevo-portal': nuevoPortalService // Agregar es trivial
})

// BENEFICIOS:
// 1. 0% duplicación de código
// 2. Selectores en JSON (fácil mantenimiento)
// 3. SOLID principles
// 4. Testing fácil con mocks
// 5. Escalable a muchos portales
\*/

// ============================================================================
// PLAN DE MIGRACIÓN
// ============================================================================

/\*
OPCIÓN A: Migración inmediata (Lo que acabamos de hacer)

1. ✅ Nuevos servicios creados
2. ✅ Config JSON creado
3. ✅ UnifiedSatHandler registrado
4. ✅ Handlers legacy mantienen compatibilidad
5. El React no necesita cambios

OPCIÓN B: Migración gradual (Si queremos cambios en React)

1. Mantener handlers legacy funcionando
2. Gradualmente migrar componentes React
3. Actualizar preload APIs (opcional)

// React component con NUEVO handler
const res = await window.api.obtenerCaptchaDinamico('constancia')

// O mantener el legacy
const res = await window.api.constanciaObtenerCaptcha()

Ambos funcionan simultáneamente.
\*/

// ============================================================================
// EJEMPLOS DE USO EN CÓDIGO NUEVO
// ============================================================================

/\*
// Crear servicio específico
import { SatPortalOperationService } from './SatPortalOperationService'

export class SatFacturasOperationService extends SatPortalOperationService {
constructor(configProvider: IPortalConfigProvider) {
super('facturas', configProvider)
}

protected async ejecutarOperacion(
credenciales: SatCredentials,
options: SatOperationOptions
): Promise<SatOperationResult> {
// Lógica específica de facturas
const config = this.configProvider.obtenerConfiguracion(this.portalId)!

    // Ya tenemos:
    // - Autenticación lista (heredada)
    // - Página activa
    // - Selectores dinámicos

    // Solo implementamos nuestra lógica
    await this.paginaActiva!.goto(config.portalRoute)
    const facturas = await this.extraerFacturas()
    return {
      fecha_emision: new Date().toISOString(),
      descripcion: 'Facturas descargadas',
      data: facturas
    }

}
}

// Registrar en main
const facturasService = new SatFacturasOperationService(configProvider)
unifiedHandler.registrarServicioOperacion('facturas', {
obtenerCaptcha: () => facturasService.obtenerCaptcha(),
ejecutar: (cred, opts) => facturasService.ejecutar(cred, opts),
cerrarSesion: () => facturasService.cerrarSesion()
})
\*/

// ============================================================================
// TESTING
// ============================================================================

/\*
import { describe, it, expect, vi } from 'vitest'
import { SatConstanciaOperationService } from './SatConstanciaOperationService'

describe('SatConstanciaOperationService', () => {
it('obtiene constancia con CIEC', async () => {
// Mock de proveedor de config
const mockConfigProvider: IPortalConfigProvider = {
obtenerConfiguracion: vi.fn().mockReturnValue({
id: 'constancia',
baseUrl: 'https://test.sat.gob.mx',
selectors: { /_ ... _/ }
}),
listarPortales: vi.fn().mockReturnValue([])
}

    const service = new SatConstanciaOperationService(mockConfigProvider)

    // Mock de credenciales
    const credenciales = {
      rfc: 'ABC123XYZ',
      password: 'password',
      captcha: '12345'
    }

    // Mock de opciones
    const options = {
      carpetaTemp: '/tmp',
      onProgreso: vi.fn()
    }

    // Ejecutar operación
    const resultado = await service.ejecutar(credenciales, options)

    // Validar resultado
    expect(resultado).toBeDefined()
    expect(resultado.fecha_emision).toBeDefined()

})
})
\*/

export {}
