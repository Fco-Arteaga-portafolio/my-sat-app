import BetterSqlite3 from 'better-sqlite3'

export function migration003(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS descargas_pendientes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid        TEXT UNIQUE NOT NULL,
      rfc_emisor  TEXT,
      nombre_emisor TEXT,
      rfc_receptor TEXT,
      nombre_receptor TEXT,
      fecha_emision TEXT,
      total       REAL,
      tipo_comprobante TEXT,
      estado      TEXT,
      url_descarga TEXT,
      tipo_descarga TEXT CHECK(tipo_descarga IN ('recibida', 'emitida')),
      error       TEXT,
      intentos    INTEGER DEFAULT 1,
      fecha_fallo TEXT DEFAULT (datetime('now'))
    )
  `)
}