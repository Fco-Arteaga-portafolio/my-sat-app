import { useState, useCallback } from 'react'

interface FormSoporte {
  asunto: string
  descripcion: string
  adjuntarLogs: boolean
}

const formVacio = (): FormSoporte => ({
  asunto: '',
  descripcion: '',
  adjuntarLogs: true
})

type Pestana = 'nuevo' | 'tickets'

interface RegistroLogUi {
  timestamp?: string
  level?: string
  module?: string
  message?: string
}

interface ResultadoHookSoporte {
  form: FormSoporte
  pestana: Pestana
  cambiarPestana: (p: Pestana) => void
  loading: boolean
  enviado: boolean
  error: string | null
  idTicket: string | null
  estadoTicket: string | null
  rutaGuardada: string | null
  tickets: TicketSoporteUi[]
  ticketsLoading: boolean
  ticketsError: string | null
  cambiarCampo: (campo: keyof FormSoporte, valor: string | boolean) => void
  enviar: () => Promise<void>
  guardarEnArchivo: () => Promise<void>
  guardarSoloLogs: () => Promise<void>
  cargarTickets: () => Promise<void>
  cerrar: () => void
}

export const useModalSoporte = (onClose: () => void): ResultadoHookSoporte => {
  const [form, setForm] = useState<FormSoporte>(formVacio())
  const [pestana, setPestana] = useState<Pestana>('nuevo')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [idTicket, setIdTicket] = useState<string | null>(null)
  const [estadoTicket, setEstadoTicket] = useState<string | null>(null)
  const [rutaGuardada, setRutaGuardada] = useState<string | null>(null)

  const [tickets, setTickets] = useState<TicketSoporteUi[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [ticketsError, setTicketsError] = useState<string | null>(null)

  const cambiarCampo = (campo: keyof FormSoporte, valor: string | boolean): void => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  /** Carga los tickets del usuario (seguimiento: estado, visto, respuesta). */
  const cargarTickets = useCallback(async () => {
    setTicketsLoading(true)
    setTicketsError(null)
    try {
      const res = await window.api.obtenerTicketsSoporte()
      if (res.success && res.tickets) {
        setTickets(res.tickets)
      } else {
        setTicketsError(res.error || 'No se pudieron cargar los tickets')
      }
    } catch (err) {
      setTicketsError('Error de conexión al cargar los tickets: ' + String(err))
    }
    setTicketsLoading(false)
  }, [])

  /** Envía el reporte + logs al backend como ticket de soporte. */
  const enviar = async (): Promise<void> => {
    if (!form.asunto.trim()) {
      setError('El asunto es requerido')
      return
    }
    if (!form.descripcion.trim()) {
      setError('La descripción es requerida')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await window.api.enviarTicketSoporte({
        asunto: form.asunto,
        descripcion: form.descripcion,
        adjuntarLogs: form.adjuntarLogs
      })

      if (res.success && res.id) {
        setIdTicket(res.id)
        setEstadoTicket(res.estado ?? 'Enviado')
        setEnviado(true)
        // Refrescar el listado para que el ticket nuevo aparezca en "Mis tickets".
        cargarTickets()
      } else {
        setError(res.error || 'No se pudo enviar el ticket')
      }
    } catch (err) {
      setError('Error de conexión al enviar el ticket: ' + String(err))
    }

    setLoading(false)
  }

  /** Alternativa cuando el backend no responde: guardar reporte + logs en un .txt. */
  const guardarEnArchivo = async (): Promise<void> => {
    if (!form.asunto.trim()) {
      setError('El asunto es requerido')
      return
    }
    if (!form.descripcion.trim()) {
      setError('La descripción es requerida')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const encabezado = [
        '===== REPORTE DE SOPORTE IFRAT =====',
        `Fecha: ${new Date().toLocaleString('es-MX')}`,
        `Asunto: ${form.asunto}`,
        '',
        'Descripción:',
        form.descripcion
      ].join('\n')

      let contenido = encabezado
      if (form.adjuntarLogs) {
        const logsRes = await window.api.obtenerLogs()
        const registros = logsRes.success && logsRes.logs ? logsRes.logs : []
        const logsTexto = registros
          .map(
            (log: RegistroLogUi) =>
              `[${log.timestamp}] [${String(log.level).toUpperCase()}] [${log.module}] ${log.message}`
          )
          .join('\n')
        contenido += `\n\n===== LOGS ADJUNTOS =====\n${logsTexto || '(sin registros)'}`
      }

      const res = await window.api.exportarLogs({ contenido })
      if (res.success && res.ruta) {
        setRutaGuardada(res.ruta)
        setEnviado(true)
      } else if (res.success && res.cancelado) {
        // El usuario canceló el diálogo.
      } else {
        setError(res.error || 'No se pudo guardar el archivo de reporte')
      }
    } catch (err) {
      setError('Error al generar el archivo de reporte: ' + String(err))
    }

    setLoading(false)
  }

  /** Solo los logs, sin reporte (respaldo/evidencia para cualquier medio). */
  const guardarSoloLogs = async (): Promise<void> => {
    setError(null)
    setLoading(true)
    try {
      const res = await window.api.exportarLogs()
      if (res.success && res.ruta) {
        setRutaGuardada(res.ruta)
        setEnviado(true)
      } else if (!res.success && res.error) {
        setError(res.error)
      }
    } catch (err) {
      setError('Error al exportar los logs: ' + String(err))
    }
    setLoading(false)
  }

  const cambiarPestana = (p: Pestana): void => {
    setPestana(p)
    if (p === 'tickets') cargarTickets()
  }

  const cerrar = (): void => {
    setForm(formVacio())
    setPestana('nuevo')
    setEnviado(false)
    setError(null)
    setIdTicket(null)
    setEstadoTicket(null)
    setRutaGuardada(null)
    onClose()
  }

  return {
    form,
    pestana,
    cambiarPestana,
    loading,
    enviado,
    error,
    idTicket,
    estadoTicket,
    rutaGuardada,
    tickets,
    ticketsLoading,
    ticketsError,
    cambiarCampo,
    enviar,
    guardarEnArchivo,
    guardarSoloLogs,
    cargarTickets,
    cerrar
  }
}
