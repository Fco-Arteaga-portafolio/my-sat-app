import { useState } from 'react'

export type TipoTicket = 'bug' | 'duda' | 'licencia' | 'sugerencia'

interface FormSoporte {
    tipo: TipoTicket
    asunto: string
    descripcion: string
    email: string
    adjuntarLogs: boolean
}

const formVacio = (): FormSoporte => ({
    tipo: 'bug',
    asunto: '',
    descripcion: '',
    email: '',
    adjuntarLogs: true
})

export const useModalSoporte = (onClose: () => void) => {
    const [form, setForm] = useState<FormSoporte>(formVacio())
    const [loading, setLoading] = useState(false)
    const [enviado, setEnviado] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [folioGenerado, setFolioGenerado] = useState<string | null>(null)

    const cambiarCampo = (campo: keyof FormSoporte, valor: any) => {
        setForm(prev => ({ ...prev, [campo]: valor }))
    }

    const enviar = async () => {
        if (!form.asunto.trim()) { setError('El asunto es requerido'); return }
        if (!form.descripcion.trim()) { setError('La descripción es requerida'); return }
        if (!form.email.trim()) { setError('El correo es requerido'); return }

        setError(null)
        setLoading(true)

        try {
            let logsAdjuntos = ''
            if (form.adjuntarLogs) {
                const logsRes = await window.api.obtenerLogs()
                if (logsRes.success && logsRes.logs) {
                    logsAdjuntos = logsRes.logs.map((log: any) =>
                        `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.module}] ${log.message}`
                    ).join('\n')
                }
            }

            const res = await window.api.enviarTicketSoporte({
                tipo: form.tipo,
                asunto: form.asunto,
                descripcion: form.descripcion,
                email: form.email,
                logs: logsAdjuntos
            } as any)

            if (res.success) {
                setFolioGenerado(res.folio ?? null)
                setEnviado(true)
            } else {
                setError(res.error || 'No se pudo enviar el ticket')
            }
        } catch (err) {
            setError('Error al procesar los logs')
        }

        setLoading(false)
    }

    const cerrar = () => {
        setForm(formVacio())
        setEnviado(false)
        setError(null)
        setFolioGenerado(null)
        onClose()
    }

    return {
        form, loading, enviado, error, folioGenerado,
        cambiarCampo, enviar, cerrar
    }
}