import BetterSqlite3 from 'better-sqlite3'

export function migration016(db: BetterSqlite3.Database): void {
  db.exec(`
    -- Límites demo por módulo: pendientes (3 usos) y cumplimiento (1 uso, según backend Emite)
    ALTER TABLE licencias ADD COLUMN pendientes_cfdi_maximo INTEGER DEFAULT 3 NOT NULL;
    ALTER TABLE licencias ADD COLUMN pendientes_cfdi_usado  INTEGER DEFAULT 0 NOT NULL;
    ALTER TABLE licencias ADD COLUMN cumplimiento_maximo    INTEGER DEFAULT 1 NOT NULL;
    ALTER TABLE licencias ADD COLUMN cumplimiento_usado     INTEGER DEFAULT 0 NOT NULL;
    `)
}
