import * as fs from 'fs'
import { FacturaRepository } from '../database/repositories/FacturaRepository'
import { DescargaPendienteRepository } from '../database/repositories/DescargaPendienteRepository'
import { CatalogoRepository } from '../database/repositories/CatalogoRepository'
import { XmlParserService } from './XmlParserService'
import { RutaArchivoService } from './RutaArchivoService'
import { ProfileManager } from '../database/ProfileManager'
import { MetaCfdi } from '../scraper/SatTypes'
import BetterSqlite3 from 'better-sqlite3'

export class CfdiGuardadoService {
    private readonly xmlParser = new XmlParserService()
    private readonly rutaService = new RutaArchivoService()
    private readonly catalogoRepository: CatalogoRepository

    constructor(
        private readonly facturaRepository: FacturaRepository,
        private readonly pendienteRepository: DescargaPendienteRepository,
        db: BetterSqlite3.Database
    ) {
        this.catalogoRepository = new CatalogoRepository(db)
    }

    // Descarga / conciliación — el XML ya está en rutaTemp
    guardarDesdeRuta(rutaTemp: string, meta: MetaCfdi): void {
        const rutaDestino = this.rutaService.construirRutaXml({
            uuid: meta.uuid,
            fecha_emision: meta.fecha_emision,
            rfc_emisor: meta.rfc_emisor,
            rfc_receptor: meta.rfc_receptor,
            tipo_descarga: meta.tipo_descarga
        })

        fs.copyFileSync(rutaTemp, rutaDestino)

        const camposXml = this.xmlParser.extraerCampos(rutaDestino)
        const yaExiste = this.facturaRepository.obtenerPorUuid(meta.uuid)

        if (!yaExiste) {
            this.facturaRepository.insertar({
                uuid: meta.uuid,
                fecha_emision: meta.fecha_emision,
                rfc_emisor: meta.rfc_emisor,
                nombre_emisor: meta.nombre_emisor,
                rfc_receptor: meta.rfc_receptor,
                nombre_receptor: meta.nombre_receptor,
                subtotal: meta.total,
                total: meta.total,
                tipo_comprobante: meta.tipo_comprobante as 'I' | 'E' | 'T' | 'N' | 'P',
                estado: meta.estado as 'vigente' | 'cancelado',
                xml: rutaDestino,
                tipo_descarga: meta.tipo_descarga,
                fecha_descarga: new Date().toISOString(),
                ...camposXml
            })
        } else {
            this.facturaRepository.actualizar(meta.uuid, { xml: rutaDestino, ...camposXml })
        }

        this.pendienteRepository.eliminar(meta.uuid)
    }

    // Importación manual — el XML ya está en ruta local del usuario
    importarDesdeRutaLocal(rutaOrigen: string): 'importada' | 'omitida' {
        const perfil = ProfileManager.getPerfilActivo()
        if (!perfil) throw new Error('No hay perfil activo')

        const camposXml = this.xmlParser.extraerCampos(rutaOrigen)
        if (!camposXml.uuid) throw new Error('No se encontró UUID en el XML')

        const perteneceAlPerfil =
            camposXml.rfc_emisor === perfil.rfc || camposXml.rfc_receptor === perfil.rfc
        if (!perteneceAlPerfil) {
            throw new Error(`El XML no pertenece al contribuyente activo (${perfil.rfc})`)
        }

        const yaExiste = this.facturaRepository.obtenerPorUuid(camposXml.uuid)
        if (yaExiste) return 'omitida'

        const tipoDes = camposXml.rfc_receptor === perfil.rfc ? 'recibida' : 'emitida'

        const rutaDestino = this.rutaService.construirRutaXml({
            uuid: camposXml.uuid,
            fecha_emision: camposXml.fecha_emision || '',
            rfc_emisor: camposXml.rfc_emisor || '',
            rfc_receptor: camposXml.rfc_receptor || '',
            tipo_descarga: tipoDes
        })

        fs.copyFileSync(rutaOrigen, rutaDestino)

        this.facturaRepository.insertar({
            uuid: camposXml.uuid,
            fecha_emision: camposXml.fecha_emision || '',
            rfc_emisor: camposXml.rfc_emisor || '',
            nombre_emisor: camposXml.nombre_emisor || '',
            rfc_receptor: camposXml.rfc_receptor || '',
            nombre_receptor: camposXml.nombre_receptor || '',
            subtotal: camposXml.subtotal || 0,
            total: camposXml.total || 0,
            tipo_comprobante: camposXml.tipo_comprobante as 'I' | 'E' | 'T' | 'N' | 'P' || 'I',
            estado: 'vigente',
            xml: rutaDestino,
            tipo_descarga: tipoDes,
            fecha_descarga: new Date().toISOString(),
            ...camposXml
        })

        return 'importada'
    }

    // Conciliación — actualiza estado de vigente a cancelado
    actualizarEstado(uuid: string, estado: 'vigente' | 'cancelado'): void {
        this.facturaRepository.actualizar(uuid, { estado })
    }

    // Pendientes — registra fallo de descarga para reintentar después
    guardarPendiente(meta: MetaCfdi, error: string): void {
        this.pendienteRepository.insertar({
            uuid: meta.uuid,
            rfc_emisor: meta.rfc_emisor,
            nombre_emisor: meta.nombre_emisor,
            rfc_receptor: meta.rfc_receptor,
            nombre_receptor: meta.nombre_receptor,
            fecha_emision: meta.fecha_emision,
            total: meta.total,
            tipo_comprobante: meta.tipo_comprobante,
            estado: meta.estado,
            url_descarga: '',
            tipo_descarga: meta.tipo_descarga,
            error
        })
    }

    sincronizarCatalogos(): void {
        this.catalogoRepository.sincronizarTodos()
    }
}