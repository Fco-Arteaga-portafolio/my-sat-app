import { app } from 'electron'
import { BackendService, TicketSoporteRequest } from '../services/BackendService'
import { SesionService } from '../services/SesionService'
import { logger, LogEntry } from '../services/LoggerService'
import { IpcWrapper } from './IpcWrapper'

/** Límites mínimos para no mandarle basura al backend (el backend puede poner los suyos). */
const LIMITES = { asunto: 200, descripcion: 5000, logs: 200_000 }

/**
 * Soporte técnico: envía el reporte + logs al backend de IFRAT (Emite) como un
 * ticket, y permite listar los tickets del usuario para darle seguimiento
 * (estado, si el equipo ya lo vio y si hay respuesta).
 *
 * Contrato implementado en Emite (ver CONTRATO_SOPORTE.md):
 * POST /soporte/tickets · GET /soporte/tickets — ambos autenticados con JWT.
 * El backend exige `macAddress` y `contenidoLog` no vacíos.
 */
export class SoporteHandler {
  constructor(
    private readonly sesionService: SesionService,
    private readonly backendService: BackendService
  ) {}

  registrar(): void {
    IpcWrapper.handle('enviar-ticket-soporte', async (_event, datos) => {
      const payload = this.validarYCompletar(datos)
      const sesion = this.sesionService.obtenerSesion()
      if (!sesion) {
        throw new Error('No hay sesión activa. Vuelve a iniciar sesión en la aplicación.')
      }
      const resultado = await this.backendService.enviarTicketSoporte(sesion.token, payload)
      logger.log('soporte', 'Ticket de soporte enviado al backend', {
        id: resultado.id,
        estado: resultado.estado,
        asunto: payload.asunto
      })
      return {
        id: resultado.id,
        estado: resultado.estado,
        fechaEnvio: resultado.fechaEnvio ?? new Date().toISOString()
      }
    })

    IpcWrapper.handle('obtener-tickets-soporte', async () => {
      const sesion = this.sesionService.obtenerSesion()
      if (!sesion) {
        throw new Error('No hay sesión activa. Vuelve a iniciar sesión en la aplicación.')
      }
      const tickets = await this.backendService.obtenerTicketsSoporte(sesion.token)
      return { tickets }
    })
  }

  private validarYCompletar(datos: {
    asunto?: string
    descripcion?: string
    adjuntarLogs?: boolean
  }): TicketSoporteRequest {
    const asunto = String(datos?.asunto ?? '').trim()
    const descripcion = String(datos?.descripcion ?? '').trim()
    if (!asunto) throw new Error('El asunto es requerido.')
    if (!descripcion) throw new Error('La descripción es requerida.')
    if (asunto.length > LIMITES.asunto) throw new Error('El asunto es demasiado largo.')
    if (descripcion.length > LIMITES.descripcion)
      throw new Error('La descripción es demasiado larga.')

    const adjuntarLogs = datos?.adjuntarLogs !== false
    const contenidoLog = adjuntarLogs
      ? this.formatearLogs()
      : '(El usuario desactivó adjuntar logs en el reporte.)'

    if (!contenidoLog.trim()) {
      throw new Error(
        'No hay logs que enviar todavía. Vuelve a intentarlo tras usar la aplicación.'
      )
    }

    return {
      macAddress: this.sesionService.obtenerHardwareId(),
      versionIfrat: app.getVersion(),
      asunto,
      descripcion,
      contenidoLog
    }
  }

  /** Convierte los logs en memoria a texto plano, recortados a ~200 KB. */
  private formatearLogs(): string {
    const lineas = logger.getLogs().map((log: LogEntry) => {
      const base = `[${log.timestamp}] [${String(log.level).toUpperCase()}] [${log.module}] ${log.message}`
      if (log.data === undefined || log.data === null) return base
      try {
        const detalle = JSON.stringify(log.data)
        return `${base} ${detalle.slice(0, 4000)}`
      } catch {
        return base
      }
    })
    const texto = lineas.join('\n')
    return texto.length > LIMITES.logs ? texto.slice(-LIMITES.logs) : texto
  }
}
