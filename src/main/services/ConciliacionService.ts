import { FacturaRepository } from '../database/repositories/FacturaRepository'
import { ConciliacionRepository } from '../database/repositories/ConciliacionRepository'
import { DescargaService } from './DescargaService'
import { Configuracion } from './ConfiguracionService'

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
  constructor(
    private readonly facturaRepository: FacturaRepository,
    private readonly conciliacionRepository: ConciliacionRepository,
    private readonly descargaService: DescargaService
  ) { }

  async conciliar(
    config: Configuracion,
    params: ParametrosConciliacion,
    onProgreso?: (progreso: ProgresoConciliacion) => void
  ): Promise<ResumenConciliacion> {
    const mes = params.periodo.padStart(2, '0')
    const ultimoDia = new Date(parseInt(params.ejercicio), parseInt(mes), 0).getDate()
    const fechaInicio = `01/${mes}/${params.ejercicio}`
    const fechaFin = `${ultimoDia}/${mes}/${params.ejercicio}`

    // 1. Consultar SAT
    onProgreso?.({ etapa: 'consultando' })
    const scraper = (this.descargaService as any).scraper
    const authService = scraper.authService
    if (!authService) throw new Error('No hay sesión activa. Carga el captcha primero.')

    const page = await authService.loginConContrasena(config.rfc, config.contrasena!, params.captcha!)
    const filasSat = await scraper.buscarEnPagina(page, {
      tipo: params.tipo,
      buscarPor: 'fecha',
      fechaInicio,
      fechaFin
    })
    const totalSat = filasSat.length

    // 2. Comparar con local
    onProgreso?.({ etapa: 'comparando' })
    const faltantes = filasSat.filter((f: any) => !this.facturaRepository.obtenerPorUuid(f.uuid))
    const aActualizar = filasSat.filter((f: any) => {
      const local = this.facturaRepository.obtenerPorUuid(f.uuid)
      return local && local.estado === 'vigente' && f.estado === 'cancelado'
    })
    const totalLocal = totalSat - faltantes.length

    // 3. Descargar faltantes
    let descargadas = 0
    const errores: { uuid: string; error: string }[] = []

    if (faltantes.length > 0) {
      onProgreso?.({ etapa: 'descargando', descargadas: 0, totalFaltantes: faltantes.length })

      const resultado = await this.descargaService.descargar(
        config,
        { tipo: params.tipo, buscarPor: 'fecha', fechaInicio, fechaFin },
        params.captcha,
        (p) => {
          if (p.etapa === 'descargando') {
            onProgreso?.({ etapa: 'descargando', descargadas: p.descargadas, totalFaltantes: faltantes.length })
          }
        }
      )
      descargadas = resultado.total
      errores.push(...resultado.errores)
    }

    // 4. Actualizar vigente→cancelado
    let actualizadas = 0
    if (aActualizar.length > 0) {
      onProgreso?.({ etapa: 'actualizando' })
      for (const f of aActualizar) {
        try {
          this.facturaRepository.actualizar(f.uuid, { estado: 'cancelado' })
          actualizadas++
        } catch (err: any) {
          errores.push({ uuid: f.uuid, error: err.message })
        }
      }
    }

    // 5. Guardar registro
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

    onProgreso?.({ etapa: 'completado' })

    try { await scraper.cerrar() } catch (_) { }

    return { totalSat, totalLocal, descargadas, actualizadas, errores }
  }

  obtenerUltima(tipo: string, ejercicio: string, periodo: string) {
    return this.conciliacionRepository.obtenerUltima(tipo, ejercicio, periodo)
  }

  obtenerHistorial() {
    return this.conciliacionRepository.obtenerHistorial()
  }
}