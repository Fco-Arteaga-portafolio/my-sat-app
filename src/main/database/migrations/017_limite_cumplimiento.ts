import BetterSqlite3 from 'better-sqlite3'

/**
 * El backend Emite define cumplimiento (opinión de cumplimiento) con 1 solo uso
 * en modalidad Demo (ContadorUsoModulo.UsosCumplimiento = 1). Corrige DBs que
 * hayan aplicado la migración 016 con el valor anterior (3).
 */
export function migration017(db: BetterSqlite3.Database): void {
  db.exec(`
    UPDATE licencias
    SET cumplimiento_maximo = 1
    WHERE cumplimiento_maximo > 1
    `)
}
