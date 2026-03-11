import BetterSqlite3 from 'better-sqlite3'
import { ProfileManager } from '../ProfileManager'

export interface Factura {
  id?: number
  uuid: string
  version?: string
  serie?: string
  folio?: string
  fecha_emision: string
  fecha_timbrado?: string
  rfc_emisor: string
  nombre_emisor: string
  rfc_receptor: string
  nombre_receptor: string
  subtotal: number
  descuento?: number
  total_impuestos_trasladados?: number
  total_impuestos_retenidos?: number
  total: number
  tipo_comprobante: 'I' | 'E' | 'T' | 'N' | 'P'
  forma_pago?: string
  metodo_pago?: string
  moneda?: string
  tipo_cambio?: number
  estado: 'vigente' | 'cancelado'
  estado_cancelacion?: string
  estado_proceso_cancelacion?: string
  fecha_cancelacion?: string
  rfc_pac?: string
  folio_sustitucion?: string
  xml: string
  fecha_descarga?: string
  tipo_descarga?: 'recibida' | 'emitida'
}

export class FacturaRepository {
  constructor(private readonly db: BetterSqlite3.Database) { }

  private get tabla(): string {
    return ProfileManager.getTablaFacturas()
  }

  insertar(factura: Factura): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO ${this.tabla}
        (uuid, version, serie, folio, fecha_emision, fecha_timbrado,
         rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor,
         subtotal, descuento, total_impuestos_trasladados, total_impuestos_retenidos,
         total, tipo_comprobante, forma_pago, metodo_pago, moneda, tipo_cambio,
         estado, estado_cancelacion, estado_proceso_cancelacion, fecha_cancelacion,
         rfc_pac, folio_sustitucion, xml, tipo_descarga)
      VALUES
        (@uuid, @version, @serie, @folio, @fecha_emision, @fecha_timbrado,
         @rfc_emisor, @nombre_emisor, @rfc_receptor, @nombre_receptor,
         @subtotal, @descuento, @total_impuestos_trasladados, @total_impuestos_retenidos,
         @total, @tipo_comprobante, @forma_pago, @metodo_pago, @moneda, @tipo_cambio,
         @estado, @estado_cancelacion, @estado_proceso_cancelacion, @fecha_cancelacion,
         @rfc_pac, @folio_sustitucion, @xml, @tipo_descarga)
    `)
    stmt.run({
      version: null, serie: null, folio: null, fecha_timbrado: null,
      descuento: 0, total_impuestos_trasladados: 0, total_impuestos_retenidos: 0,
      forma_pago: null, metodo_pago: null, moneda: null, tipo_cambio: null,
      estado_cancelacion: null, estado_proceso_cancelacion: null,
      fecha_cancelacion: null, rfc_pac: null, folio_sustitucion: null,
      ...factura
    })
  }

  actualizar(uuid: string, campos: Partial<Factura>): void {
    const keys = Object.keys(campos).filter(k => k !== 'uuid')
    if (keys.length === 0) return
    const sets = keys.map(k => `${k} = @${k}`).join(', ')
    const stmt = this.db.prepare(`UPDATE ${this.tabla} SET ${sets} WHERE uuid = @uuid`)
    stmt.run({ ...campos, uuid })
  }

  obtenerTodas(): Factura[] {
    return this.db.prepare(`SELECT * FROM ${this.tabla} ORDER BY fecha_emision DESC`).all() as Factura[]
  }

  obtenerPorRfc(rfc: string): Factura[] {
    return this.db.prepare(`
      SELECT * FROM ${this.tabla}
      WHERE rfc_emisor = ? OR rfc_receptor = ?
      ORDER BY fecha_emision DESC
    `).all(rfc, rfc) as Factura[]
  }

  obtenerPorUuid(uuid: string): Factura | null {
    return this.db.prepare(`SELECT * FROM ${this.tabla} WHERE uuid = ?`).get(uuid) as Factura | null
  }

  eliminar(uuid: string): void {
    this.db.prepare(`DELETE FROM ${this.tabla} WHERE uuid = ?`).run(uuid)
  }

  obtenerDrillDown(rfc: string): Factura[] {
    return this.db.prepare(`
    SELECT * FROM ${this.tabla}
    WHERE (rfc_emisor = ? OR rfc_receptor = ?)
      AND tipo_comprobante IN ('I', 'E')
      AND estado = 'vigente'
    ORDER BY fecha_emision DESC
  `).all(rfc, rfc) as Factura[]
  }
}