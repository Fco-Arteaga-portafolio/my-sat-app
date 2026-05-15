import BetterSqlite3 from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'

export class Database {
  private static instance: BetterSqlite3.Database | null = null

  static getInstance(): BetterSqlite3.Database {
    if (!Database.instance) {
      const dbPath = join(app.getPath('userData'), 'facturas.db')
      Database.instance = new BetterSqlite3(dbPath)
      Database.instance.pragma('journal_mode = WAL')
      Database.instance.pragma('foreign_keys = ON')
      console.log('Ruta de la BD:', dbPath)
    }
    return Database.instance
  }

  static close(): void {
    if (Database.instance) {
      Database.instance.close()
      Database.instance = null
    }
  }
}