import BetterSqlite3 from 'better-sqlite3'

export const migration010 = (db: BetterSqlite3.Database): void => {
    const perfiles = db.prepare('SELECT rfc FROM perfiles').all() as { rfc: string }[]

    for (const { rfc } of perfiles) {
        const r = rfc.replace(/[^a-zA-Z0-9]/g, '_')
        db.prepare(`
      CREATE TABLE IF NOT EXISTS nomina_complemento_${r} (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid_cfdi               TEXT NOT NULL UNIQUE,
        tipo_nomina             TEXT,
        fecha_pago              TEXT,
        fecha_inicial_pago      TEXT,
        fecha_final_pago        TEXT,
        num_dias_pagados        REAL,
        total_percepciones      REAL,
        total_deducciones       REAL,
        total_otros_pagos       REAL,
        curp                    TEXT,
        num_empleado            TEXT,
        departamento            TEXT,
        puesto                  TEXT,
        tipo_regimen            TEXT,
        tipo_contrato           TEXT,
        periodicidad_pago       TEXT,
        salario_diario_integrado REAL,
        percepciones            TEXT,
        deducciones             TEXT,
        otros_pagos             TEXT,
        incapacidades           TEXT,
        FOREIGN KEY (uuid_cfdi) REFERENCES facturas_${r}(uuid)
      )
    `).run()
    }
}