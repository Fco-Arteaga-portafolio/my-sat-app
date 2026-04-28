import BetterSqlite3 from 'better-sqlite3'

export function migration013(db: BetterSqlite3.Database): void {
    db.exec(`
    -- Tabla de licencias (una sola por instalación)
    CREATE TABLE IF NOT EXISTS licencias (
      id                        INTEGER PRIMARY KEY AUTOINCREMENT,
      estado                    TEXT CHECK(estado IN ('Demo', 'Vigente', 'Vencido')) DEFAULT 'Demo' NOT NULL,
      fecha_inicio              TEXT,
      fecha_vencimiento         TEXT,
      rfc_maximo                INTEGER DEFAULT 1,
      maquinas_maximo           INTEGER DEFAULT 1,
      rfc_usado                 INTEGER DEFAULT 0,
      maquinas_usado            INTEGER DEFAULT 0,
      descargas_cfdi_maximo     INTEGER DEFAULT 3,
      descargas_cfdi_usado      INTEGER DEFAULT 0,
      importaciones_cfdi_maximo INTEGER DEFAULT 3,
      importaciones_cfdi_usado  INTEGER DEFAULT 0,
      consolidaciones_maximo    INTEGER DEFAULT 1,
      consolidaciones_usado     INTEGER DEFAULT 0,
      fecha_creacion            TEXT DEFAULT (datetime('now')),
      fecha_actualizacion       TEXT DEFAULT (datetime('now'))
    );

    -- Tabla de máquinas registradas (para validar licencia por PC)
    CREATE TABLE IF NOT EXISTS maquinas_registradas (
      id                        INTEGER PRIMARY KEY AUTOINCREMENT,
      identificador_maquina     TEXT UNIQUE NOT NULL,
      nombre_maquina            TEXT,
      so                        TEXT,
      fecha_registro            TEXT DEFAULT (datetime('now')),
      fecha_ultimo_acceso       TEXT DEFAULT (datetime('now')),
      activa                    INTEGER DEFAULT 1
    );

    -- Tabla de auditoría de licencias
    CREATE TABLE IF NOT EXISTS licencia_auditoria (
      id                        INTEGER PRIMARY KEY AUTOINCREMENT,
      evento                    TEXT NOT NULL,
      descripcion               TEXT,
      fecha_evento              TEXT DEFAULT (datetime('now'))
    );

    -- Índices
    CREATE INDEX IF NOT EXISTS idx_maquinas_identificador ON maquinas_registradas(identificador_maquina);
    CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON licencia_auditoria(fecha_evento);

    -- Insertar registro inicial de licencia en Demo
    INSERT OR IGNORE INTO licencias (
      id, estado, rfc_maximo, maquinas_maximo, 
      descargas_cfdi_maximo, importaciones_cfdi_maximo, consolidaciones_maximo
    ) VALUES (
      1, 'Demo', 1, 1, 3, 3, 1
    );
  `)
}
