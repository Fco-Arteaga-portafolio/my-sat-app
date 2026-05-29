import { app } from 'electron'
import { SatUnifiedAuthService } from '../scraper/SatUnifiedAuthService'
import { SatBusquedaService } from '../scraper/SatBusquedaService'
import { SatDescargaService } from '../scraper/SatDescargaService'
import { CfdiGuardadoService } from './CfdiGuardadoService'
import { DescargaHelper } from './DescargaHelper'
import { FacturaRepository } from '../database/repositories/FacturaRepository'
import { DescargaPendienteRepository } from '../database/repositories/DescargaPendienteRepository'
import { ConciliacionRepository } from '../database/repositories/ConciliacionRepository'
import { Configuracion } from './ConfiguracionService'
import { ParametrosBusqueda, ProgresoDescarga } from '../scraper/SatTypes'
import { CiecCredentials, FielCredentials } from '../scraper/SatPortalConfig'
import { logger } from './LoggerService'

const PORTAL_FACTURAS = 'facturas'

// ─── Tipos propios del módulo CFDI ───────────────────────────────────────────

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

// ─── Servicio ─────────────────────────────────────────────────────────────────

export class CfdiService {
    private readonly descargaHelper: DescargaHelper

    constructor(
        private readonly authService: SatUnifiedAuthService,
        private readonly busquedaService: SatBusquedaService,
        private readonly descargaService: SatDescargaService,
        private readonly guardadoService: CfdiGuardadoService,
        private readonly facturaRepository: FacturaRepository,
        private readonly pendienteRepository: DescargaPendienteRepository,
        private readonly conciliacionRepository: ConciliacionRepository
    ) {
        this.descargaHelper = new DescargaHelper(guardadoService)
    }

    // ─── Auth privado ──────────────────────────────────────────────────────────

    private async login(config: Configuracion, captcha?: string) {
        if (config.metodoAuth === 'contrasena') {
            const creds: CiecCredentials = {
                rfc: config.rfc,
                password: config.contrasena!,
                captcha
            }
            return this.authService.loginCiec(PORTAL_FACTURAS, creds)
        }
        const creds: FielCredentials = {
            rutaCer: config.rutaCer!,
            rutaKey: config.rutaKey!,
            contrasenaFiel: config.contrasenaFiel!
        }
        return this.authService.loginFiel(PORTAL_FACTURAS, creds)
    }

    // ─── Descarga por rango de fechas ──────────────────────────────────────────

    async descargar(
        config: Configuracion,
        params: ParametrosBusqueda,
        captcha?: string,
        onProgreso?: (p: ProgresoDescarga) => void
    ): Promise<{ total: number; errores: { uuid: string; error: string }[] }> {
        logger.log('CfdiService', 'Iniciando descarga', { rfc: config.rfc, tipo: params.tipo })

        try {
            const page = await this.login(config, captcha)
            const carpetaTemp = config.carpetaDescarga || app.getPath('downloads')
            const tipoDes = params.tipo === 'recibidas' ? 'recibida' : 'emitida'

            onProgreso?.({ etapa: 'buscando' })
            const filas = await this.busquedaService.buscarPorParametros(
                page, params,
                (mesActual, totalMeses) => onProgreso?.({ etapa: 'buscando', mesActual, totalMeses })
            )
            logger.log('CfdiService', `${filas.length} facturas encontradas`)

            const { exitosas, errores: erroresDescarga } = await this.descargaService.descargarEnLote(
                page, filas.map(f => ({ ...f, tipo_descarga: tipoDes })), carpetaTemp,
                (descargadas, totalFacturas, uuid) => onProgreso?.({ etapa: 'descargando', descargadas, totalFacturas, uuid })
            )

            const { guardadas, errores } = await this.descargaHelper.procesarDescargas(exitosas)

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

            return {
                total: guardadas,
                errores: [...errores, ...erroresDescarga.map(e => ({ uuid: e.uuid, error: e.error }))]
            }
        } finally {
            await this.authService.cerrarSesion()
        }
    }

    // ─── Reintentar pendientes por UUID ───────────────────────────────────────

