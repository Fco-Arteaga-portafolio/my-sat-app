import { SesionService } from './SesionService'
import { LicenseHelper } from './LicenseHelper'
import { BackendService } from './BackendService'
import type { ModuloUso } from './BackendService'

/** Ids de módulo del escritorio: fuente única en BackendService (ModuloUso). */
export type ModuloLimite = ModuloUso

export interface ValidacionUso {
  valido: boolean
  motivo?: string
  usos_restantes?: number
}

const MENSAJE_SIN_SESION = 'Inicia sesión con tu cuenta de IFRAT para usar este módulo'

/**
 * Módulos que el backend aún no conoce. `constancia` no está en ModuloEmite, así
 * que su contador (1 uso) se lleva solo localmente contra la licencia.
 */
const MODULOS_SOLO_LOCAL: ModuloLimite[] = ['constancia']

/**
 * Punto único de validación de límites por módulo.
 *
 * Fuente de verdad: el backend (POST /uso/validar y POST /uso/consumir), que
 * controla el contador por usuario + RFC + módulo. Por eso el RFC es un
 * parámetro obligatorio en la práctica: sin él el backend no encuentra el
 * contador y lo reportaría como "permitido".
 *
 * - Sin sesión: los módulos quedan bloqueados (el login es obligatorio).
 * - Con `usoIlimitado` en el resumen: sin límite (no se llama al backend).
 * - Con sesión demo: manda el contador del servidor; el local queda como espejo
 *   para que, si el servidor no responde, se siga aplicando el límite sin
 *  molestar al usuario con un error de conexión.
 */
export class LimiteUsoService {
  constructor(
    private readonly sesionService: SesionService,
    private readonly licenseHelper: LicenseHelper,
    private readonly backendService: BackendService
  ) {}

  private mapearFeature(
    modulo: ModuloLimite
  ): 'descarga' | 'importacion' | 'consolidacion' | 'pendientes' | 'cumplimiento' | 'constancia' {
    const mapa = {
      descarga_cfdi: 'descarga',
      importacion_cfdi: 'importacion',
      consolidacion: 'consolidacion',
      pendientes: 'pendientes',
      cumplimiento: 'cumplimiento',
      constancia: 'constancia'
    } as const
    return mapa[modulo]
  }

  private mapearContadorLocal(
    modulo: ModuloLimite
  ):
    | 'descargas'
    | 'importaciones'
    | 'consolidaciones'
    | 'pendientes'
    | 'cumplimientos'
    | 'constancias' {
    const mapa = {
      descarga_cfdi: 'descargas',
      importacion_cfdi: 'importaciones',
      consolidacion: 'consolidaciones',
      pendientes: 'pendientes',
      cumplimiento: 'cumplimientos',
      constancia: 'constancias'
    } as const
    return mapa[modulo]
  }

  async validar(modulo: ModuloLimite, rfc?: string): Promise<ValidacionUso> {
    if (!this.sesionService.estaIniciada()) {
      return { valido: false, motivo: MENSAJE_SIN_SESION }
    }

    // Membresía pagada: sin límite, sin necesidad de preguntar al backend.
    if (this.sesionService.obtenerResumen()?.usoIlimitado) {
      return { valido: true }
    }

    const jwt = this.sesionService.obtenerJwt()
    if (jwt && !MODULOS_SOLO_LOCAL.includes(modulo)) {
      try {
        const remoto = await this.backendService.validarUso(jwt, modulo, rfc)
        // Membresía pagada detectada por el servidor: libera sin exponer el
        // -1 que el backend devuelve en usosRestantes.
        if (remoto.usoIlimitado) return { valido: true }
        return {
          valido: remoto.permitido,
          motivo: remoto.permitido ? undefined : (remoto.mensaje ?? 'Límite de uso alcanzado'),
          usos_restantes: remoto.usosRestantes
        }
      } catch {
        // Servidor no disponible: se aplica el contador local en silencio.
      }
    }

    const local = this.licenseHelper.validateFeature(this.mapearFeature(modulo))
    return { valido: local.valido, motivo: local.motivo, usos_restantes: local.usos_restantes }
  }

  async consumir(modulo: ModuloLimite, rfc?: string): Promise<void> {
    if (!this.sesionService.estaIniciada()) return
    if (this.sesionService.obtenerResumen()?.usoIlimitado) return

    const jwt = this.sesionService.obtenerJwt()
    if (jwt && !MODULOS_SOLO_LOCAL.includes(modulo)) {
      try {
        await this.backendService.consumirUso(jwt, modulo, rfc)
      } catch {
        // El contador local de abajo queda como respaldo del consumo.
      }
    }

    // Espejo local: mantiene el respaldo coherente aunque el servidor no responda.
    this.licenseHelper.incrementCounter(this.mapearContadorLocal(modulo))
  }
}
