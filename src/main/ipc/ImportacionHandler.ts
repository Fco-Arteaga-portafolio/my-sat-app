import { ipcMain, dialog } from 'electron'
import { XmlParserService } from '../services/XmlParserService'
import { FacturaRepository } from '../database/repositories/FacturaRepository'
import { ProfileManager } from '../database/ProfileManager'
import * as fs from 'fs'
import * as path from 'path'
import BetterSqlite3 from 'better-sqlite3'

export class ImportacionHandler {
  private xmlParser = new XmlParserService()

  constructor(private readonly db: BetterSqlite3.Database) { }

  registrar(): void {
    ipcMain.handle('seleccionar-xmls', async () => {
      const result = await dialog.showOpenDialog({
        title: 'Seleccionar archivos XML',
        filters: [{ name: 'XML', extensions: ['xml'] }],
        properties: ['openFile', 'multiSelections']
      })
      return { success: true, rutas: result.canceled ? [] : result.filePaths }
    })

    ipcMain.handle('seleccionar-carpeta-xml', async () => {
      const result = await dialog.showOpenDialog({
        title: 'Seleccionar carpeta con XMLs',
        properties: ['openDirectory']
      })
      if (result.canceled) return { success: true, rutas: [] }
      const carpeta = result.filePaths[0]
      const archivos = fs.readdirSync(carpeta)
        .filter(f => f.toLowerCase().endsWith('.xml'))
        .map(f => path.join(carpeta, f))
      return { success: true, rutas: archivos }
    })

    ipcMain.handle('importar-xmls', async (_, rutas: string[]) => {
      const repository = new FacturaRepository(this.db)
      let importadas = 0
      let omitidas = 0
      const errores: { archivo: string; error: string }[] = []

      for (const ruta of rutas) {
        try {
          //const contenido = fs.readFileSync(ruta, 'utf-8')
          const camposXml = this.xmlParser.extraerCampos(ruta)
          const perfil = ProfileManager.getPerfilActivo()
          const rfcActivo = perfil?.rfc

          if (!camposXml.uuid) {
            errores.push({ archivo: path.basename(ruta), error: 'No se encontró UUID en el XML' })
            continue
          }

          // Validar que el XML pertenece al contribuyente activo
          if (camposXml.rfc_emisor !== rfcActivo && camposXml.rfc_receptor !== rfcActivo) {
            errores.push({
              archivo: path.basename(ruta),
              error: `El XML no pertenece al contribuyente activo (${rfcActivo})`
            })
            continue
          }

          const yaExiste = repository.obtenerPorUuid(camposXml.uuid)
          if (yaExiste) {
            omitidas++
            continue
          }

          // Determinar tipo de descarga según RFC activo  
          const tipoDes = camposXml.rfc_receptor === perfil?.rfc ? 'recibida' : 'emitida'

          repository.insertar({
            uuid: camposXml.uuid,
            fecha_emision: camposXml.fecha_emision || '',
            rfc_emisor: camposXml.rfc_emisor || '',
            nombre_emisor: camposXml.nombre_emisor || '',
            rfc_receptor: camposXml.rfc_receptor || '',
            nombre_receptor: camposXml.nombre_receptor || '',
            subtotal: camposXml.subtotal || 0,
            total: camposXml.total || 0,
            tipo_comprobante: camposXml.tipo_comprobante || 'I',
            estado: 'vigente',
            xml: ruta,
            tipo_descarga: tipoDes,
            fecha_descarga: new Date().toISOString(),
            ...camposXml
          })
          importadas++
        } catch (err: any) {
          errores.push({ archivo: path.basename(ruta), error: err.message })
        }
      }

      return { success: true, importadas, omitidas, errores }
    })
  }
}