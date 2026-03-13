import { SatScraper, ParametrosBusqueda, ProgresoDescarga } from '../scraper/SatScraper'
import { FacturaRepository } from '../database/repositories/FacturaRepository'
import { DescargaPendienteRepository } from '../database/repositories/DescargaPendienteRepository'
import { Configuracion } from './ConfiguracionService'
import { FacturaGuardadoService } from './FacturaGuardadoService'
import { CatalogoRepository } from '../database/repositories/CatalogoRepository'
import BetterSqlite3 from 'better-sqlite3'

export class DescargaService {
  private readonly guardadoService: FacturaGuardadoService
  private readonly catalogoRepository: CatalogoRepository

  constructor(
    private readonly facturaRepository: FacturaRepository,
    private readonly pendienteRepository: DescargaPendienteRepository,
    db: BetterSqlite3.Database,
    private readonly scraper: SatScraper
  ) {
    this.guardadoService = new FacturaGuardadoService(facturaRepository, pendienteRepository)
    this.catalogoRepository = new CatalogoRepository(db)
  }

  async obtenerCaptcha(): Promise<string> {
    await this.scraper.iniciar()
    return await this.scraper.obtenerCaptcha()
  }

  async descargar(
    config: Configuracion,
    params: ParametrosBusqueda,
    captcha?: string,
    onProgreso?: (progreso: ProgresoDescarga) => void
  ): Promise<{ total: number; errores: { uuid: string; error: string }[] }> {
    const tipoDes = params.tipo === 'recibidas' ? 'recibida' : 'emitida'
    const { facturas, errores } = await this.scraper.descargarFacturas(config, params, captcha, onProgreso)

    let guardadas = 0
    for (const f of facturas) {
      if (!f.urlDescarga) continue
      this.guardadoService.guardar(f, tipoDes)
      guardadas++
    }

    for (const e of errores) {
      if (e.fila) {
        this.guardadoService.guardarPendiente({ uuid: e.uuid, ...e.fila }, tipoDes, e.error)
      }
    }

    this.catalogoRepository.sincronizarTodos()
    return { total: guardadas, errores }
  }

  async reintentarPendientes(
    config: Configuracion,
    captcha?: string,
    onProgreso?: (progreso: ProgresoDescarga) => void
  ): Promise<{ total: number; errores: { uuid: string; error: string }[] }> {
    const pendientes = this.pendienteRepository.obtenerTodas()
    if (pendientes.length === 0) return { total: 0, errores: [] }

    await this.scraper.iniciar()
    const { facturas, errores } = await this.scraper.reintentarDescargas(
      config, captcha, pendientes, onProgreso
    )

    let guardadas = 0
    for (const f of facturas) {
      if (!f.urlDescarga) continue
      const tipoDes = f.tipo_descarga as 'recibida' | 'emitida'
      this.guardadoService.guardar(f, tipoDes)
      guardadas++
    }

    for (const e of errores) {
      const pendiente = pendientes.find(p => p.uuid === e.uuid)
      if (pendiente) {
        this.pendienteRepository.insertar({ ...pendiente, error: e.error })
      }
    }

    return { total: guardadas, errores }
  }

  obtenerFacturas() { return this.facturaRepository.obtenerTodas() }
  obtenerFacturaPorUuid(uuid: string) { return this.facturaRepository.obtenerPorUuid(uuid) }
  eliminarFactura(uuid: string) { return this.facturaRepository.eliminar(uuid) }
  obtenerPendientes() { return this.pendienteRepository.obtenerTodas() }
  contarPendientes() { return this.pendienteRepository.contar() }
  limpiarPendientes() { return this.pendienteRepository.limpiar() }
  obtenerDrillDown(rfc: string) { return this.facturaRepository.obtenerDrillDown(rfc) }
}