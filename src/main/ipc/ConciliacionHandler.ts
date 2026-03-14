import { ipcMain } from 'electron'
import { ConciliacionService, ParametrosConciliacion } from '../services/ConciliacionService'
import { ConfiguracionService } from '../services/ConfiguracionService'
import { SatAuthService } from '../scraper/SatAuthService'
import { manejarErrorSat } from './satErrores'

export class ConciliacionHandler {
  constructor(
    private readonly conciliacionService: ConciliacionService,
    private readonly configuracionService: ConfiguracionService,
    private readonly authService: SatAuthService
  ) { }

  registrar(): void {
    ipcMain.handle('iniciar-conciliacion', async (event, params: ParametrosConciliacion) => {
      try {
        const config = this.configuracionService.obtener()
        if (!config) return { success: false, error: 'No hay configuración guardada' }

        const resumen = await this.conciliacionService.conciliar(
          config,
          params,
          (progreso) => event.sender.send('progreso-conciliacion', progreso)
        )
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