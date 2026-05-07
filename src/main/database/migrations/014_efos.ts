import BetterSqlite3 from 'better-sqlite3'

export function migration014(db: BetterSqlite3.Database): void {
    db.exec(`
    CREATE TABLE IF NOT EXISTS efos (
      rfc        TEXT PRIMARY KEY,
      nombre     TEXT,
      situacion  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS efos_meta (
      id               INTEGER PRIMARY KEY CHECK (id = 1),
      ultima_sync      TEXT,
      total_registros  INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO efos_meta (id, total_registros) VALUES (1, 0);
  `)
}

export function down(db: BetterSqlite3.Database): void {
    db.exec(`
    DROP TABLE IF EXISTS efos;
    DROP TABLE IF EXISTS efos_meta;
  `)
}