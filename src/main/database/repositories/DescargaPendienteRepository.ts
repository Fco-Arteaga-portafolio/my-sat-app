import BetterSqlite3 from 'better-sqlite3'

export interface DescargaPendiente {
  id?: number
  uuid: string
  rfc_emisor: string
  nombre_emisor: string
  rfc_receptor: string
  nombre_receptor: string
  fecha_emision: string
  total: number
  tipo_comprobante: string
  estado: string
  url_descarga: string
  tipo_descarga: 'recibida' | 'emitida'
  error: string
  intentos?: number
  fecha_fallo?: string
}

export class DescargaPendienteRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  insertar(pendiente: DescargaPendiente): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO descargas_pendientes
        (uuid, rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor,
         fecha_emision, total, tipo_comprobante, estado, url_descarga,
         tipo_descarga, error, intentos, fecha_fallo)
      VALUES
        (@uuid, @rfc_emisor, @nombre_emisor, @rfc_receptor, @nombre_receptor,
         @fecha_emision, @total, @tipo_comprobante, @estado, @url_descarga,
         @tipo_descarga, @error,
         COALESCE((SELECT intentos + 1 FROM descargas_pendientes WHERE uuid = @uuid), 1),
         datetime('now'))
    `)
    stmt.run(pendiente)
  }

  obtenerTodas(): DescargaPendiente[] {
    return this.db.prepare('SELECT * FROM descargas_pendientes ORDER BY fecha_fallo DESC').all() as DescargaPendiente[]
  }

  eliminar(uuid: string): void {
    this.db.prepare('DELETE FROM descargas_pendientes WHERE uuid = ?').run(uuid)
  }

  limpiar(): void {
    this.db.prepare('DELETE FROM descargas_pendientes').run()
  }

  contar(): number {
    const row = this.db.prepare('SELECT COUNT(*) as total FROM descargas_pendientes').get() as { total: number }
    return row.total
  }
}