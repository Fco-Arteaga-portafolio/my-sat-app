import { ipcMain } from 'electron'
import { ConciliacionService, ParametrosConciliacion } from '../services/ConciliacionService'
import { ConfiguracionService } from '../services/ConfiguracionService'
import { SatAuthService } from '../scraper/SatAuthService'
import { manejarErrorSat } from './satErrores'
import BetterSqlite3 from 'better-sqlite3'
import { LicenseService } from '../services/LicenseService'
import { LicenseRepository } from '../database/repositories/LicenseRepository'
import { LicenseHelper } from '../services/LicenseHelper'
import { AuthHelper } from '../services/AuthHelper'

export class ConciliacionHandler {
  private licenseHelper?: LicenseHelper
  private authHelper: AuthHelper

  constructor(
    private readonly conciliacionService: ConciliacionService,
    private readonly configuracionService: ConfiguracionService,
    authService: SatAuthService,
    db?: BetterSqlite3.Database
  ) {
    if (db) {
      const licenseRepository = new LicenseRepository(db)
      const licenseService = new LicenseService(licenseRepository)
      this.licenseHelper = new LicenseHelper(licenseService, db)
    }
    this.authHelper = new AuthHelper(authService)
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

        const resumen = await this.conciliacionService.conciliar(
          config, params,
          (progreso) => event.sender.send('progreso-conciliacion', progreso)
        )

        if (this.licenseHelper && resumen && resumen.errores.length === 0) {
          this.licenseHelper.incrementCounter('consolidaciones')
        }

        return { success: true, resumen }
      } catch (error) {
        return { success: false, error: manejarErrorSat(error) }
      } finally {
        await this.authHelper.logout()
      }
    })

    ipcMain.handle('obtener-ultima-conciliacion', (_, params: { tipo: string; ejercicio: string; periodo: string }) => {
      try {
        return { success: true, ultima: this.conciliacionService.obtenerUltima(params.tipo, params.ejercicio, params.periodo) }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('obtener-historial-conciliaciones', () => {
      try {
        return { success: true, historial: this.conciliacionService.obtenerHistorial() }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }
}