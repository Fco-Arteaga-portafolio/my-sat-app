import BetterSqlite3 from 'better-sqlite3'

export function migration015(db: BetterSqlite3.Database): void {
  db.exec(`
    -- Vinculación de cuenta (device code + JWT persistido)
    CREATE TABLE IF NOT EXISTS vinculacion (
      id                  INTEGER PRIMARY KEY CHECK (id = 1),
      jwt                 TEXT NOT NULL,
      hardware_id         TEXT NOT NULL,
      fecha_creacion      TEXT DEFAULT (datetime('now')),
      fecha_actualizacion TEXT DEFAULT (datetime('now'))
    );
    `)
}
