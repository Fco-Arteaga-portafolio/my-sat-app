import BetterSqlite3 from 'better-sqlite3'

export function migration002(db: BetterSqlite3.Database): void {
  db.exec(`
    ALTER TABLE facturas ADD COLUMN tipo_descarga TEXT CHECK(tipo_descarga IN ('recibida', 'emitida')) DEFAULT 'recibida'
  `)
}