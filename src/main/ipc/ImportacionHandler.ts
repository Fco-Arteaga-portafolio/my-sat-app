import { ipcMain, dialog } from 'electron'
import { CfdiGuardadoService } from '../services/CfdiGuardadoService'
import * as fs from 'fs'
import * as path from 'path'
import BetterSqlite3 from 'better-sqlite3'
import { LicenseService } from '../services/LicenseService'
import { LicenseRepository } from '../database/repositories/LicenseRepository'

export class ImportacionHandler {
  private licenseService: LicenseService

  constructor(private readonly guardadoService: CfdiGuardadoService, db?: BetterSqlite3.Database) {
    if (db) {
      const licenseRepository = new LicenseRepository(db)
      this.licenseService = new LicenseService(licenseRepository)
    } else {
      this.licenseService = null as any
    }
  }

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
      // Validar acceso a importaciones según licencia
      if (this.licenseService) {
        const validacion = this.licenseService.validarImportacionCfdi()
        if (!validacion.valido) {
          return { success: false, error: validacion.motivo }
        }
      }

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

      // Incrementar contador solo si fue 100% exitoso (sin errores)
      if (importadas > 0 && errores.length === 0) {
        const licenseRepo = new LicenseRepository((this.licenseService as any).repository.db)
        licenseRepo.incrementarImportacionesCfdi()
      }

      this.guardadoService.sincronizarCatalogos()
      return { success: true, importadas, omitidas, errores }
    })
  }
}