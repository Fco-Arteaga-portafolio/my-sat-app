import BetterSqlite3 from 'better-sqlite3'

/**
 * Flujo comercial IFRAT (Oct 2026):
 * - Conciliación pasa a 3 usos demo (igual que Descargar, Importar y Pendientes).
 * - Constancia de Situación Fiscal pasa a 1 uso demo (igual que Cumplimiento).
 */
export function migration018(db: BetterSqlite3.Database): void {
  db.exec(`
    ALTER TABLE licencias ADD COLUMN constancias_maximo INTEGER DEFAULT 1 NOT NULL;
    ALTER TABLE licencias ADD COLUMN constancias_usado  INTEGER DEFAULT 0 NOT NULL;
    UPDATE licencias SET consolidaciones_maximo = 3 WHERE id = 1 AND consolidaciones_maximo < 3;
    `)
}
