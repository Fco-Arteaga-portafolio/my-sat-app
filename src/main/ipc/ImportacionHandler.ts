import { dialog } from 'electron'
import { CfdiGuardadoService } from '../services/CfdiGuardadoService'
import * as fs from 'fs'
import * as path from 'path'
import BetterSqlite3 from 'better-sqlite3'
import { LicenseService } from '../services/LicenseService'
import { LicenseRepository } from '../database/repositories/LicenseRepository'
import { IpcWrapper } from './IpcWrapper'
import { LicenseHelper } from '../services/LicenseHelper'

export class ImportacionHandler {
  private licenseHelper?: LicenseHelper

  constructor(private readonly guardadoService: CfdiGuardadoService, db?: BetterSqlite3.Database) {
    if (db) {
      const licenseRepository = new LicenseRepository(db)
      const licenseService = new LicenseService(licenseRepository)
      this.licenseHelper = new LicenseHelper(licenseService, db)
    }
  }

  registrar(): void {
    IpcWrapper.handle('seleccionar-xmls', async () => {
      const result = await dialog.showOpenDialog({
        title: 'Seleccionar archivos XML',
        filters: [{ name: 'XML', extensions: ['xml'] }],
        properties: ['openFile', 'multiSelections']
      })
      return { rutas: result.canceled ? [] : result.filePaths }
    })

    IpcWrapper.handle('seleccionar-carpeta-xml', async () => {
      const result = await dialog.showOpenDialog({
        title: 'Seleccionar carpeta con XMLs',
        properties: ['openDirectory']
      })
      if (result.canceled) return { rutas: [] }

      const carpeta = result.filePaths[0]
      const rutas = fs.readdirSync(carpeta)
        .filter(f => f.toLowerCase().endsWith('.xml'))
        .map(f => path.join(carpeta, f))
      return { rutas }
    })

    IpcWrapper.handle('importar-xmls', async (_event, rutas: string[]) => {
      if (this.licenseHelper) {
        const validacion = this.licenseHelper.validateFeature('importacion')
        if (!validacion.valido) throw new Error(validacion.motivo)
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

      if (importadas > 0 && !errores.length && this.licenseHelper) {
        this.licenseHelper.incrementCounter('importaciones')
      }

      this.guardadoService.sincronizarCatalogos()
      return { importadas, omitidas, errores }
    })
  }
}