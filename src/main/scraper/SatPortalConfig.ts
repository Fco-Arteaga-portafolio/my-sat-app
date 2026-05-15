/**
 * SatPortalConfig.ts
 * 
 * Interfaces y tipos para la configuración de portales SAT.
 * Implementa SOLID - Interface Segregation Principle:
 * Interfaces pequeñas y específicas para cada responsabilidad.
 */

import { Page } from 'playwright' // Solo para tipos, no para lógica de navegación

export type AuthMethod = 'ciec' | 'fiel'

/**
 * Selectores CSS dinámicos para cada portal.
 * Permite que cada portal tenga sus propios selectores sin afectar otros.
 */
export interface PortalSelectors {
    captchaContainer?: string
    captchaImage: string
    rfcField: string
    passwordField: string
    captchaField: string
    submitButton: string
    fielButton?: string
    cerFileInput: string
    keyFileInput: string
    fielPasswordField: string
    logoutButton?: string
    generateButton?: string
    iframe?: string
}

/**
 * Configuración de un portal SAT.
 * Single Responsibility: Define estructura de un portal.
 */
export interface SatPortalConfig {
    id: string
    name: string
    baseUrl: string
    loginUrl: string
    loginDomain: string
    portalDomain?: string
    portalRoute?: string
    authMethods: AuthMethod[]
    requiresCaptcha: boolean
    selectors: PortalSelectors
}

/**
 * Credenciales de CIEC (Contraseña).
 */
export interface CiecCredentials {
    rfc: string
    password: string
    captcha?: string
}

/**
 * Credenciales de FIEL (Certificado).
 */
export interface FielCredentials {
    rutaCer: string
    rutaKey: string
    contrasenaFiel: string
}

/**
 * Tipo unión para credenciales.
 */
export type SatCredentials = CiecCredentials | FielCredentials

/**
 * Datos del captcha.
 * Interface Segregation: Solo contiene lo necesario para el captcha.
 */
export interface CaptchaData {
    imagenBase64: string
    timestamp?: number
}

/**
 * Resultado de una operación SAT.
 * Genérico para cualquier tipo de resultado.
 */
export interface SatOperationResult {
    fecha_emision: string
    descripcion: string
    rutaArchivo?: string
    [key: string]: any
}

/**
 * Callback para reportar progreso de operaciones.
 */
export type ProgresoCallback = (mensaje: string) => void

/**
 * Opciones para ejecutar operaciones.
 */
export interface SatOperationOptions {
    carpetaTemp: string
    onProgreso?: ProgresoCallback
}

/**
 * Interfaz para autenticación.
 * Liskov Substitution Principle: Implementable por cualquier servicio de auth.
 */
export interface ISatAuthService {
    obtenerCaptcha(portalId: string): Promise<CaptchaData>
    loginCiec(portalId: string, credentials: CiecCredentials): Promise<any>
    loginFiel(portalId: string, credentials: FielCredentials): Promise<any>
    cerrarSesion(): Promise<void>
}

/**
 * Interfaz para operaciones en portales.
 * Liskov Substitution Principle: Implementable por servicios específicos.
 */
export interface ISatOperation {
    // Recibe la Page ya autenticada — ya no hace login propio
    ejecutar(page: Page, credenciales: SatCredentials, options: SatOperationOptions): Promise<SatOperationResult>
    obtenerCaptcha(): Promise<CaptchaData>
    cerrarSesion(): Promise<void>
}

/**
 * Proveedor de configuración de portales.
 * Dependency Injection: Permite inyectar diferentes fuentes de config.
 */
export interface IPortalConfigProvider {
    obtenerConfiguracion(portalId: string): SatPortalConfig | null
    listarPortales(): SatPortalConfig[]
    existePortal(portalId: string): boolean   // ← fix error 2
}
