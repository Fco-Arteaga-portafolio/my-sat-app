export function manejarErrorSat(error: unknown): string {
    const mensaje = String(error)

    if (mensaje.includes('SAT_SATURADO')) {
        return 'El SAT se encuentra saturado en este momento. Intenta de nuevo en 20 minutos.'
    }
    if (mensaje.includes('CAPTCHA_INVALIDO')) {
        return 'El captcha es incorrecto. Recarga el captcha e intenta de nuevo.'
    }
    if (mensaje.includes('SAT_TIMEOUT')) {
        return 'El servicio del SAT parece inestable en este momento. Intenta de nuevo en 5 minutos.'
    }

    return mensaje
}