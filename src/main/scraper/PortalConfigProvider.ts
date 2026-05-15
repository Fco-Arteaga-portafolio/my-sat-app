/**
 * PortalConfigProvider.ts
 * 
 * Implementa IPortalConfigProvider para leer la configuración desde el JSON.
 * Single Responsibility: Solo lee y proporciona configuración.
 * Open/Closed: Abierto a extensión (puede heredarse), cerrado a modificación.
 */

import { IPortalConfigProvider, SatPortalConfig } from './SatPortalConfig'
import portalsConfig from '../config/satPortals.config.json'

export class PortalConfigProvider implements IPortalConfigProvider {
    private portales: SatPortalConfig[]

    constructor() {
        this.portales = (portalsConfig as any).portals || []
    }

    /**
     * Obtiene la configuración de un portal específico.
     * @param portalId - ID del portal (ej: 'facturas', 'constancia')
     * @returns Configuración del portal o null si no existe
     */
    obtenerConfiguracion(portalId: string): SatPortalConfig | null {
        return this.portales.find(p => p.id === portalId) || null
    }

    /**
     * Lista todos los portales disponibles.
     */
    listarPortales(): SatPortalConfig[] {
        return [...this.portales]
    }

    /**
     * Valida que un portal exista.
     */
    existePortal(portalId: string): boolean {
        return this.obtenerConfiguracion(portalId) !== null
    }

    /**
     * Obtiene todos los portales que soportan un método de autenticación.
     */
    obtenerPorMetodoAuth(metodo: 'ciec' | 'fiel'): SatPortalConfig[] {
        return this.portales.filter(p => p.authMethods.includes(metodo))
    }
}
