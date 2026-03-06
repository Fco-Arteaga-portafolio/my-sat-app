import BetterSqlite3 from 'better-sqlite3'
import { runMigration001 } from './migrations/001_initial'
import { migration002 } from './migrations/002_tipo_descarga'
import { migration003 } from './migrations/003_descargas_pendientes'
import { migration004 } from './migrations/004_campos_cfdi'
import { migration005 } from './migrations/005_perfiles'

export class MigrationRunner {
  constructor(private readonly db: BetterSqlite3.Database) { }

  run(): void {
    this.createMigrationsTable()
    this.executePending()
  }

  private createMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre    TEXT UNIQUE NOT NULL,
        ejecutada TEXT DEFAULT (datetime('now'))
      )
    `)
  }

  private executePending(): void {
    const migrations = [
      { nombre: '001_initial', fn: runMigration001 },
      { nombre: '002_tipo_descarga', fn: migration002 },
      { nombre: '003_descargas_pendientes', fn: migration003 },
      { nombre: '004_campos_cfdi', fn: migration004 },
      { nombre: '005_perfiles', fn: migration005 }
    ]

    for (const migration of migrations) {
      const yaEjecutada = this.db.prepare(
        'SELECT id FROM migrations WHERE nombre = ?'
      ).get(migration.nombre)

      if (!yaEjecutada) {
        migration.fn(this.db)
        this.db.prepare(
          'INSERT INTO migrations (nombre) VALUES (?)'
        ).run(migration.nombre)
        console.log(`Migración ejecutada: ${migration.nombre}`)
      }
    }
  }
}