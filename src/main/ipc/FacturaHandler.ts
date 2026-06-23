import { ConfiguracionService } from '../services/ConfiguracionService'
import { ParametrosBusqueda } from '../scraper/SatTypes'
import { PdfService } from '../services/PdfService'
import { PagoComplementoRepository } from '../database/repositories/PagoComplementoRepository'
import BetterSqlite3 from 'better-sqlite3'
import { LicenseService } from '../services/LicenseService'
import { LicenseRepository } from '../database/repositories/LicenseRepository'
import { IpcWrapper } from './IpcWrapper'
import { LicenseHelper } from '../services/LicenseHelper'
import { logger } from '../services/LoggerService'
import { CfdiService } from '../services/CfdiService'
import { SatUnifiedAuthService } from '../scraper/SatUnifiedAuthService'

export class FacturaHandler {
  private readonly pagoComplementoRepository: PagoComplementoRepository
  private readonly licenseService: LicenseService
  private readonly licenseHelper: LicenseHelper

  constructor(
    private readonly cfdiService: CfdiService,
    private readonly authService: SatUnifiedAuthService,
    private readonly configuracionService: ConfiguracionService,
    db: BetterSqlite3.Database
  ) {
    this.pagoComplementoRepository = new PagoComplementoRepository(db)
    const licenseRepository = new LicenseRepository(db)
    this.licenseService = new LicenseService(licenseRepository)
    this.licenseHelper = new LicenseHelper(this.licenseService, db)
  }

  registrar(): void {
    IpcWrapper.handle('obtener-captcha', async () => {
      logger.log('FacturaHandler', 'Solicitando captcha')
      const captcha = await this.authService.obtenerCaptcha('facturas')
      return { imagenBase64: captcha.imagenBase64 }
    })

    IpcWrapper.handle('descargar-facturas', async (event, datos: {
      captcha?: string
      params: ParametrosBusqueda
    }) => {
      logger.log('FacturaHandler', 'Iniciando descarga de facturas', { params: datos.params })
      const validacion = this.licenseHelper.validateFeature('descarga')
      if (!validacion.valido) throw new Error(validacion.motivo)

      const config = this.configuracionService.obtener()
      if (!config) throw new Error('No hay configuración guardada')

      const resultado = await this.cfdiService.descargar(
        config, datos.params, datos.captcha,
        (progreso) => event.sender.send('progreso-descarga', progreso)
      )

      if (resultado.total > 0 && !resultado.errores.length) {
        this.licenseHelper.incrementCounter('descargas')
      }

      logger.log('FacturaHandler', 'Descarga completada', { total: resultado.total, errores: resultado.errores.length })
      return { total: resultado.total, errores: resultado.errores }
    })

    IpcWrapper.handle('reintentar-pendientes', async (event, datos: { captcha?: string }) => {
      logger.log('FacturaHandler', 'Reintentando facturas pendientes')
      const validacion = this.licenseHelper.validateFeature('descarga')
      if (!validacion.valido) throw new Error(validacion.motivo)

      const config = this.configuracionService.obtener()
      if (!config) throw new Error('No hay configuración guardada')

      const resultado = await this.cfdiService.reintentar(
        config, datos.captcha,
        (progreso) => event.sender.send('progreso-descarga', progreso)
      )

      if (resultado.total > 0 && !resultado.errores.length) {
        this.licenseHelper.incrementCounter('descargas')
      }

      logger.log('FacturaHandler', 'Reintento completado', { total: resultado.total })
      return { total: resultado.total, errores: resultado.errores }
    })

    IpcWrapper.handle('obtener-facturas', () => ({
      facturas: this.cfdiService.obtenerFacturas()
    }))

    IpcWrapper.handle('obtener-facturas-por-tipo', async (_, datos: any) => ({
      facturas: this.cfdiService.obtenerFacturasPorTipo(datos.tipoDescarga, datos.filtros ?? {})
    }))

    IpcWrapper.handle('obtener-pago-complemento', async (_, uuid_rep: string) => {
      const pago = this.pagoComplementoRepository.obtenerPorUuidRep(uuid_rep)
      return {
        pago: pago ? { ...pago, documentos: pago.documentos ? JSON.parse(pago.documentos) : [] } : null
      }
    })

    IpcWrapper.handle('eliminar-factura', async (_, uuid: string) => {
      this.cfdiService.eliminarFactura(uuid)
      this.pagoComplementoRepository.eliminar(uuid)
      return {}
    })

    IpcWrapper.handle('abrir-archivo', async (_, ruta: string) => {
      const { shell } = require('electron')
      const { platform } = require('os')
      const url = platform() === 'win32' ? `file:///${ruta.replace(/\\/g, '/')}` : `file://${ruta}`
      await shell.openExternal(url)
      return {}
    })

    IpcWrapper.handle('leer-xml', async (_, ruta: string) => {
      const fs = require('fs')
      return { contenido: fs.readFileSync(ruta, 'utf-8') }
    })

    IpcWrapper.handle('generar-pdf', async (_, datos: any) => {
      const pdfService = new PdfService()
      await pdfService.generarPdf(datos.xmlContenido, datos.parseada, datos.uuid, datos.plantilla, datos.rutaDestino)
      return {}
    })

    IpcWrapper.handle('obtener-pendientes', () => ({
      pendientes: this.cfdiService.obtenerPendientes()
    }))

    IpcWrapper.handle('contar-pendientes', () => ({
      total: this.cfdiService.contarPendientes()
    }))

    IpcWrapper.handle('limpiar-pendientes', () => {
      this.cfdiService.limpiarPendientes()
      return {}
    })

    IpcWrapper.handle('facturas-drill-down', async (_, rfc: string) => ({
      data: this.cfdiService.obtenerDrillDown(rfc)
    }))

    IpcWrapper.handle('obtener-pdf-factura', async (_, datos: any) => {
      const fs = require('fs')
      const rutaPdf = datos.rutaXml.replace(/\.xml$/i, '.pdf')
      if (!fs.existsSync(rutaPdf)) {
        const xmlContenido = fs.readFileSync(datos.rutaXml, 'utf-8')
        const pdfService = new PdfService()
        const plantilla = this.configuracionService.obtener()?.plantillaDefault ?? 'clasica'
        await pdfService.generarPdf(xmlContenido, datos.parseada, datos.uuid, plantilla as any, rutaPdf)
      }
      const base64 = fs.readFileSync(rutaPdf).toString('base64')
      logger.log('FacturaHandler', 'PDF base64 generado', { rutaPdf, tamaño: base64.length }) // 👈
      return { base64, rutaPdf }
    })

    IpcWrapper.handle('imprimir-pdf', async (event) => {
      event.sender.print({}, (success: boolean, reason: string) => {
        if (!success) console.error('Error al imprimir:', reason)
      })
      return {}
    })
  }
}