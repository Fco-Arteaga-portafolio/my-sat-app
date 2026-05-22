import { logger } from '../services/LoggerService'
import { IpcWrapper } from './IpcWrapper'

export class LoggerHandler {
  registrar(): void {
    IpcWrapper.handle('obtener-logs', () => {
      return { logs: logger.getLogs() }
    })

    IpcWrapper.handle('obtener-ruta-logs', () => {
      return { ruta: logger.getLogFile() }
    })

    IpcWrapper.handle('limpiar-logs', () => {
      logger.clearLogs()
      return {}
    })
  }
}
