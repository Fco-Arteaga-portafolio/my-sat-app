import BetterSqlite3 from 'better-sqlite3'
import { ProfileManager } from '../ProfileManager'

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

  private get tabla(): string {
    return ProfileManager.getTablaPendientes()
  }

  insertar(pendiente: DescargaPendiente): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ${this.tabla}
        (uuid, rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor,
         fecha_emision, total, tipo_comprobante, estado, url_descarga,
         tipo_descarga, error, intentos, fecha_fallo)
      VALUES
        (@uuid, @rfc_emisor, @nombre_emisor, @rfc_receptor, @nombre_receptor,
         @fecha_emision, @total, @tipo_comprobante, @estado, @url_descarga,
         @tipo_descarga, @error,
         COALESCE((SELECT intentos + 1 FROM ${this.tabla} WHERE uuid = @uuid), 1),
         datetime('now'))
    `)
    stmt.run(pendiente)
  }

  obtenerTodas(): DescargaPendiente[] {
    return this.db.prepare(`SELECT * FROM ${this.tabla} ORDER BY fecha_fallo DESC`).all() as DescargaPendiente[]
  }

  eliminar(uuid: string): void {
    this.db.prepare(`DELETE FROM ${this.tabla} WHERE uuid = ?`).run(uuid)
  }

  limpiar(): void {
    this.db.prepare(`DELETE FROM ${this.tabla}`).run()
  }

  contar(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as total FROM ${this.tabla}`).get() as { total: number }
    return row.total
  }
}