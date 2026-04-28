import { LicenseRepository } from '../database/repositories/LicenseRepository'

export class LicenseService {
    private repository: LicenseRepository

    constructor(repository: LicenseRepository) {
        this.repository = repository
    }

    /**
     * Obtiene información completa de la licencia
     */
    obtenerLicencia() {
        const licencia = this.repository.obtenerLicencia()
        if (!licencia) {
            return {
                estado: 'Demo',
                dias_restantes: null,
                rfc_disponible: true,
                maquina_disponible: true,
                vigente: true
            }
        }

        const diasRestantes = this.calcularDiasRestantes(licencia.fecha_vencimiento)

        return {
            estado: licencia.estado,
            fecha_inicio: licencia.fecha_inicio,
            fecha_vencimiento: licencia.fecha_vencimiento,
            dias_restantes: diasRestantes,
            rfc_maximo: licencia.rfc_maximo,
            rfc_usado: licencia.rfc_usado,
            maquinas_maximo: licencia.maquinas_maximo,
            maquinas_usado: licencia.maquinas_usado,
            rfc_disponible: this.repository.validarRfcDisponible(),
            maquina_disponible: this.repository.validarMaquinaDisponible(),
            vigente: this.repository.validarVigencia()
        }
    }

    /**
     * Obtiene solo el estado actual
     */
    obtenerEstado() {
        const licencia = this.repository.obtenerLicencia()
        if (!licencia) return 'Demo'
        return licencia.estado
    }

    /**
     * Calcula días restantes
     */
    private calcularDiasRestantes(fechaVencimiento: string | null): number | null {
        if (!fechaVencimiento) return null

        const hoy = new Date()
        const vencimiento = new Date(fechaVencimiento)
        const diferencia = vencimiento.getTime() - hoy.getTime()
        const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24))

        return dias > 0 ? dias : 0
    }

    /**
     * Valida si puede agregar un nuevo RFC
     */
    validarAgregarRfc(): { valido: boolean; motivo?: string } {
        if (!this.repository.validarVigencia()) {
            return { valido: false, motivo: 'Licencia vencida' }
        }

        if (!this.repository.validarRfcDisponible()) {
            return { valido: false, motivo: 'Límite de RFCs alcanzado' }
        }

        return { valido: true }
    }

    /**
     * Valida si puede registrar una nueva máquina
     */
    validarRegistrarMaquina(): { valido: boolean; motivo?: string } {
        if (!this.repository.validarVigencia()) {
            return { valido: false, motivo: 'Licencia vencida' }
        }

        if (!this.repository.validarMaquinaDisponible()) {
            return { valido: false, motivo: 'Límite de máquinas alcanzado' }
        }

        return { valido: true }
    }

    /**
     * Valida si puede descargar CFDIs
     */
    validarDescargaCfdi(): { valido: boolean; motivo?: string; usos_restantes?: number } {
        const licencia = this.repository.obtenerLicencia()
        if (!licencia) {
            return { valido: false, motivo: 'No hay licencia' }
        }

        if (licencia.estado === 'Vencido') {
            return { valido: false, motivo: 'Licencia vencida - Debe renovar' }
        }

        if (licencia.estado === 'Demo') {
            if (!this.repository.validarDescargasCfdiDisponibles()) {
                return {
                    valido: false,
                    motivo: 'Ha alcanzado el límite de 3 descargas en la versión Demo',
                    usos_restantes: 0
                }
            }
            const restantes = licencia.descargas_cfdi_maximo - licencia.descargas_cfdi_usado
            return { valido: true, usos_restantes: restantes - 1 }
        }

        return { valido: true }
    }

    /**
     * Valida si puede importar CFDIs
     */
    validarImportacionCfdi(): { valido: boolean; motivo?: string; usos_restantes?: number } {
        const licencia = this.repository.obtenerLicencia()
        if (!licencia) {
            return { valido: false, motivo: 'No hay licencia' }
        }

        if (licencia.estado === 'Vencido') {
            return { valido: false, motivo: 'Licencia vencida - Debe renovar' }
        }

        if (licencia.estado === 'Demo') {
            if (!this.repository.validarImportacionesCfdiDisponibles()) {
                return {
                    valido: false,
                    motivo: 'Ha alcanzado el límite de 3 importaciones en la versión Demo',
                    usos_restantes: 0
                }
            }
            const restantes = licencia.importaciones_cfdi_maximo - licencia.importaciones_cfdi_usado
            return { valido: true, usos_restantes: restantes - 1 }
        }

        return { valido: true }
    }

    /**
     * Valida si puede hacer consolidaciones (conciliaciones)
     */
    validarConsolidacion(): { valido: boolean; motivo?: string; usos_restantes?: number } {
        const licencia = this.repository.obtenerLicencia()
        if (!licencia) {
            return { valido: false, motivo: 'No hay licencia' }
        }

        if (licencia.estado === 'Vencido') {
            return { valido: false, motivo: 'Licencia vencida - Debe renovar' }
        }

        if (licencia.estado === 'Demo') {
            if (!this.repository.validarConsolidacionesDisponibles()) {
                return {
                    valido: false,
                    motivo: 'Ha alcanzado el límite de 1 consolidación en la versión Demo',
                    usos_restantes: 0
                }
            }
            const restantes = licencia.consolidaciones_maximo - licencia.consolidaciones_usado
            return { valido: true, usos_restantes: restantes - 1 }
        }

        return { valido: true }
    }
}
