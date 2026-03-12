import { ipcMain } from 'electron'
import { ConciliacionService, ParametrosConciliacion } from '../services/ConciliacionService'
import { ConfiguracionService } from '../services/ConfiguracionService'

export class ConciliacionHandler {
  constructor(
    private readonly conciliacionService: ConciliacionService,
    private readonly configuracionService: ConfiguracionService
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
      }
    })
  }
}