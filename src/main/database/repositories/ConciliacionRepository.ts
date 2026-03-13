import BetterSqlite3 from 'better-sqlite3'
import { ProfileManager } from '../ProfileManager'

export interface Conciliacion {
  id?: number
  tipo: 'emitidas' | 'recibidas'
  ejercicio: string
  periodo: string
  fecha_conciliacion?: string
  total_sat: number
  total_local: number
  descargadas: number
  actualizadas: number
  errores: number
}

export class ConciliacionRepository {
  constructor(private readonly db: BetterSqlite3.Database) { }

  private get tabla(): string {
    return ProfileManager.getTablaConciliaciones()
  }

  insertar(c: Omit<Conciliacion, 'id' | 'fecha_conciliacion'>): void {
    this.db.prepare(`
      INSERT INTO ${this.tabla}
        (tipo, ejercicio, periodo, total_sat, total_local, descargadas, actualizadas, errores)
      VALUES
        (@tipo, @ejercicio, @periodo, @total_sat, @total_local, @descargadas, @actualizadas, @errores)
    `).run(c)
  }

  obtenerUltima(tipo: string, ejercicio: string, periodo: string): Conciliacion | null {
    return this.db.prepare(`
      SELECT * FROM ${this.tabla}
      WHERE tipo = ? AND ejercicio = ? AND periodo = ?
      ORDER BY fecha_conciliacion DESC
      LIMIT 1
    `).get(tipo, ejercicio, periodo) as Conciliacion | null
  }

  obtenerHistorial(limite = 20): Conciliacion[] {
    return this.db.prepare(`
      SELECT * FROM ${this.tabla}
      ORDER BY fecha_conciliacion DESC
      LIMIT ?
    `).all(limite) as Conciliacion[]
  }
}