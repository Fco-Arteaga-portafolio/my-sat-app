import BetterSqlite3 from 'better-sqlite3'
import { ProfileManager } from '../ProfileManager'

export interface PagoComplemento {
    id?: number
    uuid_rep: string
    fecha_pago?: string
    forma_pago_p?: string
    moneda_p?: string
    tipo_cambio_p?: number
    monto?: number
    documentos?: string
}

export interface DoctoRelacionado {
    id_documento: string
    serie?: string
    folio?: string
    moneda_dr?: string
    tipo_cambio_dr?: number
    metodo_pago_dr?: string
    num_parcialidad?: number
    imp_saldo_anterior?: number
    imp_pagado?: number
    imp_saldo_insoluto?: number
}

export class PagoComplementoRepository {
    constructor(private readonly db: BetterSqlite3.Database) { }

    private get tabla(): string {
        return ProfileManager.getTablaPagosComplemento()
    }

    insertar(pago: PagoComplemento): void {
        this.db.prepare(`
      INSERT OR IGNORE INTO ${this.tabla}
        (uuid_rep, fecha_pago, forma_pago_p, moneda_p, tipo_cambio_p, monto, documentos)
      VALUES
        (@uuid_rep, @fecha_pago, @forma_pago_p, @moneda_p, @tipo_cambio_p, @monto, @documentos)
    `).run({
            fecha_pago: null,
            forma_pago_p: null,
            moneda_p: null,
            tipo_cambio_p: null,
            monto: null,
            documentos: null,
            ...pago
        })
    }

    obtenerPorUuidRep(uuid_rep: string): PagoComplemento | null {
        return this.db
            .prepare(`SELECT * FROM ${this.tabla} WHERE uuid_rep = ?`)
            .get(uuid_rep) as PagoComplemento | null
    }

    obtenerTodos(): PagoComplemento[] {
        return this.db
            .prepare(`SELECT * FROM ${this.tabla} ORDER BY fecha_pago DESC`)
            .all() as PagoComplemento[]
    }

    eliminar(uuid_rep: string): void {
        this.db.prepare(`DELETE FROM ${this.tabla} WHERE uuid_rep = ?`).run(uuid_rep)
    }
}