import BetterSqlite3 from 'better-sqlite3'

export function migration005(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS perfiles (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc               TEXT UNIQUE NOT NULL,
      nombre            TEXT NOT NULL,
      metodo_auth       TEXT CHECK(metodo_auth IN ('contrasena', 'efirma')) NOT NULL,
      contrasena        TEXT,
      ruta_cer          TEXT,
      ruta_key          TEXT,
      contrasena_fiel   TEXT,
      carpeta_descarga  TEXT,
      activo            INTEGER DEFAULT 0,
      fecha_creacion    TEXT DEFAULT (datetime('now'))
    )
  `)
}