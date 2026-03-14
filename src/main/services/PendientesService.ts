import { app } from 'electron'
import { SatAuthService } from '../scraper/SatAuthService'
import { SatBusquedaService } from '../scraper/SatBusquedaService'
import { SatDescargaService } from '../scraper/SatDescargaService'
import { CfdiGuardadoService } from './CfdiGuardadoService'
import { DescargaPendienteRepository } from '../database/repositories/DescargaPendienteRepository'
import { Configuracion } from './ConfiguracionService'
import { ProgresoDescarga } from '../scraper/SatTypes'

export class PendientesService {
    constructor(
        private readonly authService: SatAuthService,
        private readonly busquedaService: SatBusquedaService,
        private readonly descargaService: SatDescargaService,
        private readonly guardadoService: CfdiGuardadoService,
        private readonly pendienteRepository: DescargaPendienteRepository
    ) { }

    async reintentar(
        config: Configuracion,
        captcha?: string,
        onProgreso?: (progreso: ProgresoDescarga) => void
    ): Promise<{ total: number; errores: { uuid: string; error: string }[] }> {
        const pendientes = this.pendienteRepository.obtenerTodas()
        if (pendientes.length === 0) return { total: 0, errores: [] }

        const page = await this.login(config, captcha)
        const carpetaTemp = config.carpetaDescarga || app.getPath('downloads')

        let guardadas = 0
        const errores: { uuid: string; error: string }[] = []

        for (let i = 0; i < pendientes.length; i++) {
            const pendiente = pendientes[i]

            onProgreso?.({
                etapa: 'descargando',
                descargadas: i,
                totalFacturas: pendientes.length,
                uuid: pendiente.uuid
            })

            try {
                // Buscar URL fresca por UUID
                const tipoBusqueda = pendiente.tipo_descarga === 'recibida' ? 'recibidas' : 'emitidas'
                const filas = await this.busquedaService.buscarEnPagina(page, {
                    tipo: tipoBusqueda,
                    buscarPor: 'folio',
                    folioFiscal: pendiente.uuid
                })

                if (!filas.length || !filas[0].urlDescarga) {
                    errores.push({ uuid: pendiente.uuid, error: 'No encontrado en el portal' })
                    continue
                }

                const rutaTemp = await this.descargaService.descargarUnoConPlaywright(
                    page, filas[0].urlDescarga, pendiente.uuid, carpetaTemp
                )

                if (!rutaTemp) {
                    errores.push({ uuid: pendiente.uuid, error: 'No se pudo descargar el archivo' })
                    continue
                }

                this.guardadoService.guardarDesdeRuta(rutaTemp, {
                    uuid: pendiente.uuid,
                    rfc_emisor: pendiente.rfc_emisor,
                    nombre_emisor: pendiente.nombre_emisor,
                    rfc_receptor: pendiente.rfc_receptor,
                    nombre_receptor: pendiente.nombre_receptor,
                    fecha_emision: pendiente.fecha_emision,
                    total: pendiente.total,
                    tipo_comprobante: pendiente.tipo_comprobante,
                    estado: pendiente.estado,
                    tipo_descarga: pendiente.tipo_descarga as 'recibida' | 'emitida'
                })

                guardadas++
            } catch (err: any) {
                errores.push({ uuid: pendiente.uuid, error: err.message })
            }
        }

        this.guardadoService.sincronizarCatalogos()
        onProgreso?.({ etapa: 'completado', totalFacturas: guardadas })

        return { total: guardadas, errores }
    }

    private async login(config: Configuracion, captcha?: string) {
        if (config.metodoAuth === 'contrasena') {
            return this.authService.loginConContrasena(config.rfc, config.contrasena!, captcha!)
        }
        return this.authService.loginConEfirma(config.rutaCer!, config.rutaKey!, config.contrasenaFiel!)
    }
}