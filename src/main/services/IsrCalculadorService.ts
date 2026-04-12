import BetterSqlite3 from 'better-sqlite3'

export type RegimenIsr =
    | 'actividad_empresarial'
    | 'honorarios'
    | 'arrendamiento'
    | 'pm_general'
    | 'resico_pf'
    | 'resico_pm'

export interface ResultadoIsrMes {
    mes: number
    ingresos: number
    gastos: number
    base_gravable: number
    isr_causado: number
    isr_retenido: number
    isr_a_pagar: number
}

export interface ResultadoIsrAnual {
    año: number
    regimen: RegimenIsr
    meses: ResultadoIsrMes[]
    totales: {
        ingresos: number
        gastos: number
        base_gravable: number
        isr_causado: number
        isr_retenido: number
        isr_a_pagar: number
    }
}

interface TramoTarifa {
    limite_inferior: number
    limite_superior: number | null
    cuota_fija: number
    tasa_excedente: number
}

interface TasaFija {
    tasa: number
}

export class IsrCalculadorService {
    constructor(private readonly db: BetterSqlite3.Database) { }

    calcularAnual(
        tabla: string,
        año: number,
        regimen: RegimenIsr,
        rfcActivo: string
    ): ResultadoIsrAnual {
        const meses: ResultadoIsrMes[] = []

        // Acumulados para pagos provisionales (se calculan sobre base acumulada)
        let ingresosAcum = 0
        let gastosAcum = 0
        let isrPagadoAcum = 0

        for (let mes = 1; mes <= 12; mes++) {
            const mesStr = String(mes).padStart(2, '0')

            const ingresosMes = this.obtenerIngresos(tabla, año, mesStr, rfcActivo)
            const gastosMes = this.obtenerGastos(tabla, año, mesStr)
            const isrRetenidoMes = this.obtenerIsrRetenido(tabla, año, mesStr, rfcActivo)

            ingresosAcum += ingresosMes
            gastosAcum += gastosMes

            const baseAcum = this.calcularBase(regimen, ingresosAcum, gastosAcum)
            const isrAcum = this.aplicarTarifa(regimen, año, mes, baseAcum)

            // Pago provisional del mes = ISR acumulado - ISR ya pagado meses anteriores
            const isrCausadoMes = Math.max(0, isrAcum - isrPagadoAcum)
            const isrAPagar = Math.max(0, isrCausadoMes - isrRetenidoMes)

            isrPagadoAcum += isrCausadoMes

            meses.push({
                mes,
                ingresos: ingresosMes,
                gastos: gastosMes,
                base_gravable: Math.max(0, ingresosMes - gastosMes),
                isr_causado: isrCausadoMes,
                isr_retenido: isrRetenidoMes,
                isr_a_pagar: isrAPagar
            })
        }

        const totales = meses.reduce(
            (acc, m) => ({
                ingresos: acc.ingresos + m.ingresos,
                gastos: acc.gastos + m.gastos,
                base_gravable: acc.base_gravable + m.base_gravable,
                isr_causado: acc.isr_causado + m.isr_causado,
                isr_retenido: acc.isr_retenido + m.isr_retenido,
                isr_a_pagar: acc.isr_a_pagar + m.isr_a_pagar
            }),
            { ingresos: 0, gastos: 0, base_gravable: 0, isr_causado: 0, isr_retenido: 0, isr_a_pagar: 0 }
        )

        return { año, regimen, meses, totales }
    }

    private obtenerIngresos(tabla: string, año: number, mes: string, rfcActivo: string): number {
        // CFDI de ingreso emitidos vigentes + nómina recibida vigente
        const result = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE
          WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente'
          THEN subtotal ELSE 0
        END), 0) +
        COALESCE(SUM(CASE
          WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'N' AND estado = 'vigente'
            AND rfc_receptor = '${rfcActivo}'
          THEN subtotal ELSE 0
        END), 0) as total
      FROM ${tabla}
      WHERE strftime('%Y', fecha_emision) = '${año}'
        AND strftime('%m', fecha_emision) = '${mes}'
    `).get() as { total: number }
        return result?.total ?? 0
    }

    private obtenerGastos(tabla: string, año: number, mes: string): number {
        // CFDI de ingreso y egreso recibidos vigentes (todos, el usuario excluye manualmente)
        const result = this.db.prepare(`
      SELECT COALESCE(SUM(subtotal), 0) as total
      FROM ${tabla}
      WHERE tipo_descarga = 'recibida'
        AND tipo_comprobante IN ('I', 'E')
        AND estado = 'vigente'
        AND strftime('%Y', fecha_emision) = '${año}'
        AND strftime('%m', fecha_emision) = '${mes}'
    `).get() as { total: number }
        return result?.total ?? 0
    }

    private obtenerIsrRetenido(tabla: string, año: number, mes: string, rfcActivo: string): number {
        // ISR retenido en CFDIs emitidos (clientes que retienen al contribuyente)
        const result = this.db.prepare(`
      SELECT COALESCE(SUM(total_impuestos_retenidos), 0) as total
      FROM ${tabla}
      WHERE tipo_descarga = 'emitida'
        AND tipo_comprobante = 'I'
        AND estado = 'vigente'
        AND rfc_emisor = '${rfcActivo}'
        AND strftime('%Y', fecha_emision) = '${año}'
        AND strftime('%m', fecha_emision) = '${mes}'
    `).get() as { total: number }
        return result?.total ?? 0
    }

    private calcularBase(regimen: RegimenIsr, ingresos: number, gastos: number): number {
        switch (regimen) {
            case 'resico_pf':
            case 'resico_pm':
                return ingresos // base = ingresos brutos, sin deducir gastos
            case 'pm_general':
                return Math.max(0, ingresos - gastos) // utilidad fiscal
            default:
                return Math.max(0, ingresos - gastos) // actividad empresarial, honorarios, arrendamiento
        }
    }

    private aplicarTarifa(regimen: RegimenIsr, año: number, mes: number, base: number): number {
        if (base <= 0) return 0

        // RESICO y PM general usan tasa fija
        if (['resico_pf', 'resico_pm', 'pm_general'].includes(regimen)) {
            return this.aplicarTasaFija(regimen, año, base)
        }

        // Personas físicas: actividad empresarial, honorarios, arrendamiento → tabla acumulada
        return this.aplicarTablaAcumulada(año, mes, base)
    }

    private aplicarTasaFija(regimen: RegimenIsr, año: number, base: number): number {
        const row = this.db.prepare(`
      SELECT tasa FROM isr_tasas_fijas
      WHERE año = ? AND regimen = ?
    `).get(año, regimen) as TasaFija | undefined

        if (!row) return 0
        return base * row.tasa
    }

    private aplicarTablaAcumulada(año: number, mes: number, base: number): number {
        const tramo = this.db.prepare(`
      SELECT limite_inferior, limite_superior, cuota_fija, tasa_excedente
      FROM isr_tarifas
      WHERE año = ? AND mes = ? AND limite_inferior <= ?
      ORDER BY limite_inferior DESC
      LIMIT 1
    `).get(año, mes, base) as TramoTarifa | undefined

        if (!tramo) return 0

        const excedente = base - tramo.limite_inferior
        return tramo.cuota_fija + excedente * tramo.tasa_excedente
    }
}