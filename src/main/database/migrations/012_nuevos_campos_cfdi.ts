import BetterSqlite3 from 'better-sqlite3'
import { ProfileManager } from '../ProfileManager'

export function migration012(db: BetterSqlite3.Database): void {
    // ── Columnas nuevas en todas las tablas de facturas por perfil ─────────────
    const perfiles = db.prepare('SELECT rfc FROM perfiles').all() as { rfc: string }[]
    const tablas = perfiles.map((p) => `facturas_${p.rfc.replace(/[^A-Z0-9]/gi, '')}`)

    // También la tabla base por si existe algún perfil legado
    tablas.push('facturas')

    const columnas = [
        'regimen_fiscal_emisor TEXT',
        'regimen_fiscal_receptor TEXT',
        'uso_cfdi TEXT'
    ]

    for (const tabla of tablas) {
        const existe = db.prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        ).get(tabla)

        if (!existe) continue

        for (const col of columnas) {
            const nombre = col.split(' ')[0]
            try {
                db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${col}`)
                console.log(`Columna ${nombre} agregada a ${tabla}`)
            } catch {
                console.log(`Columna ${nombre} ya existe en ${tabla}`)
            }
        }
    }

    // ── Tabla cfdi_estado_pago (global, no por perfil) ─────────────────────────
    // Registra si un CFDI fue marcado como pagado/cobrado manualmente
    // Los PUE se insertan como pagado=1 al guardar el CFDI
    // Los PPD se insertan como pagado=0 y se actualizan cuando llega el complemento de pago
    db.exec(`
    CREATE TABLE IF NOT EXISTS cfdi_estado_pago (
      uuid                TEXT PRIMARY KEY,
      pagado              INTEGER NOT NULL DEFAULT 0,
      fecha_actualizacion TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)
}