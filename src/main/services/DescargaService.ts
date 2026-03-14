import { app } from 'electron'
import { SatAuthService } from '../scraper/SatAuthService'
import { SatBusquedaService } from '../scraper/SatBusquedaService'
import { SatDescargaService } from '../scraper/SatDescargaService'
import { CfdiGuardadoService } from './CfdiGuardadoService'
import { FacturaRepository } from '../database/repositories/FacturaRepository'
import { DescargaPendienteRepository } from '../database/repositories/DescargaPendienteRepository'
import { Configuracion } from './ConfiguracionService'
import { ParametrosBusqueda, ProgresoDescarga } from '../scraper/SatTypes'
import { Page } from 'playwright'

export class DescargaService {
  constructor(
    private readonly authService: SatAuthService,
    private readonly busquedaService: SatBusquedaService,
    private readonly descargaService: SatDescargaService,
    private readonly guardadoService: CfdiGuardadoService,
    private readonly facturaRepository: FacturaRepository,
    private readonly pendienteRepository: DescargaPendienteRepository
  ) { }

  async descargar(
    config: Configuracion,
    params: ParametrosBusqueda,
    captcha?: string,
    onProgreso?: (progreso: ProgresoDescarga) => void
  ): Promise<{ total: number; errores: { uuid: string; error: string }[] }> {
    const page = await this.login(config, captcha)
    const carpetaTemp = config.carpetaDescarga || app.getPath('downloads')
    const tipoDes = params.tipo === 'recibidas' ? 'recibida' : 'emitida'

    onProgreso?.({ etapa: 'buscando' })
    const filas = await this.busquedaService.buscarPorParametros(page, params,
      (mesActual, totalMeses) => onProgreso?.({ etapa: 'buscando', mesActual, totalMeses })
    )

    const filasConTipo = filas.map(f => ({ ...f, tipo_descarga: tipoDes }))

    const { exitosas, errores: erroresDescarga } = await this.descargaService.descargarEnLote(
      page, filasConTipo, carpetaTemp,
      (descargadas, totalFacturas, uuid) => onProgreso?.({ etapa: 'descargando', descargadas, totalFacturas, uuid })
    )

    let guardadas = 0
    const errores: { uuid: string; error: string }[] = []

    for (const { rutaTemp, meta } of exitosas) {
      try {
        this.guardadoService.guardarDesdeRuta(rutaTemp, meta)
        guardadas++
      } catch (err: any) {
        errores.push({ uuid: meta.uuid, error: err.message })
      }
    }

    for (const e of erroresDescarga) {
      this.guardadoService.guardarPendiente({
        uuid: e.uuid,
        rfc_emisor: e.fila.rfc_emisor,
        nombre_emisor: e.fila.nombre_emisor,
        rfc_receptor: e.fila.rfc_receptor,
        nombre_receptor: e.fila.nombre_receptor,
        fecha_emision: e.fila.fecha_emision,
        total: e.fila.total,
        tipo_comprobante: e.fila.tipo_comprobante,
        estado: e.fila.estado,
        tipo_descarga: tipoDes
      }, e.error)
    }

    this.guardadoService.sincronizarCatalogos()
    onProgreso?.({ etapa: 'completado', totalFacturas: guardadas })

    return { total: guardadas, errores: [...errores, ...erroresDescarga.map(e => ({ uuid: e.uuid, error: e.error }))] }
  }

  async login(config: Configuracion, captcha?: string): Promise<Page> {
    if (config.metodoAuth === 'contrasena') {
      return this.authService.loginConContrasena(config.rfc, config.contrasena!, captcha!)
    }
    return this.authService.loginConEfirma(config.rutaCer!, config.rutaKey!, config.contrasenaFiel!)
  }

  obtenerFacturas() { return this.facturaRepository.obtenerTodas() }
  obtenerFacturaPorUuid(uuid: string) { return this.facturaRepository.obtenerPorUuid(uuid) }
  eliminarFactura(uuid: string) { return this.facturaRepository.eliminar(uuid) }
  obtenerDrillDown(rfc: string) { return this.facturaRepository.obtenerDrillDown(rfc) }
  obtenerPendientes() { return this.pendienteRepository.obtenerTodas() }
  contarPendientes() { return this.pendienteRepository.contar() }
  limpiarPendientes() { return this.pendienteRepository.limpiar() }
}