import BetterSqlite3 from 'better-sqlite3'
import { ProfileManager } from '../ProfileManager'

export interface NominaComplemento {
    id?: number
    uuid_cfdi: string
    tipo_nomina?: string
    fecha_pago?: string
    fecha_inicial_pago?: string
    fecha_final_pago?: string
    num_dias_pagados?: number
    total_percepciones?: number
    total_deducciones?: number
    total_otros_pagos?: number
    curp?: string
    num_empleado?: string
    departamento?: string
    puesto?: string
    tipo_regimen?: string
    tipo_contrato?: string
    periodicidad_pago?: string
    salario_diario_integrado?: number
    percepciones?: string
    deducciones?: string
    otros_pagos?: string
    incapacidades?: string
}

export class NominaComplementoRepository {
    constructor(private readonly db: BetterSqlite3.Database) { }

    private get tabla(): string {
        return ProfileManager.getTablaNominaComplemento()
    }

    insertar(nomina: NominaComplemento): void {
        this.db.prepare(`
      INSERT OR IGNORE INTO ${this.tabla}
        (uuid_cfdi, tipo_nomina, fecha_pago, fecha_inicial_pago, fecha_final_pago,
         num_dias_pagados, total_percepciones, total_deducciones, total_otros_pagos,
         curp, num_empleado, departamento, puesto, tipo_regimen, tipo_contrato,
         periodicidad_pago, salario_diario_integrado,
         percepciones, deducciones, otros_pagos, incapacidades)
      VALUES
        (@uuid_cfdi, @tipo_nomina, @fecha_pago, @fecha_inicial_pago, @fecha_final_pago,
         @num_dias_pagados, @total_percepciones, @total_deducciones, @total_otros_pagos,
         @curp, @num_empleado, @departamento, @puesto, @tipo_regimen, @tipo_contrato,
         @periodicidad_pago, @salario_diario_integrado,
         @percepciones, @deducciones, @otros_pagos, @incapacidades)
    `).run({
            tipo_nomina: null, fecha_pago: null, fecha_inicial_pago: null, fecha_final_pago: null,
            num_dias_pagados: null, total_percepciones: null, total_deducciones: null,
            total_otros_pagos: null, curp: null, num_empleado: null, departamento: null,
            puesto: null, tipo_regimen: null, tipo_contrato: null, periodicidad_pago: null,
            salario_diario_integrado: null, percepciones: null, deducciones: null,
            otros_pagos: null, incapacidades: null,
            ...nomina
        })
    }

    obtenerPorUuid(uuid_cfdi: string): NominaComplemento | null {
        return this.db
            .prepare(`SELECT * FROM ${this.tabla} WHERE uuid_cfdi = ?`)
            .get(uuid_cfdi) as NominaComplemento | null
    }

    eliminar(uuid_cfdi: string): void {
        this.db.prepare(`DELETE FROM ${this.tabla} WHERE uuid_cfdi = ?`).run(uuid_cfdi)
    }
}