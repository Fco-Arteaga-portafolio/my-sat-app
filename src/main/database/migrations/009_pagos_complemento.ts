import BetterSqlite3 from 'better-sqlite3'

export const migration009 = (db: BetterSqlite3.Database): void => {
    const perfiles = db.prepare('SELECT rfc FROM perfiles').all() as { rfc: string }[]

    for (const { rfc } of perfiles) {
        const r = rfc.replace(/[^a-zA-Z0-9]/g, '_')
        db.prepare(`
      CREATE TABLE IF NOT EXISTS pagos_complemento_${r} (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid_rep      TEXT NOT NULL,
        fecha_pago    TEXT,
        forma_pago_p  TEXT,
        moneda_p      TEXT,
        tipo_cambio_p REAL,
        monto         REAL,
        documentos    TEXT,
        FOREIGN KEY (uuid_rep) REFERENCES facturas_${r}(uuid)
      )
    `).run()
    }
}