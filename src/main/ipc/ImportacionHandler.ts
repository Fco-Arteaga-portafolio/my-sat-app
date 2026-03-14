import { ipcMain, dialog } from 'electron'
import { CfdiGuardadoService } from '../services/CfdiGuardadoService'
import * as fs from 'fs'
import * as path from 'path'

export class ImportacionHandler {
  constructor(private readonly guardadoService: CfdiGuardadoService) { }

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
      const rutas = fs.readdirSync(carpeta)
        .filter(f => f.toLowerCase().endsWith('.xml'))
        .map(f => path.join(carpeta, f))
      return { success: true, rutas }
    })

    ipcMain.handle('importar-xmls', async (_, rutas: string[]) => {
      let importadas = 0
      let omitidas = 0
      const errores: { archivo: string; error: string }[] = []

      for (const ruta of rutas) {
        try {
          const resultado = this.guardadoService.importarDesdeRutaLocal(ruta)
          if (resultado === 'importada') importadas++
          else omitidas++
        } catch (err: any) {
          errores.push({ archivo: path.basename(ruta), error: err.message })
        }
      }

      this.guardadoService.sincronizarCatalogos()
      return { success: true, importadas, omitidas, errores }
    })
  }
}