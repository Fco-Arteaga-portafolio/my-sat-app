import { logger } from '../services/LoggerService'

export function logHandler(handler: string, entrada: any) {
  logger.log('IpcHandler', `→ ${handler}`, entrada)
}

export function logSuccess(handler: string, resultado: any) {
  logger.log('IpcHandler', `✓ ${handler} completado`, resultado)
}

export function logError(handler: string, error: any) {
  logger.error('IpcHandler', `✗ ${handler} falló`, error)
}

export function logOperation(modulo: string, operacion: string, datos?: any) {
  logger.log(modulo, operacion, datos)
}
