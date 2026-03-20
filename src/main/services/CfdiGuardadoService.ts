import * as fs from 'fs'
import { FacturaRepository } from '../database/repositories/FacturaRepository'
import { DescargaPendienteRepository } from '../database/repositories/DescargaPendienteRepository'
import { CatalogoRepository } from '../database/repositories/CatalogoRepository'
import { PagoComplementoRepository } from '../database/repositories/PagoComplementoRepository'
import { NominaComplementoRepository } from '../database/repositories/NominaComplementoRepository'
import { XmlParserService } from './XmlParserService'
import { RutaArchivoService } from './RutaArchivoService'
import { ProfileManager } from '../database/ProfileManager'
import { MetaCfdi } from '../scraper/SatTypes'
import BetterSqlite3 from 'better-sqlite3'

export class CfdiGuardadoService {
    private readonly xmlParser = new XmlParserService()
    private readonly rutaService = new RutaArchivoService()
    private readonly catalogoRepository: CatalogoRepository
    private readonly pagoComplementoRepository: PagoComplementoRepository
    private readonly nominaComplementoRepository: NominaComplementoRepository

    constructor(
        private readonly facturaRepository: FacturaRepository,
        private readonly pendienteRepository: DescargaPendienteRepository,
        db: BetterSqlite3.Database
    ) {
        this.catalogoRepository = new CatalogoRepository(db)
        this.pagoComplementoRepository = new PagoComplementoRepository(db)
        this.nominaComplementoRepository = new NominaComplementoRepository(db)
    }

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
        const { complementoPago, complementoNomina, ...camposSinComplemento } = camposXml
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
                ...camposSinComplemento
            })
        } else {
            this.facturaRepository.actualizar(meta.uuid, { xml: rutaDestino, ...camposSinComplemento })
        }

        if (meta.tipo_comprobante === 'P' && complementoPago) {
            this.pagoComplementoRepository.insertar({
                uuid_rep: meta.uuid,
                fecha_pago: complementoPago.fecha_pago,
                forma_pago_p: complementoPago.forma_pago_p,
                moneda_p: complementoPago.moneda_p,
                tipo_cambio_p: complementoPago.tipo_cambio_p,
                monto: complementoPago.monto,
                documentos: JSON.stringify(complementoPago.documentos)
            })
        }

        if (meta.tipo_comprobante === 'N' && complementoNomina) {
            this.nominaComplementoRepository.insertar({
                uuid_cfdi: meta.uuid,
                tipo_nomina: complementoNomina.tipo_nomina,
                fecha_pago: complementoNomina.fecha_pago,
                fecha_inicial_pago: complementoNomina.fecha_inicial_pago,
                fecha_final_pago: complementoNomina.fecha_final_pago,
                num_dias_pagados: complementoNomina.num_dias_pagados,
                total_percepciones: complementoNomina.total_percepciones,
                total_deducciones: complementoNomina.total_deducciones,
                total_otros_pagos: complementoNomina.total_otros_pagos,
                curp: complementoNomina.curp,
                num_empleado: complementoNomina.num_empleado,
                departamento: complementoNomina.departamento,
                puesto: complementoNomina.puesto,
                tipo_regimen: complementoNomina.tipo_regimen,
                tipo_contrato: complementoNomina.tipo_contrato,
                periodicidad_pago: complementoNomina.periodicidad_pago,
                salario_diario_integrado: complementoNomina.salario_diario_integrado,
                percepciones: JSON.stringify(complementoNomina.percepciones),
                deducciones: JSON.stringify(complementoNomina.deducciones),
                otros_pagos: JSON.stringify(complementoNomina.otros_pagos),
                incapacidades: JSON.stringify(complementoNomina.incapacidades)
            })
        }

        this.pendienteRepository.eliminar(meta.uuid)
    }

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

        const { complementoPago, complementoNomina, ...camposSinComplemento } = camposXml

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
            ...camposSinComplemento
        })

        if (camposXml.tipo_comprobante === 'P' && complementoPago) {
            this.pagoComplementoRepository.insertar({
                uuid_rep: camposXml.uuid,
                fecha_pago: complementoPago.fecha_pago,
                forma_pago_p: complementoPago.forma_pago_p,
                moneda_p: complementoPago.moneda_p,
                tipo_cambio_p: complementoPago.tipo_cambio_p,
                monto: complementoPago.monto,
                documentos: JSON.stringify(complementoPago.documentos)
            })
        }

        if (camposXml.tipo_comprobante === 'N' && complementoNomina) {
            this.nominaComplementoRepository.insertar({
                uuid_cfdi: camposXml.uuid,
                tipo_nomina: complementoNomina.tipo_nomina,
                fecha_pago: complementoNomina.fecha_pago,
                fecha_inicial_pago: complementoNomina.fecha_inicial_pago,
                fecha_final_pago: complementoNomina.fecha_final_pago,
                num_dias_pagados: complementoNomina.num_dias_pagados,
                total_percepciones: complementoNomina.total_percepciones,
                total_deducciones: complementoNomina.total_deducciones,
                total_otros_pagos: complementoNomina.total_otros_pagos,
                curp: complementoNomina.curp,
                num_empleado: complementoNomina.num_empleado,
                departamento: complementoNomina.departamento,
                puesto: complementoNomina.puesto,
                tipo_regimen: complementoNomina.tipo_regimen,
                tipo_contrato: complementoNomina.tipo_contrato,
                periodicidad_pago: complementoNomina.periodicidad_pago,
                salario_diario_integrado: complementoNomina.salario_diario_integrado,
                percepciones: JSON.stringify(complementoNomina.percepciones),
                deducciones: JSON.stringify(complementoNomina.deducciones),
                otros_pagos: JSON.stringify(complementoNomina.otros_pagos),
                incapacidades: JSON.stringify(complementoNomina.incapacidades)
            })
        }

        return 'importada'
    }

    actualizarEstado(uuid: string, estado: 'vigente' | 'cancelado'): void {
        this.facturaRepository.actualizar(uuid, { estado })
    }

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