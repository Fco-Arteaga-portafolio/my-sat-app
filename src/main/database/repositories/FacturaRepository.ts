import BetterSqlite3 from 'better-sqlite3'

export interface Factura {
  id?: number
  uuid: string
  fecha_emision: string
  rfc_emisor: string
  nombre_emisor: string
  rfc_receptor: string
  nombre_receptor: string
  subtotal: number
  total: number
  tipo_comprobante: 'I' | 'E' | 'T' | 'N' | 'P'
  estado: 'vigente' | 'cancelado'
  xml: string
  fecha_descarga?: string,
  tipo_descarga?: 'recibida' | 'emitida'
}

export class FacturaRepository {
  constructor(private readonly db: BetterSqlite3.Database) { }

  insertar(factura: Factura): void {
    const stmt = this.db.prepare(`
    INSERT OR IGNORE INTO facturas 
      (uuid, fecha_emision, rfc_emisor, nombre_emisor, rfc_receptor, 
       nombre_receptor, subtotal, total, tipo_comprobante, estado, xml, tipo_descarga)
    VALUES
      (@uuid, @fecha_emision, @rfc_emisor, @nombre_emisor, @rfc_receptor,
       @nombre_receptor, @subtotal, @total, @tipo_comprobante, @estado, @xml, @tipo_descarga)
  `)
    stmt.run(factura)
  }

  obtenerTodas(): Factura[] {
    return this.db.prepare(`
      SELECT * FROM facturas ORDER BY fecha_emision DESC
    `).all() as Factura[]
  }

  obtenerPorRfc(rfc: string): Factura[] {
    return this.db.prepare(`
      SELECT * FROM facturas 
      WHERE rfc_emisor = ? OR rfc_receptor = ?
      ORDER BY fecha_emision DESC
    `).all(rfc, rfc) as Factura[]
  }

  obtenerPorUuid(uuid: string): Factura | null {
    return this.db.prepare(`
      SELECT * FROM facturas WHERE uuid = ?
    `).get(uuid) as Factura | null
  }

  eliminar(uuid: string): void {
    this.db.prepare(`DELETE FROM facturas WHERE uuid = ?`).run(uuid)
  }
}