import { ipcMain } from 'electron'
import { CfdiService, ParametrosConciliacion } from '../services/CfdiService'
import { ConfiguracionService } from '../services/ConfiguracionService'
import { manejarErrorSat } from './satErrores'
import { LimiteUsoService } from '../services/LimiteUsoService'

export class ConciliacionHandler {
  constructor(
    private readonly cfdiService: CfdiService,
    private readonly configuracionService: ConfiguracionService,
    private readonly limiteUsoService: LimiteUsoService
  ) {}

  registrar(): void {
    ipcMain.handle('iniciar-conciliacion', async (event, params: ParametrosConciliacion) => {
      try {
        const config = this.configuracionService.obtener()
        if (!config) throw new Error('No hay configuración guardada')

        const validacion = await this.limiteUsoService.validar('consolidacion', config.rfc)
        if (!validacion.valido) throw new Error(validacion.motivo)

        const resumen = await this.cfdiService.conciliar(config, params, (progreso) =>
          event.sender.send('progreso-conciliacion', progreso)
        )

        if (resumen.errores.length === 0) {
          await this.limiteUsoService.consumir('consolidacion', config.rfc)
        }

        return { success: true, resumen }
      } catch (error) {
        return { success: false, error: manejarErrorSat(error) }
      }
    })

    ipcMain.handle(
      'obtener-ultima-conciliacion',
      (_, params: { tipo: string; ejercicio: string; periodo: string }) => {
        try {
          return {
            success: true,
            ultima: this.cfdiService.obtenerUltimaConciliacion(
              params.tipo,
              params.ejercicio,
              params.periodo
            )
          }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      }
    )

    ipcMain.handle('obtener-historial-conciliaciones', () => {
      try {
        return { success: true, historial: this.cfdiService.obtenerHistorialConciliaciones() }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }
}
