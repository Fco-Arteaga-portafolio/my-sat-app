import { useState } from 'react'

export type TabLicencia = 'comprar' | 'activar'
export type PlanId = 'starter' | 'profesional' | 'despacho'
export type MetodoPago = 'tarjeta' | 'spei' | 'oxxo'

interface Plan {
    id: PlanId
    nombre: string
    precio: number
    rfcs: string
    dispositivos: string
    features: string[]
}

export const PLANES: Plan[] = [
    {
        id: 'starter',
        nombre: 'Starter',
        precio: 1080,
        rfcs: '1 RFC',
        dispositivos: '1 dispositivo',
        features: ['Módulos básicos', 'Soporte estándar']
    },
    {
        id: 'profesional',
        nombre: 'Profesional',
        precio: 2160,
        rfcs: '3 RFC',
        dispositivos: '2 dispositivos',
        features: ['Todos los módulos', 'Soporte estándar']
    },
    {
        id: 'despacho',
        nombre: 'Despacho',
        precio: 4320,
        rfcs: 'RFC ilimitados',
        dispositivos: '5 dispositivos',
        features: ['Todos los módulos', 'Soporte prioritario']
    }
]

interface FormDatos {
    nombre: string
    email: string
    rfc: string
}

interface FormTarjeta {
    numero: string
    vencimiento: string
    cvv: string
    titular: string
}

interface FormActivar {
    licenseKey: string
    rfc: string
}

const formDatosVacio = (): FormDatos => ({ nombre: '', email: '', rfc: '' })
const formTarjetaVacio = (): FormTarjeta => ({ numero: '', vencimiento: '', titular: '', cvv: '' })
const formActivarVacio = (): FormActivar => ({ licenseKey: '', rfc: '' })

export const useModalLicencia = (onClose: () => void) => {
    const [tab, setTab] = useState<TabLicencia>('comprar')

    // Comprar
    const [step, setStep] = useState(1)
    const [planSeleccionado, setPlanSeleccionado] = useState<PlanId>('profesional')
    const [metodoPago, setMetodoPago] = useState<MetodoPago>('tarjeta')
    const [formDatos, setFormDatos] = useState<FormDatos>(formDatosVacio())
    const [formTarjeta, setFormTarjeta] = useState<FormTarjeta>(formTarjetaVacio())
    const [licenseKeyGenerada, setLicenseKeyGenerada] = useState<string | null>(null)

    // Activar
    const [formActivar, setFormActivar] = useState<FormActivar>(formActivarVacio())
    const [activado, setActivado] = useState(false)

    // Compartido
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const cambiarDato = (campo: keyof FormDatos, valor: string) => {
        setFormDatos(prev => ({ ...prev, [campo]: valor }))
    }

    const cambiarTarjeta = (campo: keyof FormTarjeta, valor: string) => {
        setFormTarjeta(prev => ({ ...prev, [campo]: valor }))
    }

    const cambiarActivar = (campo: keyof FormActivar, valor: string) => {
        setFormActivar(prev => ({ ...prev, [campo]: valor }))
    }

    const validarStep = (): string | null => {
        if (step === 2) {
            if (!formDatos.nombre.trim()) return 'El nombre es requerido'
            if (!formDatos.email.trim()) return 'El correo es requerido'
            if (!formDatos.rfc.trim()) return 'El RFC es requerido'
        }
        if (step === 3 && metodoPago === 'tarjeta') {
            if (!formTarjeta.numero.trim()) return 'El número de tarjeta es requerido'
            if (!formTarjeta.vencimiento.trim()) return 'La fecha de vencimiento es requerida'
            if (!formTarjeta.cvv.trim()) return 'El CVV es requerido'
            if (!formTarjeta.titular.trim()) return 'El nombre del titular es requerido'
        }
        return null
    }

    const siguiente = async () => {
        setError(null)
        const err = validarStep()
        if (err) { setError(err); return }

        if (step < 3) {
            setStep(prev => prev + 1)
            return
        }

        // Step 3 → pagar
        setLoading(true)
        const res = await window.api.comprarLicencia({
            plan: planSeleccionado,
            nombre: formDatos.nombre,
            email: formDatos.email,
            rfc: formDatos.rfc,
            metodoPago,
            tarjeta: metodoPago === 'tarjeta' ? {
                numero: formTarjeta.numero,
                vencimiento: formTarjeta.vencimiento,
                cvv: formTarjeta.cvv,
                titular: formTarjeta.titular
            } : undefined
        })

        if (res.success) {
            setLicenseKeyGenerada(res.licenseKey ?? null)
            setStep(4)
        } else {
            setError(res.error || 'Error al procesar el pago')
        }
        setLoading(false)
    }

    const activar = async () => {
        setError(null)
        if (!formActivar.licenseKey.trim()) { setError('La license key es requerida'); return }
        if (!formActivar.rfc.trim()) { setError('El RFC es requerido'); return }

        setLoading(true)
        const res = await window.api.activarLicencia({
            licenseKey: formActivar.licenseKey,
            rfc: formActivar.rfc
        })

        if (res.success) {
            setActivado(true)
        } else {
            setError(res.error || 'No se pudo activar la licencia')
        }
        setLoading(false)
    }

    const cerrar = () => {
        setTab('comprar')
        setStep(1)
        setPlanSeleccionado('profesional')
        setMetodoPago('tarjeta')
        setFormDatos(formDatosVacio())
        setFormTarjeta(formTarjetaVacio())
        setFormActivar(formActivarVacio())
        setLicenseKeyGenerada(null)
        setActivado(false)
        setError(null)
        onClose()
    }

    return {
        tab, setTab,
        step, setStep,
        planSeleccionado, setPlanSeleccionado,
        metodoPago, setMetodoPago,
        formDatos, cambiarDato,
        formTarjeta, cambiarTarjeta,
        formActivar, cambiarActivar,
        licenseKeyGenerada,
        activado,
        loading, error,
        siguiente, activar, cerrar
    }
}