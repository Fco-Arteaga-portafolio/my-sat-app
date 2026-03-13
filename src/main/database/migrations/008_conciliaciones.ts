import BetterSqlite3 from 'better-sqlite3'

export function migration008(db: BetterSqlite3.Database): void {
  // Crear tabla conciliaciones para cada perfil que ya existe en la BD
  const perfiles = db.prepare('SELECT rfc FROM perfiles').all() as { rfc: string }[]

  for (const { rfc } of perfiles) {
    const r = rfc.replace(/[^A-Z0-9]/gi, '')
    db.prepare(`
      CREATE TABLE IF NOT EXISTS conciliaciones_${r} (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo               TEXT    NOT NULL CHECK(tipo IN ('emitidas','recibidas')),
        ejercicio          TEXT    NOT NULL,
        periodo            TEXT    NOT NULL,
        fecha_conciliacion TEXT    NOT NULL DEFAULT (datetime('now')),
        total_sat          INTEGER NOT NULL DEFAULT 0,
        total_local        INTEGER NOT NULL DEFAULT 0,
        descargadas        INTEGER NOT NULL DEFAULT 0,
        actualizadas       INTEGER NOT NULL DEFAULT 0,
        errores            INTEGER NOT NULL DEFAULT 0
      )
    `).run()
  }
}