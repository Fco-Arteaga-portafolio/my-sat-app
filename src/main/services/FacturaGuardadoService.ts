import * as fs from 'fs'
import { FacturaRepository } from '../database/repositories/FacturaRepository'
import { DescargaPendienteRepository } from '../database/repositories/DescargaPendienteRepository'
import { XmlParserService } from './XmlParserService'
import { RutaArchivoService } from './RutaArchivoService'

export interface FacturaDescargada {
  uuid: string
  fecha_emision: string
  rfc_emisor: string
  nombre_emisor: string
  rfc_receptor: string
  nombre_receptor: string
  total: number
  tipo_comprobante: string
  estado: string
  urlDescarga?: string
  tipo_descarga?: string
}

export class FacturaGuardadoService {
  private xmlParser = new XmlParserService()
  private rutaService = new RutaArchivoService()

  constructor(
    private readonly facturaRepository: FacturaRepository,
    private readonly pendienteRepository: DescargaPendienteRepository
  ) { }

  guardar(factura: FacturaDescargada, tipoDes: 'recibida' | 'emitida'): void {
    if (!factura.urlDescarga) return

    const camposXml = this.xmlParser.extraerCampos(factura.urlDescarga)
    const rutaDestino = this.rutaService.construirRutaXml({
      uuid: factura.uuid,
      fecha_emision: factura.fecha_emision,
      rfc_emisor: factura.rfc_emisor,
      rfc_receptor: factura.rfc_receptor,
      tipo_descarga: tipoDes
    })
    fs.copyFileSync(factura.urlDescarga, rutaDestino)

    const yaExiste = this.facturaRepository.obtenerPorUuid(factura.uuid)
    if (!yaExiste) {
      this.facturaRepository.insertar({
        uuid: factura.uuid,
        fecha_emision: factura.fecha_emision,
        rfc_emisor: factura.rfc_emisor,
        nombre_emisor: factura.nombre_emisor,
        rfc_receptor: factura.rfc_receptor,
        nombre_receptor: factura.nombre_receptor,
        subtotal: factura.total,
        total: factura.total,
        tipo_comprobante: factura.tipo_comprobante as 'I' | 'E' | 'T' | 'N' | 'P',
        estado: factura.estado as 'vigente' | 'cancelado',
        xml: rutaDestino,
        tipo_descarga: tipoDes,
        fecha_descarga: new Date().toISOString(),
        ...camposXml
      })
    } else {
      this.facturaRepository.actualizar(factura.uuid, {
        xml: rutaDestino,
        ...camposXml
      })
    }

    this.pendienteRepository.eliminar(factura.uuid)
  }

  guardarPendiente(
    factura: FacturaDescargada,
    tipoDes: 'recibida' | 'emitida',
    error: string
  ): void {
    this.pendienteRepository.insertar({
      uuid: factura.uuid,
      rfc_emisor: factura.rfc_emisor,
      nombre_emisor: factura.nombre_emisor,
      rfc_receptor: factura.rfc_receptor,
      nombre_receptor: factura.nombre_receptor,
      fecha_emision: factura.fecha_emision,
      total: factura.total,
      tipo_comprobante: factura.tipo_comprobante,
      estado: factura.estado,
      url_descarga: factura.urlDescarga ?? '',  // fix: string | undefined → string
      tipo_descarga: tipoDes,
      error
    })
  }
}