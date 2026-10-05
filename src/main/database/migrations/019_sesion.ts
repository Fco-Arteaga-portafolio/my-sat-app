import BetterSqlite3 from 'better-sqlite3'

/**
 * El backend eliminó el device-code (tabla vinculacion) y el Desktop ahora usa
 * el login directo igual que el sitio web: se persiste la sesión (token +
 * refreshToken + cuenta) y la máquina se declara por separado vía API.
 */
export function migration019(db: BetterSqlite3.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS vinculacion;

    CREATE TABLE IF NOT EXISTS sesion (
      id                  INTEGER PRIMARY KEY CHECK (id = 1),
      jwt                 TEXT NOT NULL,
      refresh_token       TEXT NOT NULL,
      nombre              TEXT NOT NULL,
      email               TEXT NOT NULL,
      hardware_id         TEXT NOT NULL,
      fecha_creacion      TEXT DEFAULT (datetime('now')),
      fecha_actualizacion TEXT DEFAULT (datetime('now'))
    );
    `)
}
