import { SatScraper, ParametrosBusqueda, ProgresoDescarga } from '../scraper/SatScraper'
import { FacturaRepository } from '../database/repositories/FacturaRepository'
import { DescargaPendienteRepository } from '../database/repositories/DescargaPendienteRepository'
import { XmlParserService } from './XmlParserService'
import { Configuracion } from './ConfiguracionService'

export class DescargaService {
  private scraper = new SatScraper()
  private xmlParser = new XmlParserService()

  constructor(
    private readonly facturaRepository: FacturaRepository,
    private readonly pendienteRepository: DescargaPendienteRepository
  ) { }

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
    try {
      const { facturas, errores } = await this.scraper.descargarFacturas(config, params, captcha, onProgreso)

      let guardadas = 0
      for (const f of facturas) {
        if (!f.urlDescarga) continue
        const yaExiste = this.facturaRepository.obtenerPorUuid(f.uuid)
        if (!yaExiste) {
          const camposXml = this.xmlParser.extraerCampos(f.urlDescarga)
          this.facturaRepository.insertar({
            uuid: f.uuid,
            fecha_emision: f.fecha_emision,
            rfc_emisor: f.rfc_emisor,
            nombre_emisor: f.nombre_emisor,
            rfc_receptor: f.rfc_receptor,
            nombre_receptor: f.nombre_receptor,
            subtotal: f.total,
            total: f.total,
            tipo_comprobante: f.tipo_comprobante as 'I' | 'E' | 'T' | 'N' | 'P',
            estado: f.estado as 'vigente' | 'cancelado',
            xml: f.urlDescarga,
            tipo_descarga: params.tipo === 'recibidas' ? 'recibida' : 'emitida',
            fecha_descarga: new Date().toISOString(),
            ...camposXml
          })

        } else {
          // Ya existe, solo actualizar campos del XML
          const camposXml = this.xmlParser.extraerCampos(f.urlDescarga)
          this.facturaRepository.actualizar(f.uuid, {
            xml: f.urlDescarga,
            ...camposXml
          })
        }
        this.pendienteRepository.eliminar(f.uuid)
        guardadas++

      }

      for (const e of errores) {
        if (e.fila) {
          this.pendienteRepository.insertar({
            uuid: e.uuid,
            rfc_emisor: e.fila.rfc_emisor,
            nombre_emisor: e.fila.nombre_emisor,
            rfc_receptor: e.fila.rfc_receptor,
            nombre_receptor: e.fila.nombre_receptor,
            fecha_emision: e.fila.fecha_emision,
            total: e.fila.total,
            tipo_comprobante: e.fila.tipo_comprobante,
            estado: e.fila.estado,
            url_descarga: e.fila.urlDescarga,
            tipo_descarga: params.tipo === 'recibidas' ? 'recibida' : 'emitida',
            error: e.error
          })
        }
      }

      return { total: guardadas, errores }
    } finally {
      await this.scraper.cerrar()
    }
  }

  async reintentarPendientes(
    config: Configuracion,
    captcha?: string,
    onProgreso?: (progreso: ProgresoDescarga) => void
  ): Promise<{ total: number; errores: { uuid: string; error: string }[] }> {
    try {
      const pendientes = this.pendienteRepository.obtenerTodas()
      if (pendientes.length === 0) return { total: 0, errores: [] }

      await this.scraper.iniciar()
      const { facturas, errores } = await this.scraper.reintentarDescargas(
        config, captcha, pendientes, onProgreso
      )

      let guardadas = 0
      for (const f of facturas) {
        if (!f.urlDescarga) continue
        const yaExiste = this.facturaRepository.obtenerPorUuid(f.uuid)
        if (!yaExiste) {
          const camposXml = this.xmlParser.extraerCampos(f.urlDescarga)
          this.facturaRepository.insertar({
            uuid: f.uuid,
            fecha_emision: f.fecha_emision,
            rfc_emisor: f.rfc_emisor,
            nombre_emisor: f.nombre_emisor,
            rfc_receptor: f.rfc_receptor,
            nombre_receptor: f.nombre_receptor,
            subtotal: f.total,
            total: f.total,
            tipo_comprobante: f.tipo_comprobante as 'I' | 'E' | 'T' | 'N' | 'P',
            estado: f.estado as 'vigente' | 'cancelado',
            xml: f.urlDescarga,
            tipo_descarga: f.tipo_descarga as 'recibida' | 'emitida',
            fecha_descarga: new Date().toISOString(),
            ...camposXml
          })
          this.pendienteRepository.eliminar(f.uuid)
          guardadas++
        }
      }

      for (const e of errores) {
        const pendiente = pendientes.find(p => p.uuid === e.uuid)
        if (pendiente) {
          this.pendienteRepository.insertar({ ...pendiente, error: e.error })
        }
      }

      return { total: guardadas, errores }
    } finally {
      await this.scraper.cerrar()
    }
  }

  // Consultas simples
  obtenerFacturas() {
    return this.facturaRepository.obtenerTodas()
  }

  obtenerFacturaPorUuid(uuid: string) {
    return this.facturaRepository.obtenerPorUuid(uuid)
  }

  eliminarFactura(uuid: string) {
    return this.facturaRepository.eliminar(uuid)
  }

  obtenerPendientes() {
    return this.pendienteRepository.obtenerTodas()
  }

  contarPendientes() {
    return this.pendienteRepository.contar()
  }

  limpiarPendientes() {
    return this.pendienteRepository.limpiar()
  }
}