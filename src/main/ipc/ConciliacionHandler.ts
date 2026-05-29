import { ipcMain } from 'electron'
import { CfdiService, ParametrosConciliacion } from '../services/CfdiService'
import { ConfiguracionService } from '../services/ConfiguracionService'
import { manejarErrorSat } from './satErrores'
import BetterSqlite3 from 'better-sqlite3'
import { LicenseService } from '../services/LicenseService'
import { LicenseRepository } from '../database/repositories/LicenseRepository'
import { LicenseHelper } from '../services/LicenseHelper'

export class ConciliacionHandler {
  private licenseHelper?: LicenseHelper

  constructor(
    private readonly cfdiService: CfdiService,
    private readonly configuracionService: ConfiguracionService,
    db?: BetterSqlite3.Database
  ) {
    if (db) {
      const licenseRepository = new LicenseRepository(db)
      const licenseService = new LicenseService(licenseRepository)
      this.licenseHelper = new LicenseHelper(licenseService, db)
    }
  }

  registrar(): void {
    ipcMain.handle('iniciar-conciliacion', async (event, params: ParametrosConciliacion) => {
      try {
        if (this.licenseHelper) {
          const validacion = this.licenseHelper.validateFeature('consolidacion')
          if (!validacion.valido) throw new Error(validacion.motivo)
        }

        const config = this.configuracionService.obtener()
        if (!config) throw new Error('No hay configuración guardada')

        const resumen = await this.cfdiService.conciliar(
          config, params,
          (progreso) => event.sender.send('progreso-conciliacion', progreso)
        )

        if (this.licenseHelper && resumen.errores.length === 0) {
          this.licenseHelper.incrementCounter('consolidaciones')
        }

        return { success: true, resumen }
      } catch (error) {
        return { success: false, error: manejarErrorSat(error) }
      }
    })

    ipcMain.handle('obtener-ultima-conciliacion', (_, params: { tipo: string; ejercicio: string; periodo: string }) => {
      try {
        return { success: true, ultima: this.cfdiService.obtenerUltimaConciliacion(params.tipo, params.ejercicio, params.periodo) }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('obtener-historial-conciliaciones', () => {
      try {
        return { success: true, historial: this.cfdiService.obtenerHistorialConciliaciones() }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }
}