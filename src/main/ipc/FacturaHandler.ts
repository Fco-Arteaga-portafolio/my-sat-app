import { ipcMain } from 'electron'
import { DescargaService } from '../services/DescargaService'
import { PendientesService } from '../services/PendientesService'
import { ConfiguracionService } from '../services/ConfiguracionService'
import { SatAuthService } from '../scraper/SatAuthService'
import { ParametrosBusqueda } from '../scraper/SatTypes'
import { PdfService, Plantilla } from '../services/PdfService'
import { manejarErrorSat } from './satErrores'

export class FacturaHandler {
  constructor(
    private readonly descargaService: DescargaService,
    private readonly pendientesService: PendientesService,
    private readonly configuracionService: ConfiguracionService,
    private readonly authService: SatAuthService
  ) { }

  registrar(): void {
    ipcMain.handle('obtener-captcha', async () => {
      try {
        const imagenBase64 = await this.authService.obtenerCaptcha()
        return { success: true, imagenBase64: imagenBase64.imagenBase64 }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('descargar-facturas', async (event, datos: {
      captcha?: string
      params: ParametrosBusqueda
    }) => {
      try {
        const config = this.configuracionService.obtener()
        if (!config) return { success: false, error: 'No hay configuración guardada' }

        const resultado = await this.descargaService.descargar(
          config,
          datos.params,
          datos.captcha,
          (progreso) => event.sender.send('progreso-descarga', progreso)
        )
        return { success: true, total: resultado.total, errores: resultado.errores }
      } catch (error) {
        return { success: false, error: manejarErrorSat(error) }
      } finally {
        await this.authService.cerrarSesion()
      }
    })

    ipcMain.handle('reintentar-pendientes', async (event, datos: { captcha?: string }) => {
      try {
        const config = this.configuracionService.obtener()
        if (!config) return { success: false, error: 'No hay configuración guardada' }

        const resultado = await this.pendientesService.reintentar(
          config,
          datos.captcha,
          (progreso) => event.sender.send('progreso-descarga', progreso)
        )
        return { success: true, total: resultado.total, errores: resultado.errores }
      } catch (error) {
        return { success: false, error: manejarErrorSat(error) }
      } finally {
        await this.authService.cerrarSesion()
      }
    })

    ipcMain.handle('obtener-facturas', async () => {
      try {
        return { success: true, facturas: this.descargaService.obtenerFacturas() }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('eliminar-factura', async (_, uuid: string) => {
      try {
        this.descargaService.eliminarFactura(uuid)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('abrir-archivo', async (_, ruta: string) => {
      const { shell } = require('electron')
      const { platform } = require('os')
      if (platform() === 'win32') {
        await shell.openExternal(`file:///${ruta.replace(/\\/g, '/')}`)
      } else {
        await shell.openExternal(`file://${ruta}`)
      }
    })

    ipcMain.handle('leer-xml', async (_, ruta: string) => {
      try {
        const fs = require('fs')
        return { success: true, contenido: fs.readFileSync(ruta, 'utf-8') }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('generar-pdf', async (_, datos: {
      xmlContenido: string
      parseada: any
      uuid: string
      plantilla: Plantilla
      rutaDestino: string
    }) => {
      try {
        const pdfService = new PdfService()
        await pdfService.generarPdf(datos.xmlContenido, datos.parseada, datos.uuid, datos.plantilla, datos.rutaDestino)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('obtener-pendientes', async () => {
      try {
        return { success: true, pendientes: this.descargaService.obtenerPendientes() }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('contar-pendientes', async () => {
      try {
        return { success: true, total: this.descargaService.contarPendientes() }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('limpiar-pendientes', async () => {
      try {
        this.descargaService.limpiarPendientes()
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('facturas-drill-down', async (_, rfc: string) => {
      try {
        return { success: true, data: this.descargaService.obtenerDrillDown(rfc) }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('obtener-pdf-factura', async (_, datos: {
      rutaXml: string
      uuid: string
      parseada: any
    }) => {
      try {
        const fs = require('fs')
        const rutaPdf = datos.rutaXml.replace(/\.xml$/i, '.pdf')

        if (!fs.existsSync(rutaPdf)) {
          const xmlContenido = fs.readFileSync(datos.rutaXml, 'utf-8')
          const pdfService = new PdfService()
          const plantilla = this.configuracionService.obtener()?.plantillaDefault ?? 'clasica'
          await pdfService.generarPdf(xmlContenido, datos.parseada, datos.uuid, plantilla as any, rutaPdf)
        }

        const base64 = fs.readFileSync(rutaPdf).toString('base64')
        return { success: true, base64, rutaPdf }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }
}