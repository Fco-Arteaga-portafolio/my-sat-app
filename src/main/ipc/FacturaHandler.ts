import { ipcMain } from 'electron'
import { DescargaService } from '../services/DescargaService'
import { ConfiguracionService } from '../services/ConfiguracionService'
import { ParametrosBusqueda, SatScraper } from '../scraper/SatScraper'
import { PdfService, Plantilla } from '../services/PdfService'

export class FacturaHandler {
  constructor(
    private readonly descargaService: DescargaService,
    private readonly configuracionService: ConfiguracionService,
    private readonly scraper: SatScraper
  ) { }

  registrar(): void {
    ipcMain.handle('obtener-captcha', async () => {
      try {
        const imagenBase64 = await this.descargaService.obtenerCaptcha()
        return { success: true, imagenBase64 }
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
        const mensaje = String(error)
        if (mensaje.includes('SAT_SATURADO')) {
          return { success: false, error: 'El SAT se encuentra saturado en este momento. Intenta de nuevo en 20 minutos.' }
        }
        if (mensaje.includes('CAPTCHA_INVALIDO')) {
          return { success: false, error: 'El captcha es incorrecto. Recarga el captcha e intenta de nuevo.' }
        }
        return { success: false, error: mensaje }
      } finally {
        await this.scraper.cerrar()
      }
    })

    ipcMain.handle('reintentar-pendientes', async (event, datos: { captcha?: string }) => {
      try {
        const config = this.configuracionService.obtener()
        if (!config) return { success: false, error: 'No hay configuración guardada' }

        const resultado = await this.descargaService.reintentarPendientes(
          config,
          datos.captcha,
          (progreso) => event.sender.send('progreso-descarga', progreso)
        )
        return { success: true, total: resultado.total, errores: resultado.errores }
      } catch (error) {
        const mensaje = String(error)
        if (mensaje.includes('SAT_SATURADO')) {
          return { success: false, error: 'El SAT se encuentra saturado. Intenta en 20 minutos.' }
        }
        if (mensaje.includes('CAPTCHA_INVALIDO')) {
          return { success: false, error: 'El captcha es incorrecto. Intenta de nuevo.' }
        }
        return { success: false, error: mensaje }
      } finally {
        await this.scraper.cerrar()
      }
    })

    ipcMain.handle('obtener-facturas', async () => {
      try {
        const facturas = this.descargaService.obtenerFacturas()
        return { success: true, facturas }
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
        const contenido = fs.readFileSync(ruta, 'utf-8')
        return { success: true, contenido }
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
        await pdfService.generarPdf(
          datos.xmlContenido,
          datos.parseada,
          datos.uuid,
          datos.plantilla,
          datos.rutaDestino
        )
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('obtener-pendientes', async () => {
      try {
        const pendientes = this.descargaService.obtenerPendientes()
        return { success: true, pendientes }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('contar-pendientes', async () => {
      try {
        const total = this.descargaService.contarPendientes()
        return { success: true, total }
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
        const data = this.descargaService.obtenerDrillDown(rfc)
        return { success: true, data }
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

        const buffer = fs.readFileSync(rutaPdf)
        const base64 = buffer.toString('base64')
        return { success: true, base64, rutaPdf }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }
}