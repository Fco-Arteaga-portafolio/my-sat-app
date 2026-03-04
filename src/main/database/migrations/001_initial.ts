import BetterSqlite3 from 'better-sqlite3'

export function runMigration001(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS facturas (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid                  TEXT    UNIQUE NOT NULL,
      fecha_emision         TEXT,
      rfc_emisor            TEXT,
      nombre_emisor         TEXT,
      rfc_receptor          TEXT,
      nombre_receptor       TEXT,
      subtotal              REAL,
      total                 REAL,
      tipo_comprobante      TEXT CHECK(tipo_comprobante IN ('I','E','T','N','P')),
      estado                TEXT CHECK(estado IN ('vigente','cancelado')),
      xml                   TEXT,
      fecha_descarga        TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_facturas_rfc_emisor   ON facturas(rfc_emisor);
    CREATE INDEX IF NOT EXISTS idx_facturas_rfc_receptor ON facturas(rfc_receptor);
    CREATE INDEX IF NOT EXISTS idx_facturas_fecha        ON facturas(fecha_emision);
  `)
}