import BetterSqlite3 from 'better-sqlite3'

export function migration007(db: BetterSqlite3.Database): void {
  db.exec(`
    ALTER TABLE perfiles ADD COLUMN plantilla_default     TEXT NOT NULL DEFAULT 'clasica';
    ALTER TABLE perfiles ADD COLUMN carpeta_emitidos      TEXT;
    ALTER TABLE perfiles ADD COLUMN carpeta_recibidos     TEXT;
    ALTER TABLE perfiles ADD COLUMN estructura_emitidos   TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE perfiles ADD COLUMN estructura_recibidos  TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE perfiles ADD COLUMN config_nombre_archivo TEXT NOT NULL DEFAULT '{}';
  `)
}




