import BetterSqlite3 from 'better-sqlite3'

export function migration004(db: BetterSqlite3.Database): void {
  const cols = [
    'serie TEXT',
    'folio TEXT',
    'fecha_timbrado TEXT',
    'forma_pago TEXT',
    'metodo_pago TEXT',
    'moneda TEXT',
    'tipo_cambio REAL',
    'descuento REAL DEFAULT 0',
    'total_impuestos_trasladados REAL DEFAULT 0',
    'total_impuestos_retenidos REAL DEFAULT 0',
    'estado_cancelacion TEXT',
    'estado_proceso_cancelacion TEXT',
    'fecha_cancelacion TEXT',
    'version TEXT',
    'rfc_pac TEXT',
    'folio_sustitucion TEXT'
  ]

  for (const col of cols) {
    const nombre = col.split(' ')[0]
    try {
      db.exec(`ALTER TABLE facturas ADD COLUMN ${col}`)
      console.log(`Columna ${nombre} agregada`)
    } catch {
      console.log(`Columna ${nombre} ya existe`)
    }
  }
}