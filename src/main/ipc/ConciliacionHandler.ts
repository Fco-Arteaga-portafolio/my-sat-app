import { ipcMain } from 'electron'
import { ConciliacionService, ParametrosConciliacion } from '../services/ConciliacionService'
import { ConfiguracionService } from '../services/ConfiguracionService'
import { SatAuthService } from '../scraper/SatAuthService'
import { manejarErrorSat } from './satErrores'
import BetterSqlite3 from 'better-sqlite3'
import { LicenseService } from '../services/LicenseService'
import { LicenseRepository } from '../database/repositories/LicenseRepository'

export class ConciliacionHandler {
  private licenseService: LicenseService

  constructor(
    private readonly conciliacionService: ConciliacionService,
    private readonly configuracionService: ConfiguracionService,
    private readonly authService: SatAuthService,
    db?: BetterSqlite3.Database
  ) {
    if (db) {
      const licenseRepository = new LicenseRepository(db)
      this.licenseService = new LicenseService(licenseRepository)
    } else {
      this.licenseService = null as any
    }
  }

  registrar(): void {
    ipcMain.handle('iniciar-conciliacion', async (event, params: ParametrosConciliacion) => {
      try {
        // Validar acceso a consolidaciones según licencia
        if (this.licenseService) {
          const validacion = this.licenseService.validarConsolidacion()
          if (!validacion.valido) {
            return { success: false, error: validacion.motivo }
          }
        }

        const config = this.configuracionService.obtener()
        if (!config) return { success: false, error: 'No hay configuración guardada' }

        const resumen = await this.conciliacionService.conciliar(
          config,
          params,
          (progreso) => event.sender.send('progreso-conciliacion', progreso)
        )

        // Incrementar contador solo si fue 100% exitoso (sin errores en el resumen)
        if (this.licenseService && resumen && resumen.errores === 0) {
          const licenseRepo = new LicenseRepository((this.licenseService as any).repository.db)
          licenseRepo.incrementarConsolidaciones()
        }

        return { success: true, resumen }
      } catch (error) {
        return { success: false, error: manejarErrorSat(error) }
      } finally {
        await this.authService.cerrarSesion()
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