    async reintentar(
        config: Configuracion,
        captcha?: string,
        onProgreso?: (p: ProgresoDescarga) => void
    ): Promise<{ total: number; errores: { uuid: string; error: string }[] }> {
        const pendientes = this.pendienteRepository.obtenerTodas()
        if (!pendientes.length) return { total: 0, errores: [] }

        try {
            const page = await this.login(config, captcha)
            const carpetaTemp = config.carpetaDescarga || app.getPath('downloads')
            let guardadas = 0
            const errores: { uuid: string; error: string }[] = []

            for (let i = 0; i < pendientes.length; i++) {
                const pendiente = pendientes[i]
                onProgreso?.({ etapa: 'descargando', descargadas: i, totalFacturas: pendientes.length, uuid: pendiente.uuid })

                try {
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
        } finally {
            await this.authService.cerrarSesion()
        }
    }

    // ─── Conciliación por mes ──────────────────────────────────────────────────

    async conciliar(
        config: Configuracion,
        params: ParametrosConciliacion,
        onProgreso?: (p: ProgresoConciliacion) => void
    ): Promise<ResumenConciliacion> {
        const mes = params.periodo.padStart(2, '0')
        const ultimoDia = new Date(parseInt(params.ejercicio), parseInt(mes), 0).getDate()
        const fechaInicio = `01/${mes}/${params.ejercicio}`
        const fechaFin = `${ultimoDia}/${mes}/${params.ejercicio}`
        const tipoDes = params.tipo === 'recibidas' ? 'recibida' : 'emitida'
        const carpetaTemp = config.carpetaDescarga || app.getPath('downloads')

        try {
            const page = await this.login(config, params.captcha)

            onProgreso?.({ etapa: 'consultando' })
            const filasSat = await this.busquedaService.buscarEnPagina(page, {
                tipo: params.tipo,
                buscarPor: 'fecha',
                fechaInicio,
                fechaFin
            })

            onProgreso?.({ etapa: 'comparando' })
            const faltantes = filasSat.filter(f => !this.facturaRepository.obtenerPorUuid(f.uuid))
            const aActualizar = filasSat.filter(f => {
                const local = this.facturaRepository.obtenerPorUuid(f.uuid)
                return local?.estado === 'vigente' && f.estado === 'cancelado'
            })

            let descargadas = 0
            const errores: { uuid: string; error: string }[] = []

            if (faltantes.length) {
                onProgreso?.({ etapa: 'descargando', descargadas: 0, totalFaltantes: faltantes.length })
                const { exitosas, errores: erroresDescarga } = await this.descargaService.descargarEnLote(
                    page, faltantes.map(f => ({ ...f, tipo_descarga: tipoDes })), carpetaTemp,
                    (desc) => onProgreso?.({ etapa: 'descargando', descargadas: desc, totalFaltantes: faltantes.length })
                )
                const { guardadas, errores: erroresGuardado } = await this.descargaHelper.procesarDescargas(exitosas)
                descargadas = guardadas
                errores.push(...erroresGuardado, ...erroresDescarga.map(e => ({ uuid: e.uuid, error: e.error })))
            }

            let actualizadas = 0
            if (aActualizar.length) {
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

            this.conciliacionRepository.insertar({
                tipo: params.tipo,
                ejercicio: params.ejercicio,
                periodo: params.periodo,
                total_sat: filasSat.length,
                total_local: filasSat.length - faltantes.length,
                descargadas,
                actualizadas,
                errores: errores.length
            })

            this.guardadoService.sincronizarCatalogos()
            onProgreso?.({ etapa: 'completado' })

            return { totalSat: filasSat.length, totalLocal: filasSat.length - faltantes.length, descargadas, actualizadas, errores }
        } finally {
            await this.authService.cerrarSesion()
        }
    }

    // ─── Queries (sin cambio de lógica) ───────────────────────────────────────

    obtenerFacturas() { return this.facturaRepository.obtenerTodas() }
    obtenerFacturaPorUuid(uuid: string) { return this.facturaRepository.obtenerPorUuid(uuid) }
    eliminarFactura(uuid: string) { return this.facturaRepository.eliminar(uuid) }
    obtenerDrillDown(rfc: string) { return this.facturaRepository.obtenerDrillDown(rfc) }
    obtenerFacturasPorTipo(
        tipoDescarga: 'recibida' | 'emitida',
        filtros: Parameters<FacturaRepository['obtenerPorTipoDescarga']>[1]
    ) { return this.facturaRepository.obtenerPorTipoDescarga(tipoDescarga, filtros) }
    obtenerPendientes() { return this.pendienteRepository.obtenerTodas() }
    contarPendientes() { return this.pendienteRepository.contar() }
    limpiarPendientes() { return this.pendienteRepository.limpiar() }
    obtenerUltimaConciliacion(tipo: string, ejercicio: string, periodo: string) {
        return this.conciliacionRepository.obtenerUltima(tipo, ejercicio, periodo)
    }
    obtenerHistorialConciliaciones() { return this.conciliacionRepository.obtenerHistorial() }
}