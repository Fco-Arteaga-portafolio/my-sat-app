import { ipcRenderer } from 'electron'

/**
 * API de Soporte Técnico: envía reporte + logs al backend como ticket y lista
 * los tickets del usuario para dar seguimiento.
 */
export interface TicketSoporteUi {
  id: string
  asunto: string
  descripcion: string
  estado: string
  fechaEnvio: string
  fechaVistoPorSoporte?: string | null
  respuestaSoporte?: string | null
  fechaRespuesta?: string | null
  versionIfrat?: string
  macAddress?: string
}

export interface EnviarTicketResultado {
  success: boolean
  id?: string
  estado?: string
  fechaEnvio?: string
  error?: string
}

export interface ObtenerTicketsResultado {
  success: boolean
  tickets?: TicketSoporteUi[]
  error?: string
}

export function createSoporteApi(): {
  enviarTicketSoporte: (datos: {
    asunto: string
    descripcion: string
    adjuntarLogs: boolean
  }) => Promise<EnviarTicketResultado>
  obtenerTicketsSoporte: () => Promise<ObtenerTicketsResultado>
} {
  return {
    enviarTicketSoporte: (datos: {
      asunto: string
      descripcion: string
      adjuntarLogs: boolean
    }): Promise<EnviarTicketResultado> => ipcRenderer.invoke('enviar-ticket-soporte', datos),

    obtenerTicketsSoporte: (): Promise<ObtenerTicketsResultado> =>
      ipcRenderer.invoke('obtener-tickets-soporte')
  }
}
