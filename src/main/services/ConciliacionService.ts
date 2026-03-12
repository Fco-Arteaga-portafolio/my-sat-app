import { SatScraper, ParametrosBusqueda } from '../scraper/SatScraper'
import { FacturaRepository } from '../database/repositories/FacturaRepository'
import { DescargaPendienteRepository } from '../database/repositories/DescargaPendienteRepository'
import { FacturaGuardadoService } from './FacturaGuardadoService'
import { Configuracion } from './ConfiguracionService'

export interface ParametrosConciliacion {
  tipo: 'emitidas' | 'recibidas'
  ejercicio: string
  periodo: string
  captcha?: string
}

export interface ProgresoConciliacion {
  etapa: 'autenticando' | 'consultando' | 'comparando' | 'descargando' | 'actualizando' | 'completado'
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
  private readonly guardadoService: FacturaGuardadoService

  constructor(
    private readonly facturaRepository: FacturaRepository,
    pendienteRepository: DescargaPendienteRepository,
    private readonly scraper: SatScraper
  ) {
    this.guardadoService = new FacturaGuardadoService(facturaRepository, pendienteRepository)
  }

  async conciliar(
    config: Configuracion,
    params: ParametrosConciliacion,
    onProgreso?: (progreso: ProgresoConciliacion) => void
  ): Promise<ResumenConciliacion> {
    const errores: { uuid: string; error: string }[] = []

    try {
      // 1. Autenticar
      onProgreso?.({ etapa: 'autenticando' })
      await this.scraper.iniciar()

      let page: any
      const authService = (this.scraper as any).authService

      if (config.metodoAuth === 'contrasena') {
        page = await authService.loginConContrasenaDirecto(config.rfc, config.contrasena!, params.captcha!)
      } else {
        page = await authService.loginConEfirma(config.rutaCer!, config.rutaKey!, config.contrasenaFiel!)
      }

      // 2. Construir rango del periodo (mes completo)
      const mes = params.periodo.padStart(2, '0')
      const ultimoDia = new Date(parseInt(params.ejercicio), parseInt(mes), 0).getDate()
      const fechaInicio = `01/${mes}/${params.ejercicio}`
      const fechaFin = `${ultimoDia}/${mes}/${params.ejercicio}`

      const paramsBusqueda: ParametrosBusqueda = {
        tipo: params.tipo,
        buscarPor: 'fecha',
        fechaInicio,
        fechaFin
      }

      // 3. Consultar SAT
      onProgreso?.({ etapa: 'consultando' })
      const filasSat = await this.scraper.buscarEnPagina(page, paramsBusqueda)
      const totalSat = filasSat.length

      // 4. Comparar con local
      onProgreso?.({ etapa: 'comparando' })
      const tipoDes = params.tipo === 'recibidas' ? 'recibida' : 'emitida'

      const faltantes = filasSat.filter(f => !this.facturaRepository.obtenerPorUuid(f.uuid))
      const existentes = filasSat.filter(f => {
        const local = this.facturaRepository.obtenerPorUuid(f.uuid)
        return local && local.estado === 'vigente' && f.estado === 'cancelado'
      })
      const totalLocal = totalSat - faltantes.length

      // 5. Descargar faltantes
      let descargadas = 0
      if (faltantes.length > 0) {
        onProgreso?.({ etapa: 'descargando', descargadas: 0, totalFaltantes: faltantes.length })

        const { facturas, errores: erroresDescarga } = await (this.scraper as any).descargarEnParalelo(
          page,
          faltantes,
          (p: any) => onProgreso?.({ etapa: 'descargando', descargadas: p.descargadas, totalFaltantes: faltantes.length })
        )

        for (const f of facturas) {
          if (!f.urlDescarga) continue
          try {
            this.guardadoService.guardar(f, tipoDes)
            descargadas++
          } catch (err: any) {
            errores.push({ uuid: f.uuid, error: err.message })
          }
        }

        for (const e of erroresDescarga) {
          const fila = faltantes.find(f => f.uuid === e.uuid)
          if (fila) {
            this.guardadoService.guardarPendiente(fila, tipoDes, e.error)
          }
          errores.push({ uuid: e.uuid, error: e.error })
        }
      }

      // 6. Actualizar vigente→cancelado
      let actualizadas = 0
      if (existentes.length > 0) {
        onProgreso?.({ etapa: 'actualizando', actualizadas: 0 })
        for (const f of existentes) {
          try {
            this.facturaRepository.actualizar(f.uuid, { estado: 'cancelado' })
            actualizadas++
          } catch (err: any) {
            errores.push({ uuid: f.uuid, error: err.message })
          }
        }
      }

      onProgreso?.({ etapa: 'completado' })
      return { totalSat, totalLocal, descargadas, actualizadas, errores }
    } finally {
      await this.scraper.cerrar()
    }
  }
}