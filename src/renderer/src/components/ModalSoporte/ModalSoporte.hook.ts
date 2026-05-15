import { useState } from 'react'

export type TipoTicket = 'bug' | 'duda' | 'licencia' | 'sugerencia'

interface FormSoporte {
    tipo: TipoTicket
    asunto: string
    descripcion: string
    email: string
}

const formVacio = (): FormSoporte => ({
    tipo: 'bug',
    asunto: '',
    descripcion: '',
    email: ''
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

        const res = await window.api.enviarTicketSoporte({
            tipo: form.tipo,
            asunto: form.asunto,
            descripcion: form.descripcion,
            email: form.email
        })

        if (res.success) {
            setFolioGenerado(res.folio ?? null)
            setEnviado(true)
        } else {
            setError(res.error || 'No se pudo enviar el ticket')
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