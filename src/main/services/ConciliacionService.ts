import { app } from 'electron'
import { SatAuthService } from '../scraper/SatAuthService'
import { SatBusquedaService } from '../scraper/SatBusquedaService'
import { SatDescargaService } from '../scraper/SatDescargaService'
import { CfdiGuardadoService } from './CfdiGuardadoService'
import { FacturaRepository } from '../database/repositories/FacturaRepository'
import { ConciliacionRepository } from '../database/repositories/ConciliacionRepository'
import { Configuracion } from './ConfiguracionService'
import { AuthHelper } from './AuthHelper'
import { DescargaHelper } from './DescargaHelper'

export interface ParametrosConciliacion {
  tipo: 'emitidas' | 'recibidas'
  ejercicio: string
  periodo: string
  captcha?: string
}

export interface ProgresoConciliacion {
  etapa: 'consultando' | 'comparando' | 'descargando' | 'actualizando' | 'completado'
  descargadas?: number
  totalFaltantes?: number
  actualizadas?: number
}

export interface ResumenConciliacion {
  totalSat: number
  totalLocal: number
  descargadas: number
  actualizadas: number
  errores: { uuid: string; error: string }[]
}

export class ConciliacionService {
  private authHelper: AuthHelper
  private descargaHelper: DescargaHelper

  constructor(
    authService: SatAuthService,
    private readonly busquedaService: SatBusquedaService,
    private readonly descargaService: SatDescargaService,
    private readonly guardadoService: CfdiGuardadoService,
    private readonly facturaRepository: FacturaRepository,
    private readonly conciliacionRepository: ConciliacionRepository
  ) {
    this.authHelper = new AuthHelper(authService)
    this.descargaHelper = new DescargaHelper(guardadoService)
  }

  async conciliar(
    config: Configuracion,
    params: ParametrosConciliacion,
    onProgreso?: (progreso: ProgresoConciliacion) => void
  ): Promise<ResumenConciliacion> {
    const mes = params.periodo.padStart(2, '0')
    const ultimoDia = new Date(parseInt(params.ejercicio), parseInt(mes), 0).getDate()
    const fechaInicio = `01/${mes}/${params.ejercicio}`
    const fechaFin = `${ultimoDia}/${mes}/${params.ejercicio}`
    const tipoDes = params.tipo === 'recibidas' ? 'recibida' : 'emitida'
    const carpetaTemp = config.carpetaDescarga || app.getPath('downloads')

    const page = await this.authHelper.login(config, params.captcha)

    // 2. Consultar SAT
    onProgreso?.({ etapa: 'consultando' })
    const filasSat = await this.busquedaService.buscarEnPagina(page, {
      tipo: params.tipo,
      buscarPor: 'fecha',
      fechaInicio,
      fechaFin
    })
    const totalSat = filasSat.length

    // 3. Comparar con local
    onProgreso?.({ etapa: 'comparando' })
    const faltantes = filasSat.filter(f => !this.facturaRepository.obtenerPorUuid(f.uuid))
    const aActualizar = filasSat.filter(f => {
      const local = this.facturaRepository.obtenerPorUuid(f.uuid)
      return local && local.estado === 'vigente' && f.estado === 'cancelado'
    })
    const totalLocal = totalSat - faltantes.length

    // 4. Descargar faltantes
    let descargadas = 0
    const errores: { uuid: string; error: string }[] = []

    if (faltantes.length > 0) {
      onProgreso?.({ etapa: 'descargando', descargadas: 0, totalFaltantes: faltantes.length })
      const filasConTipo = faltantes.map(f => ({ ...f, tipo_descarga: tipoDes }))
      const { exitosas, errores: erroresDescarga } = await this.descargaService.descargarEnLote(
        page, filasConTipo, carpetaTemp,
        (desc, _total, _uuid) => onProgreso?.({ etapa: 'descargando', descargadas: desc, totalFaltantes: faltantes.length })
      )

      const { guardadas, errores: erroresGuardado } = await this.descargaHelper.procesarDescargas(exitosas)
      descargadas = guardadas
      errores.push(...erroresGuardado)

      for (const e of erroresDescarga) {
        errores.push({ uuid: e.uuid, error: e.error })
      }
    }

    // 5. Actualizar vigente → cancelado
    let actualizadas = 0
    if (aActualizar.length > 0) {
      onProgreso?.({ etapa: 'actualizando' })
      for (const f of aActualizar) {
        try {
          this.guardadoService.actualizarEstado(f.uuid, 'cancelado')
          actualizadas++
        } catch (err: any) {
          errores.push({ uuid: f.uuid, error: err.message })
        }
      }
    }

    // 6. Guardar historial
    this.conciliacionRepository.insertar({
      tipo: params.tipo,
      ejercicio: params.ejercicio,
      periodo: params.periodo,
      total_sat: totalSat,
      total_local: totalLocal,
      descargadas,
      actualizadas,
      errores: errores.length
    })

    this.guardadoService.sincronizarCatalogos()
    onProgreso?.({ etapa: 'completado' })

    return { totalSat, totalLocal, descargadas, actualizadas, errores }
  }

  obtenerUltima(tipo: string, ejercicio: string, periodo: string) {
    return this.conciliacionRepository.obtenerUltima(tipo, ejercicio, periodo)
  }

  obtenerHistorial() {
    return this.conciliacionRepository.obtenerHistorial()
  }
}