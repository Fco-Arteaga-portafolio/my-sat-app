import { ipcMain } from 'electron'
import { ConciliacionService, ParametrosConciliacion } from '../services/ConciliacionService'
import { ConfiguracionService } from '../services/ConfiguracionService'
import { SatScraper } from '../scraper/SatScraper'

export class ConciliacionHandler {
  constructor(
    private readonly conciliacionService: ConciliacionService,
    private readonly configuracionService: ConfiguracionService,
    private readonly scraper: SatScraper
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

    ipcMain.handle('obtener-ultima-conciliacion', (_event, params: { tipo: string; ejercicio: string; periodo: string }) => {
      try {
        const ultima = this.conciliacionService.obtenerUltima(params.tipo, params.ejercicio, params.periodo)
        return { success: true, ultima }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('obtener-historial-conciliaciones', () => {
      try {
        const historial = this.conciliacionService.obtenerHistorial()
        return { success: true, historial }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }
}