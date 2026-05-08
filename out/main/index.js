"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const BetterSqlite3 = require("better-sqlite3");
const fs = require("fs");
const path$1 = require("path/win32");
const playwright = require("playwright");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf");
const axios = require("axios");
const xmldom = require("@xmldom/xmldom");
const electronUpdater = require("electron-updater");
const https = require("https");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const pdfjsLib__namespace = /* @__PURE__ */ _interopNamespaceDefault(pdfjsLib);
const icon = path.join(__dirname, "../../resources/icon.png");
class Database {
  static instance = null;
  static getInstance() {
    if (!Database.instance) {
      const dbPath = path.join(electron.app.getPath("userData"), "facturas.db");
      Database.instance = new BetterSqlite3(dbPath);
      Database.instance.pragma("journal_mode = WAL");
      Database.instance.pragma("foreign_keys = ON");
    }
    return Database.instance;
  }
  static close() {
    if (Database.instance) {
      Database.instance.close();
      Database.instance = null;
    }
  }
}
function runMigration001(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS facturas (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid                  TEXT    UNIQUE NOT NULL,
      fecha_emision         TEXT,
      rfc_emisor            TEXT,
      nombre_emisor         TEXT,
      rfc_receptor          TEXT,
      nombre_receptor       TEXT,
      subtotal              REAL,
      total                 REAL,
      tipo_comprobante      TEXT CHECK(tipo_comprobante IN ('I','E','T','N','P')),
      estado                TEXT CHECK(estado IN ('vigente','cancelado')),
      xml                   TEXT,
      fecha_descarga        TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_facturas_rfc_emisor   ON facturas(rfc_emisor);
    CREATE INDEX IF NOT EXISTS idx_facturas_rfc_receptor ON facturas(rfc_receptor);
    CREATE INDEX IF NOT EXISTS idx_facturas_fecha        ON facturas(fecha_emision);
  `);
}
function migration002(db) {
  db.exec(`
    ALTER TABLE facturas ADD COLUMN tipo_descarga TEXT CHECK(tipo_descarga IN ('recibida', 'emitida')) DEFAULT 'recibida'
  `);
}
function migration003(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS descargas_pendientes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid        TEXT UNIQUE NOT NULL,
      rfc_emisor  TEXT,
      nombre_emisor TEXT,
      rfc_receptor TEXT,
      nombre_receptor TEXT,
      fecha_emision TEXT,
      total       REAL,
      tipo_comprobante TEXT,
      estado      TEXT,
      url_descarga TEXT,
      tipo_descarga TEXT CHECK(tipo_descarga IN ('recibida', 'emitida')),
      error       TEXT,
      intentos    INTEGER DEFAULT 1,
      fecha_fallo TEXT DEFAULT (datetime('now'))
    )
  `);
}
function migration004(db) {
  const cols = [
    "serie TEXT",
    "folio TEXT",
    "fecha_timbrado TEXT",
    "forma_pago TEXT",
    "metodo_pago TEXT",
    "moneda TEXT",
    "tipo_cambio REAL",
    "descuento REAL DEFAULT 0",
    "total_impuestos_trasladados REAL DEFAULT 0",
    "total_impuestos_retenidos REAL DEFAULT 0",
    "estado_cancelacion TEXT",
    "estado_proceso_cancelacion TEXT",
    "fecha_cancelacion TEXT",
    "version TEXT",
    "rfc_pac TEXT",
    "folio_sustitucion TEXT"
  ];
  for (const col of cols) {
    const nombre = col.split(" ")[0];
    try {
      db.exec(`ALTER TABLE facturas ADD COLUMN ${col}`);
      console.log(`Columna ${nombre} agregada`);
    } catch {
      console.log(`Columna ${nombre} ya existe`);
    }
  }
}
function migration005(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS perfiles (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc               TEXT UNIQUE NOT NULL,
      nombre            TEXT NOT NULL,
      metodo_auth       TEXT CHECK(metodo_auth IN ('contrasena', 'efirma')) NOT NULL,
      contrasena        TEXT,
      ruta_cer          TEXT,
      ruta_key          TEXT,
      contrasena_fiel   TEXT,
      carpeta_descarga  TEXT,
      activo            INTEGER DEFAULT 0,
      fecha_creacion    TEXT DEFAULT (datetime('now'))
    )
  `);
}
const migration006 = (db) => {
  const perfiles = db.prepare("SELECT rfc FROM perfiles").all();
  for (const { rfc } of perfiles) {
    const r = rfc.replace(/[^A-Z0-9]/gi, "");
    db.prepare(`
      CREATE TABLE IF NOT EXISTS clientes_${r} (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        rfc             TEXT UNIQUE NOT NULL,
        nombre          TEXT,
        telefono        TEXT,
        email           TEXT,
        direccion       TEXT,
        contacto        TEXT,
        notas           TEXT,
        limite_credito  REAL,
        dias_credito    INTEGER,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS proveedores_${r} (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        rfc             TEXT UNIQUE NOT NULL,
        nombre          TEXT,
        telefono        TEXT,
        email           TEXT,
        direccion       TEXT,
        contacto        TEXT,
        notas           TEXT,
        limite_credito  REAL,
        dias_credito    INTEGER,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS empleados_${r} (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        rfc             TEXT UNIQUE NOT NULL,
        nombre          TEXT,
        telefono        TEXT,
        email           TEXT,
        direccion       TEXT,
        notas           TEXT,
        puesto          TEXT,
        fecha_ingreso   DATE,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS patrones_${r} (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        rfc             TEXT UNIQUE NOT NULL,
        nombre          TEXT,
        telefono        TEXT,
        email           TEXT,
        direccion       TEXT,
        contacto        TEXT,
        notas           TEXT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  }
};
function migration007(db) {
  db.exec(`
    ALTER TABLE perfiles ADD COLUMN plantilla_default     TEXT NOT NULL DEFAULT 'clasica';
    ALTER TABLE perfiles ADD COLUMN carpeta_emitidos      TEXT;
    ALTER TABLE perfiles ADD COLUMN carpeta_recibidos     TEXT;
    ALTER TABLE perfiles ADD COLUMN estructura_emitidos   TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE perfiles ADD COLUMN estructura_recibidos  TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE perfiles ADD COLUMN config_nombre_archivo TEXT NOT NULL DEFAULT '{}';
  `);
}
function migration008(db) {
  const perfiles = db.prepare("SELECT rfc FROM perfiles").all();
  for (const { rfc } of perfiles) {
    const r = rfc.replace(/[^A-Z0-9]/gi, "");
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
    `).run();
  }
}
const migration009 = (db) => {
  const perfiles = db.prepare("SELECT rfc FROM perfiles").all();
  for (const { rfc } of perfiles) {
    const r = rfc.replace(/[^a-zA-Z0-9]/g, "_");
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
    `).run();
  }
};
const migration010 = (db) => {
  const perfiles = db.prepare("SELECT rfc FROM perfiles").all();
  for (const { rfc } of perfiles) {
    const r = rfc.replace(/[^a-zA-Z0-9]/g, "_");
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
    `).run();
  }
};
function migration011(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS isr_tarifas (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      año               INTEGER NOT NULL,
      mes               INTEGER NOT NULL, -- 1-12: tarifa acumulada del mes para pagos provisionales
      limite_inferior   REAL    NOT NULL,
      limite_superior   REAL,             -- NULL = sin límite superior (último tramo)
      cuota_fija        REAL    NOT NULL,
      tasa_excedente    REAL    NOT NULL  -- en decimal: 0.0192, 0.064, etc.
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS isr_tasas_fijas (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      año      INTEGER NOT NULL,
      regimen  TEXT    NOT NULL, -- 'resico_pf' | 'resico_pm' | 'pm_general'
      tasa     REAL    NOT NULL  -- en decimal
    )
  `);
  const insertTarifa = db.prepare(`
    INSERT INTO isr_tarifas (año, mes, limite_inferior, limite_superior, cuota_fija, tasa_excedente)
    VALUES (@año, @mes, @li, @ls, @cf, @te)
  `);
  const insertTasa = db.prepare(`
    INSERT INTO isr_tasas_fijas (año, regimen, tasa) VALUES (@año, @regimen, @tasa)
  `);
  const insertarMeses = (año, tramos) => {
    for (let mes = 1; mes <= 12; mes++) {
      for (const t of tramos[mes - 1]) {
        insertTarifa.run({ año, mes, li: t.li, ls: t.ls, cf: t.cf, te: t.te });
      }
    }
  };
  const tramos2023_2024_2025 = [
    // Enero (mes 1) — igual a tabla mensual base
    [
      { li: 0.01, ls: 746.04, cf: 0, te: 0.0192 },
      { li: 746.05, ls: 6332.05, cf: 14.32, te: 0.064 },
      { li: 6332.06, ls: 11128.01, cf: 371.83, te: 0.1088 },
      { li: 11128.02, ls: 12935.82, cf: 893.63, te: 0.16 },
      { li: 12935.83, ls: 15487.71, cf: 1182.88, te: 0.1792 },
      { li: 15487.72, ls: 31236.49, cf: 1640.18, te: 0.2136 },
      { li: 31236.5, ls: 49233, cf: 5004.12, te: 0.2352 },
      { li: 49233.01, ls: 93993.9, cf: 9236.89, te: 0.3 },
      { li: 93993.91, ls: 125325.2, cf: 22665.17, te: 0.32 },
      { li: 125325.21, ls: 375975.61, cf: 32691.18, te: 0.34 },
      { li: 375975.62, ls: null, cf: 117912.32, te: 0.35 }
    ],
    // Febrero (mes 2)
    [
      { li: 0.01, ls: 1492.08, cf: 0, te: 0.0192 },
      { li: 1492.09, ls: 12664.1, cf: 28.64, te: 0.064 },
      { li: 12664.11, ls: 22256.02, cf: 743.66, te: 0.1088 },
      { li: 22256.03, ls: 25871.64, cf: 1787.26, te: 0.16 },
      { li: 25871.65, ls: 30975.42, cf: 2365.76, te: 0.1792 },
      { li: 30975.43, ls: 62472.98, cf: 3280.36, te: 0.2136 },
      { li: 62472.99, ls: 98466, cf: 10008.24, te: 0.2352 },
      { li: 98466.01, ls: 187987.8, cf: 18473.78, te: 0.3 },
      { li: 187987.81, ls: 250650.4, cf: 45330.34, te: 0.32 },
      { li: 250650.41, ls: 751951.22, cf: 65382.36, te: 0.34 },
      { li: 751951.23, ls: null, cf: 235824.64, te: 0.35 }
    ],
    // Marzo (mes 3)
    [
      { li: 0.01, ls: 2238.12, cf: 0, te: 0.0192 },
      { li: 2238.13, ls: 18996.15, cf: 42.96, te: 0.064 },
      { li: 18996.16, ls: 33384.03, cf: 1115.49, te: 0.1088 },
      { li: 33384.04, ls: 38807.46, cf: 2680.89, te: 0.16 },
      { li: 38807.47, ls: 46463.13, cf: 3548.64, te: 0.1792 },
      { li: 46463.14, ls: 93709.47, cf: 4920.54, te: 0.2136 },
      { li: 93709.48, ls: 147699, cf: 15012.36, te: 0.2352 },
      { li: 147699.01, ls: 281981.7, cf: 27710.67, te: 0.3 },
      { li: 281981.71, ls: 375975.6, cf: 67995.51, te: 0.32 },
      { li: 375975.61, ls: 112792683e-2, cf: 98073.54, te: 0.34 },
      { li: 112792684e-2, ls: null, cf: 353736.96, te: 0.35 }
    ],
    // Abril (mes 4)
    [
      { li: 0.01, ls: 2984.16, cf: 0, te: 0.0192 },
      { li: 2984.17, ls: 25328.2, cf: 57.28, te: 0.064 },
      { li: 25328.21, ls: 44512.04, cf: 1487.32, te: 0.1088 },
      { li: 44512.05, ls: 51743.28, cf: 3574.52, te: 0.16 },
      { li: 51743.29, ls: 61950.84, cf: 4731.52, te: 0.1792 },
      { li: 61950.85, ls: 124945.96, cf: 6560.72, te: 0.2136 },
      { li: 124945.97, ls: 196932, cf: 20016.48, te: 0.2352 },
      { li: 196932.01, ls: 375975.6, cf: 36947.56, te: 0.3 },
      { li: 375975.61, ls: 501300.8, cf: 90660.68, te: 0.32 },
      { li: 501300.81, ls: 150390244e-2, cf: 130764.72, te: 0.34 },
      { li: 150390245e-2, ls: null, cf: 471649.28, te: 0.35 }
    ],
    // Mayo (mes 5)
    [
      { li: 0.01, ls: 3730.2, cf: 0, te: 0.0192 },
      { li: 3730.21, ls: 31660.25, cf: 71.6, te: 0.064 },
      { li: 31660.26, ls: 55640.05, cf: 1859.15, te: 0.1088 },
      { li: 55640.06, ls: 64679.1, cf: 4468.15, te: 0.16 },
      { li: 64679.11, ls: 77438.55, cf: 5914.4, te: 0.1792 },
      { li: 77438.56, ls: 156182.45, cf: 8200.9, te: 0.2136 },
      { li: 156182.46, ls: 246165, cf: 25020.6, te: 0.2352 },
      { li: 246165.01, ls: 469969.5, cf: 46184.45, te: 0.3 },
      { li: 469969.51, ls: 626626, cf: 113325.85, te: 0.32 },
      { li: 626626.01, ls: 187987805e-2, cf: 163455.9, te: 0.34 },
      { li: 187987806e-2, ls: null, cf: 589561.6, te: 0.35 }
    ],
    // Junio (mes 6)
    [
      { li: 0.01, ls: 4476.24, cf: 0, te: 0.0192 },
      { li: 4476.25, ls: 37992.3, cf: 85.92, te: 0.064 },
      { li: 37992.31, ls: 66768.06, cf: 2230.98, te: 0.1088 },
      { li: 66768.07, ls: 77614.92, cf: 5361.78, te: 0.16 },
      { li: 77614.93, ls: 92926.26, cf: 7097.28, te: 0.1792 },
      { li: 92926.27, ls: 187418.94, cf: 9841.08, te: 0.2136 },
      { li: 187418.95, ls: 295398, cf: 30024.72, te: 0.2352 },
      { li: 295398.01, ls: 563963.4, cf: 55421.34, te: 0.3 },
      { li: 563963.41, ls: 751951.2, cf: 135991.02, te: 0.32 },
      { li: 751951.21, ls: 225585366e-2, cf: 196147.08, te: 0.34 },
      { li: 225585367e-2, ls: null, cf: 707473.92, te: 0.35 }
    ],
    // Julio (mes 7)
    [
      { li: 0.01, ls: 5222.28, cf: 0, te: 0.0192 },
      { li: 5222.29, ls: 44324.35, cf: 100.24, te: 0.064 },
      { li: 44324.36, ls: 77896.07, cf: 2602.81, te: 0.1088 },
      { li: 77896.08, ls: 90550.74, cf: 6255.41, te: 0.16 },
      { li: 90550.75, ls: 108413.97, cf: 8280.16, te: 0.1792 },
      { li: 108413.98, ls: 218655.43, cf: 11481.26, te: 0.2136 },
      { li: 218655.44, ls: 344631, cf: 35028.84, te: 0.2352 },
      { li: 344631.01, ls: 657957.3, cf: 64658.23, te: 0.3 },
      { li: 657957.31, ls: 877276.4, cf: 158656.19, te: 0.32 },
      { li: 877276.41, ls: 263182927e-2, cf: 228838.26, te: 0.34 },
      { li: 263182928e-2, ls: null, cf: 825386.24, te: 0.35 }
    ],
    // Agosto (mes 8)
    [
      { li: 0.01, ls: 5968.32, cf: 0, te: 0.0192 },
      { li: 5968.33, ls: 50656.4, cf: 114.56, te: 0.064 },
      { li: 50656.41, ls: 89024.08, cf: 2974.64, te: 0.1088 },
      { li: 89024.09, ls: 103486.56, cf: 7149.04, te: 0.16 },
      { li: 103486.57, ls: 123901.68, cf: 9463.04, te: 0.1792 },
      { li: 123901.69, ls: 249891.92, cf: 13121.44, te: 0.2136 },
      { li: 249891.93, ls: 393864, cf: 40032.96, te: 0.2352 },
      { li: 393864.01, ls: 751951.2, cf: 73895.12, te: 0.3 },
      { li: 751951.21, ls: 10026016e-1, cf: 181321.36, te: 0.32 },
      { li: 100260161e-2, ls: 300780488e-2, cf: 261529.44, te: 0.34 },
      { li: 300780489e-2, ls: null, cf: 943298.56, te: 0.35 }
    ],
    // Septiembre (mes 9)
    [
      { li: 0.01, ls: 6714.36, cf: 0, te: 0.0192 },
      { li: 6714.37, ls: 56988.45, cf: 128.88, te: 0.064 },
      { li: 56988.46, ls: 100152.09, cf: 3346.47, te: 0.1088 },
      { li: 100152.1, ls: 116422.38, cf: 8042.67, te: 0.16 },
      { li: 116422.39, ls: 139389.39, cf: 10645.92, te: 0.1792 },
      { li: 139389.4, ls: 281128.41, cf: 14761.62, te: 0.2136 },
      { li: 281128.42, ls: 443097, cf: 45037.08, te: 0.2352 },
      { li: 443097.01, ls: 845945.1, cf: 83132.01, te: 0.3 },
      { li: 845945.11, ls: 11279268e-1, cf: 203986.53, te: 0.32 },
      { li: 112792681e-2, ls: 338378049e-2, cf: 294220.62, te: 0.34 },
      { li: 33837805e-1, ls: null, cf: 106121088e-2, te: 0.35 }
    ],
    // Octubre (mes 10)
    [
      { li: 0.01, ls: 7460.4, cf: 0, te: 0.0192 },
      { li: 7460.41, ls: 63320.5, cf: 143.2, te: 0.064 },
      { li: 63320.51, ls: 111280.1, cf: 3718.3, te: 0.1088 },
      { li: 111280.11, ls: 129358.2, cf: 8936.3, te: 0.16 },
      { li: 129358.21, ls: 154877.1, cf: 11828.8, te: 0.1792 },
      { li: 154877.11, ls: 312364.9, cf: 16401.8, te: 0.2136 },
      { li: 312364.91, ls: 492330, cf: 50041.2, te: 0.2352 },
      { li: 492330.01, ls: 939939, cf: 92368.9, te: 0.3 },
      { li: 939939.01, ls: 1253252, cf: 226651.7, te: 0.32 },
      { li: 125325201e-2, ls: 37597561e-1, cf: 326911.8, te: 0.34 },
      { li: 375975611e-2, ls: null, cf: 11791232e-1, te: 0.35 }
    ],
    // Noviembre (mes 11)
    [
      { li: 0.01, ls: 8206.44, cf: 0, te: 0.0192 },
      { li: 8206.45, ls: 69652.55, cf: 157.52, te: 0.064 },
      { li: 69652.56, ls: 122408.11, cf: 4090.13, te: 0.1088 },
      { li: 122408.12, ls: 142294.02, cf: 9829.93, te: 0.16 },
      { li: 142294.03, ls: 170364.81, cf: 13011.68, te: 0.1792 },
      { li: 170364.82, ls: 343601.39, cf: 18041.98, te: 0.2136 },
      { li: 343601.4, ls: 541563, cf: 55045.32, te: 0.2352 },
      { li: 541563.01, ls: 10339329e-1, cf: 101605.79, te: 0.3 },
      { li: 103393291e-2, ls: 13785772e-1, cf: 249316.87, te: 0.32 },
      { li: 137857721e-2, ls: 413573171e-2, cf: 359602.98, te: 0.34 },
      { li: 413573172e-2, ls: null, cf: 129703552e-2, te: 0.35 }
    ],
    // Diciembre (mes 12) — igual a tabla anual
    [
      { li: 0.01, ls: 8952.49, cf: 0, te: 0.0192 },
      { li: 8952.5, ls: 75984.55, cf: 171.88, te: 0.064 },
      { li: 75984.56, ls: 133536.07, cf: 4461.94, te: 0.1088 },
      { li: 133536.08, ls: 155229.8, cf: 10723.55, te: 0.16 },
      { li: 155229.81, ls: 185852.57, cf: 14194.54, te: 0.1792 },
      { li: 185852.58, ls: 374837.88, cf: 19682.13, te: 0.2136 },
      { li: 374837.89, ls: 590795.99, cf: 60049.4, te: 0.2352 },
      { li: 590796, ls: 112792684e-2, cf: 110842.74, te: 0.3 },
      { li: 112792685e-2, ls: 150390246e-2, cf: 271981.99, te: 0.32 },
      { li: 150390247e-2, ls: 451170737e-2, cf: 392294.17, te: 0.34 },
      { li: 451170738e-2, ls: null, cf: 141494785e-2, te: 0.35 }
    ]
  ];
  for (const año of [2023, 2024, 2025]) {
    insertarMeses(año, tramos2023_2024_2025);
  }
  const tramos2026 = [
    // Enero
    [
      { li: 0, ls: 844.59, cf: 0, te: 0.0192 },
      { li: 844.59, ls: 7168.51, cf: 16.22, te: 0.064 },
      { li: 7168.51, ls: 12598.02, cf: 420.95, te: 0.1088 },
      { li: 12598.02, ls: 14644.64, cf: 1011.68, te: 0.16 },
      { li: 14644.64, ls: 17533.64, cf: 1339.14, te: 0.1792 },
      { li: 17533.64, ls: 35362.83, cf: 1856.85, te: 0.2136 },
      { li: 35362.83, ls: 55736.68, cf: 5665.16, te: 0.2352 },
      { li: 55736.68, ls: 106410.5, cf: 10457.09, te: 0.3 },
      { li: 106410.5, ls: 141880.66, cf: 25659.23, te: 0.32 },
      { li: 141880.67, ls: 425641.99, cf: 37009.69, te: 0.34 },
      { li: 425641.99, ls: null, cf: 133488.54, te: 0.35 }
    ],
    // Febrero
    [
      { li: 0, ls: 1689.19, cf: 0, te: 0.0192 },
      { li: 1689.19, ls: 14337.02, cf: 32.43, te: 0.064 },
      { li: 14337.02, ls: 25196.03, cf: 841.9, te: 0.1088 },
      { li: 25196.03, ls: 29289.28, cf: 2023.35, te: 0.16 },
      { li: 29289.28, ls: 35067.28, cf: 2678.27, te: 0.1792 },
      { li: 35067.28, ls: 70725.66, cf: 3713.69, te: 0.2136 },
      { li: 70725.66, ls: 111473.36, cf: 11330.32, te: 0.2352 },
      { li: 111473.36, ls: 212821, cf: 20914.18, te: 0.3 },
      { li: 212821, ls: 283761.33, cf: 51318.47, te: 0.32 },
      { li: 283761.33, ls: 851283.99, cf: 74019.37, te: 0.34 },
      { li: 851283.99, ls: null, cf: 266977.08, te: 0.35 }
    ],
    // Marzo
    [
      { li: 0, ls: 2533.78, cf: 0, te: 0.0192 },
      { li: 2533.78, ls: 21505.53, cf: 48.65, te: 0.064 },
      { li: 21505.53, ls: 37794.05, cf: 1262.84, te: 0.1088 },
      { li: 37794.05, ls: 43933.92, cf: 3035.03, te: 0.16 },
      { li: 43933.92, ls: 52600.92, cf: 4017.41, te: 0.1792 },
      { li: 52600.93, ls: 106088.49, cf: 5570.54, te: 0.2136 },
      { li: 106088.5, ls: 167210.04, cf: 16995.48, te: 0.2352 },
      { li: 167210.04, ls: 319231.5, cf: 31371.27, te: 0.3 },
      { li: 319231.5, ls: 425641.99, cf: 76977.7, te: 0.32 },
      { li: 425641.99, ls: 127692598e-2, cf: 111029.06, te: 0.34 },
      { li: 127692598e-2, ls: null, cf: 400465.62, te: 0.35 }
    ],
    // Abril
    [
      { li: 0, ls: 3378.37, cf: 0, te: 0.0192 },
      { li: 3378.37, ls: 28674.04, cf: 64.86, te: 0.064 },
      { li: 28674.04, ls: 50392.06, cf: 1683.79, te: 0.1088 },
      { li: 50392.07, ls: 58578.55, cf: 4046.71, te: 0.16 },
      { li: 58578.56, ls: 70134.56, cf: 5356.55, te: 0.1792 },
      { li: 70134.57, ls: 141451.32, cf: 7427.38, te: 0.2136 },
      { li: 141451.33, ls: 222946.71, cf: 22660.64, te: 0.2352 },
      { li: 222946.72, ls: 425641.99, cf: 41828.36, te: 0.3 },
      { li: 425642, ls: 567522.66, cf: 102636.94, te: 0.32 },
      { li: 567522.66, ls: 170256797e-2, cf: 148038.74, te: 0.34 },
      { li: 170256798e-2, ls: null, cf: 533954.15, te: 0.35 }
    ],
    // Mayo
    [
      { li: 0, ls: 4222.96, cf: 0, te: 0.0192 },
      { li: 4222.97, ls: 35842.55, cf: 81.08, te: 0.064 },
      { li: 35842.55, ls: 62990.08, cf: 2104.74, te: 0.1088 },
      { li: 62990.08, ls: 73223.19, cf: 5058.39, te: 0.16 },
      { li: 73223.2, ls: 87668.2, cf: 6695.68, te: 0.1792 },
      { li: 87668.21, ls: 176814.15, cf: 9284.23, te: 0.2136 },
      { li: 176814.16, ls: 278683.39, cf: 28325.8, te: 0.2352 },
      { li: 278683.4, ls: 532052.49, cf: 52285.45, te: 0.3 },
      { li: 532052.5, ls: 709403.32, cf: 128296.17, te: 0.32 },
      { li: 709403.33, ls: 212820997e-2, cf: 185048.43, te: 0.34 },
      { li: 212820997e-2, ls: null, cf: 667442.69, te: 0.35 }
    ],
    // Junio
    [
      { li: 0.01, ls: 5067.56, cf: 0, te: 0.0192 },
      { li: 5067.56, ls: 43011.06, cf: 97.3, te: 0.064 },
      { li: 43011.06, ls: 75588.1, cf: 2525.69, te: 0.1088 },
      { li: 75588.1, ls: 87867.83, cf: 6070.07, te: 0.16 },
      { li: 87867.84, ls: 105201.85, cf: 8034.82, te: 0.1792 },
      { li: 105201.85, ls: 212176.99, cf: 11141.07, te: 0.2136 },
      { li: 212176.99, ls: 334420.07, cf: 33990.96, te: 0.2352 },
      { li: 334420.08, ls: 638462.99, cf: 62742.54, te: 0.3 },
      { li: 638463, ls: 851283.99, cf: 153955.41, te: 0.32 },
      { li: 851283.99, ls: 255385196e-2, cf: 222058.12, te: 0.34 },
      { li: 255385197e-2, ls: null, cf: 800931.23, te: 0.35 }
    ],
    // Julio
    [
      { li: 0.01, ls: 5912.15, cf: 0, te: 0.0192 },
      { li: 5912.15, ls: 50179.56, cf: 113.51, te: 0.064 },
      { li: 50179.57, ls: 88186.11, cf: 2946.63, te: 0.1088 },
      { li: 88186.12, ls: 102512.47, cf: 7081.74, te: 0.16 },
      { li: 102512.47, ls: 122735.49, cf: 9373.96, te: 0.1792 },
      { li: 122735.49, ls: 247539.82, cf: 12997.91, te: 0.2136 },
      { li: 247539.82, ls: 390156.75, cf: 39656.12, te: 0.2352 },
      { li: 390156.75, ls: 744873.49, cf: 73199.62, te: 0.3 },
      { li: 744873.49, ls: 993164.65, cf: 179614.64, te: 0.32 },
      { li: 993164.65, ls: 297949395e-2, cf: 259067.8, te: 0.34 },
      { li: 297949396e-2, ls: null, cf: 934419.77, te: 0.35 }
    ],
    // Agosto
    [
      { li: 0.01, ls: 6756.74, cf: 0, te: 0.0192 },
      { li: 6756.75, ls: 57348.07, cf: 129.73, te: 0.064 },
      { li: 57348.08, ls: 100784.13, cf: 3367.58, te: 0.1088 },
      { li: 100784.13, ls: 117157.11, cf: 8093.42, te: 0.16 },
      { li: 117157.11, ls: 140269.13, cf: 10713.09, te: 0.1792 },
      { li: 140269.13, ls: 282902.65, cf: 14854.76, te: 0.2136 },
      { li: 282902.65, ls: 445893.43, cf: 45321.28, te: 0.2352 },
      { li: 445893.43, ls: 851283.99, cf: 83656.71, te: 0.3 },
      { li: 851283.99, ls: 113504531e-2, cf: 205273.87, te: 0.32 },
      { li: 113504532e-2, ls: 340513595e-2, cf: 296077.49, te: 0.34 },
      { li: 340513595e-2, ls: null, cf: 106790831e-2, te: 0.35 }
    ],
    // Septiembre
    [
      { li: 0.01, ls: 7601.33, cf: 0, te: 0.0192 },
      { li: 7601.34, ls: 64516.58, cf: 145.94, te: 0.064 },
      { li: 64516.59, ls: 113382.14, cf: 3788.53, te: 0.1088 },
      { li: 113382.15, ls: 131801.75, cf: 9105.1, te: 0.16 },
      { li: 131801.75, ls: 157802.77, cf: 12052.23, te: 0.1792 },
      { li: 157802.78, ls: 318265.48, cf: 16711.61, te: 0.2136 },
      { li: 318265.49, ls: 501630.11, cf: 50986.44, te: 0.2352 },
      { li: 501630.11, ls: 957694.49, cf: 94113.8, te: 0.3 },
      { li: 957694.49, ls: 127692598e-2, cf: 230933.11, te: 0.32 },
      { li: 127692599e-2, ls: 383077794e-2, cf: 333087.17, te: 0.34 },
      { li: 383077795e-2, ls: null, cf: 120139685e-2, te: 0.35 }
    ],
    // Octubre
    [
      { li: 0.01, ls: 8445.93, cf: 0, te: 0.0192 },
      { li: 8445.93, ls: 71685.09, cf: 162.16, te: 0.064 },
      { li: 71685.1, ls: 125980.16, cf: 4209.47, te: 0.1088 },
      { li: 125980.17, ls: 146446.38, cf: 10116.78, te: 0.16 },
      { li: 146446.39, ls: 175336.41, cf: 13391.37, te: 0.1792 },
      { li: 175336.42, ls: 353628.31, cf: 18568.45, te: 0.2136 },
      { li: 353628.32, ls: 557366.78, cf: 56651.6, te: 0.2352 },
      { li: 557366.79, ls: 106410498e-2, cf: 104570.89, te: 0.3 },
      { li: 106410499e-2, ls: 141880664e-2, cf: 256592.34, te: 0.32 },
      { li: 141880665e-2, ls: 425641993e-2, cf: 370096.86, te: 0.34 },
      { li: 425641994e-2, ls: null, cf: 133488538e-2, te: 0.35 }
    ],
    // Noviembre
    [
      { li: 0.01, ls: 9290.52, cf: 0, te: 0.0192 },
      { li: 9290.53, ls: 78853.6, cf: 178.37, te: 0.064 },
      { li: 78853.61, ls: 138578.17, cf: 4630.42, te: 0.1088 },
      { li: 138578.18, ls: 161091.02, cf: 11128.45, te: 0.16 },
      { li: 161091.03, ls: 192870.05, cf: 14730.5, te: 0.1792 },
      { li: 192870.06, ls: 388991.14, cf: 20425.3, te: 0.2136 },
      { li: 388991.15, ls: 613103.46, cf: 62316.76, te: 0.2352 },
      { li: 613103.47, ls: 117051548e-2, cf: 115027.98, te: 0.3 },
      { li: 117051549e-2, ls: 156068731e-2, cf: 282251.58, te: 0.32 },
      { li: 156068732e-2, ls: 468206193e-2, cf: 407106.54, te: 0.34 },
      { li: 468206194e-2, ls: null, cf: 146837392e-2, te: 0.35 }
    ],
    // Diciembre (anual 2026)
    [
      { li: 0.01, ls: 10135.11, cf: 0, te: 0.0192 },
      { li: 10135.12, ls: 86022.11, cf: 194.59, te: 0.064 },
      { li: 86022.12, ls: 151176.19, cf: 5051.37, te: 0.1088 },
      { li: 151176.2, ls: 175735.66, cf: 12140.13, te: 0.16 },
      { li: 175735.67, ls: 210403.69, cf: 16069.64, te: 0.1792 },
      { li: 210403.7, ls: 424353.97, cf: 22282.14, te: 0.2136 },
      { li: 424353.98, ls: 668840.14, cf: 67981.92, te: 0.2352 },
      { li: 668840.15, ls: 127692598e-2, cf: 125485.07, te: 0.3 },
      { li: 127692599e-2, ls: 170256797e-2, cf: 307910.81, te: 0.32 },
      { li: 170256798e-2, ls: 510770392e-2, cf: 444116.23, te: 0.34 },
      { li: 510770393e-2, ls: null, cf: 160186246e-2, te: 0.35 }
    ]
  ];
  insertarMeses(2026, tramos2026);
  const tasasFijas = [
    // RESICO PF: 2.5% sobre ingresos brutos
    { año: 2023, regimen: "resico_pf", tasa: 0.025 },
    { año: 2024, regimen: "resico_pf", tasa: 0.025 },
    { año: 2025, regimen: "resico_pf", tasa: 0.025 },
    { año: 2026, regimen: "resico_pf", tasa: 0.025 },
    // RESICO PM: 1% sobre ingresos brutos
    { año: 2023, regimen: "resico_pm", tasa: 0.01 },
    { año: 2024, regimen: "resico_pm", tasa: 0.01 },
    { año: 2025, regimen: "resico_pm", tasa: 0.01 },
    { año: 2026, regimen: "resico_pm", tasa: 0.01 },
    // PM Régimen general: 30% sobre utilidad fiscal
    { año: 2023, regimen: "pm_general", tasa: 0.3 },
    { año: 2024, regimen: "pm_general", tasa: 0.3 },
    { año: 2025, regimen: "pm_general", tasa: 0.3 },
    { año: 2026, regimen: "pm_general", tasa: 0.3 }
  ];
  for (const t of tasasFijas) {
    insertTasa.run(t);
  }
}
function migration012(db) {
  const perfiles = db.prepare("SELECT rfc FROM perfiles").all();
  const tablas = perfiles.map((p) => `facturas_${p.rfc.replace(/[^A-Z0-9]/gi, "")}`);
  tablas.push("facturas");
  const columnas = [
    "regimen_fiscal_emisor TEXT",
    "regimen_fiscal_receptor TEXT",
    "uso_cfdi TEXT"
  ];
  for (const tabla of tablas) {
    const existe = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).get(tabla);
    if (!existe) continue;
    for (const col of columnas) {
      const nombre = col.split(" ")[0];
      try {
        db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${col}`);
        console.log(`Columna ${nombre} agregada a ${tabla}`);
      } catch {
        console.log(`Columna ${nombre} ya existe en ${tabla}`);
      }
    }
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS cfdi_estado_pago (
      uuid                TEXT PRIMARY KEY,
      pagado              INTEGER NOT NULL DEFAULT 0,
      fecha_actualizacion TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
function migration013(db) {
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
  `);
}
function migration014(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS efos (
      rfc        TEXT PRIMARY KEY,
      nombre     TEXT,
      situacion  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS efos_meta (
      id               INTEGER PRIMARY KEY CHECK (id = 1),
      ultima_sync      TEXT,
      total_registros  INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO efos_meta (id, total_registros) VALUES (1, 0);
  `);
}
class MigrationRunner {
  constructor(db) {
    this.db = db;
  }
  run() {
    this.createMigrationsTable();
    this.executePending();
  }
  createMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre    TEXT UNIQUE NOT NULL,
        ejecutada TEXT DEFAULT (datetime('now'))
      )
    `);
  }
  executePending() {
    const migrations = [
      { nombre: "001_initial", fn: runMigration001 },
      { nombre: "002_tipo_descarga", fn: migration002 },
      { nombre: "003_descargas_pendientes", fn: migration003 },
      { nombre: "004_campos_cfdi", fn: migration004 },
      { nombre: "005_perfiles", fn: migration005 },
      { nombre: "006_catalogos", fn: migration006 },
      { nombre: "007_config_pdf", fn: migration007 },
      { nombre: "008_conciliaciones", fn: migration008 },
      { nombre: "009_pagos_complemento", fn: migration009 },
      { nombre: "010_nomina_complemento", fn: migration010 },
      { nombre: "011_isr_tarifas", fn: migration011 },
      { nombre: "012_nuevos_campos_cfdi", fn: migration012 },
      { nombre: "013_licencias", fn: migration013 },
      { nombre: "014_efos", fn: migration014 }
    ];
    for (const migration of migrations) {
      const yaEjecutada = this.db.prepare("SELECT id FROM migrations WHERE nombre = ?").get(migration.nombre);
      if (!yaEjecutada) {
        migration.fn(this.db);
        this.db.prepare("INSERT INTO migrations (nombre) VALUES (?)").run(migration.nombre);
        console.log(`Migración ejecutada: ${migration.nombre}`);
      }
    }
  }
}
const regimenFiscal = {
  "601": "General de Ley Personas Morales",
  "603": "Personas Morales con Fines no Lucrativos",
  "605": "Sueldos y Salarios e Ingresos Asimilados a Salarios",
  "606": "Arrendamiento",
  "607": "Régimen de Enajenación o Adquisición de Bienes",
  "608": "Demás ingresos",
  "610": "Residentes en el Extranjero sin Establecimiento Permanente en México",
  "611": "Ingresos por Dividendos (socios y accionistas)",
  "612": "Personas Físicas con Actividades Empresariales y Profesionales",
  "614": "Ingresos por intereses",
  "615": "Régimen de los ingresos por obtención de premios",
  "616": "Sin obligaciones fiscales",
  "620": "Sociedades Cooperativas de Producción que optan por diferir sus ingresos",
  "621": "Incorporación Fiscal",
  "622": "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras",
  "623": "Opcional para Grupos de Sociedades",
  "624": "Coordinados",
  "625": "Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas",
  "626": "Régimen Simplificado de Confianza"
};
const usoCFDI = {
  "G01": "Adquisición de mercancias",
  "G02": "Devoluciones, descuentos o bonificaciones",
  "G03": "Gastos en general",
  "I01": "Construcciones",
  "I02": "Mobilario y equipo de oficina por inversiones",
  "I03": "Equipo de transporte",
  "I04": "Equipo de computo y accesorios",
  "I05": "Dados, troqueles, moldes, matrices y herramental",
  "I06": "Comunicaciones telefónicas",
  "I07": "Comunicaciones satelitales",
  "I08": "Otra maquinaria y equipo",
  "D01": "Honorarios médicos, dentales y gastos hospitalarios",
  "D02": "Gastos médicos por incapacidad o discapacidad",
  "D03": "Gastos funerales",
  "D04": "Donativos",
  "D05": "Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)",
  "D06": "Aportaciones voluntarias al SAR",
  "D07": "Primas por seguros de gastos médicos",
  "D08": "Gastos de transportación escolar obligatoria",
  "D09": "Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones",
  "D10": "Pagos por servicios educativos (colegiaturas)",
  "P01": "Por definir",
  "S01": "Sin efectos fiscales",
  "CP01": "Pagos",
  "CN01": "Nómina"
};
const formaPago = {
  "01": "Efectivo",
  "02": "Cheque nominativo",
  "03": "Transferencia electrónica de fondos",
  "04": "Tarjeta de crédito",
  "05": "Monedero electrónico",
  "06": "Dinero electrónico",
  "08": "Vales de despensa",
  "12": "Dación en pago",
  "13": "Pago por subrogación",
  "14": "Pago por consignación",
  "15": "Condonación",
  "17": "Compensación",
  "23": "Novación",
  "24": "Confusión",
  "25": "Remisión de deuda",
  "26": "Prescripción o caducidad",
  "27": "A satisfacción del acreedor",
  "28": "Tarjeta de débito",
  "29": "Tarjeta de servicios",
  "30": "Aplicación de anticipos",
  "31": "Intermediario pagos",
  "99": "Por definir"
};
const metodoPago = {
  "PUE": "Pago en una sola exhibición",
  "PPD": "Pago en parcialidades o diferido"
};
const impuesto = {
  "001": "ISR",
  "002": "IVA",
  "003": "IEPS"
};
const tipoPercepcion = {
  "001": "Sueldos, Salarios Rayas y Jornales",
  "002": "Gratificación Anual (Aguinaldo)",
  "003": "Participación de los Trabajadores en las Utilidades PTU",
  "004": "Reembolso de Gastos Médicos Dentales y Hospitalarios",
  "005": "Fondo de Ahorro",
  "006": "Caja de ahorro",
  "009": "Contribuciones a Cargo del Trabajador Pagadas por el Patrón",
  "010": "Premios por Puntualidad",
  "011": "Prima de Seguro de vida",
  "012": "Seguro de Gastos Médicos Mayores",
  "013": "Cuotas Sindicales Pagadas por el Patrón",
  "014": "Subsidios por incapacidad",
  "015": "Becas para trabajadores y/o hijos",
  "019": "Horas extra",
  "020": "Prima dominical",
  "021": "Prima Vacacional",
  "022": "Prima por antigüedad",
  "023": "Pagos por separación",
  "024": "Seguro de retiro",
  "025": "Indemnizaciones",
  "026": "Reembolso por funeral",
  "027": "Cuotas de seguridad social pagadas por el patrón",
  "028": "Comisiones",
  "029": "Vales de despensa",
  "030": "Vales de restaurante",
  "031": "Vales de gasolina",
  "032": "Vales de ropa",
  "033": "Ayuda para renta",
  "034": "Ayuda para artículos escolares",
  "035": "Ayuda para anteojos",
  "036": "Ayuda para transporte",
  "037": "Ayuda para gastos de funeral",
  "038": "Otros ingresos por salarios",
  "039": "Jubilaciones, pensiones o haberes de retiro",
  "044": "Jubilaciones, pensiones o haberes de retiro en parcialidades",
  "045": "Ingresos en acciones o títulos valor que representan bienes",
  "046": "Ingresos asimilados a salarios",
  "047": "Alimentación diferentes a los establecidos en el Art 94 último párrafo LISR",
  "048": "Habitación",
  "049": "Premios por asistencia",
  "050": "Viáticos",
  "051": "Pagos por gratificaciones, primas, compensaciones, recompensas u otros a extrabajadores derivados de jubilación en parcialidades"
};
const tipoDeduccion = {
  "001": "Seguridad social",
  "002": "ISR",
  "003": "Aportaciones a retiro, cesantía en edad avanzada y vejez",
  "004": "Otros",
  "005": "Aportaciones a Fondo de vivienda",
  "006": "Descuento por incapacidad",
  "007": "Pensión alimenticia",
  "008": "Renta",
  "009": "Préstamos provenientes del Fondo Nacional de la Vivienda para los Trabajadores",
  "010": "Pago por crédito de vivienda",
  "011": "Pago de abonos INFONACOT",
  "012": "Anticipo de salarios",
  "013": "Pagos hechos con exceso al trabajador",
  "014": "Errores",
  "015": "Pérdidas",
  "016": "Averías",
  "017": "Adquisición de artículos producidos por la empresa o establecimiento",
  "018": "Cuotas para la constitución y fomento de sociedades cooperativas y de cajas de ahorro",
  "019": "Cuotas sindicales",
  "020": "Ausencias (Ausentismo)",
  "021": "Cuotas obrero patronales"
};
const cat = (catalogo, clave) => catalogo[clave] ? `${clave} - ${catalogo[clave]}` : clave;
class BrowserManager {
  static browser = null;
  static headless = process.env.NODE_ENV === "production";
  // ← un solo lugar para cambiar
  // Método para calcular la ruta del ejecutable según el entorno
  static getExecutablePath() {
    if (process.env.NODE_ENV !== "production") {
      return void 0;
    }
    return path$1.join(
      process.resourcesPath,
      "resources",
      "chromium-1208",
      "chrome-win64",
      "chrome.exe"
    );
  }
  static setHeadless(value) {
    this.headless = value;
  }
  static async getBrowser() {
    if (!this.browser) {
      const exePath = this.getExecutablePath();
      this.browser = await playwright.chromium.launch({
        headless: this.headless,
        executablePath: exePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-web-security",
          // Ayuda con el visor de PDF y frames
          "--allow-running-insecure-content",
          "--disable-features=IsolateOrigins,site-per-process"
          // Ayuda a capturar buffers en frames
        ]
      });
    }
    return this.browser;
  }
  static async newContext() {
    const browser = await this.getBrowser();
    return browser.newContext({
      // ESTO AYUDARÁ A QUE NO SEA TAN LENTO EL CARGADO DE JS
      storageState: void 0,
      javaScriptEnabled: true,
      acceptDownloads: true,
      viewport: { width: 1280, height: 720 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      locale: "es-MX",
      timezoneId: "America/Mexico_City"
    });
  }
  static async cerrar() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
class PdfService {
  async generarPdf(_xmlContenido, parseada, uuid, plantilla, rutaDestino) {
    const html = await this.construirHtml(parseada, uuid, plantilla);
    await this.htmlAPdf(html, rutaDestino);
  }
  async construirHtml(parseada, uuid, plantilla) {
    const templatePath = path.join(electron.app.getAppPath(), "src", "main", "templates", `${plantilla}.html`);
    let html = fs__namespace.readFileSync(templatePath, "utf-8");
    const fmt = (n) => (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
    html = this.reemplazar(html, "UUID", uuid);
    html = this.reemplazar(html, "NOMBRE_EMISOR", parseada.nombreEmisor);
    html = this.reemplazar(html, "RFC_EMISOR", parseada.rfcEmisor);
    html = this.reemplazar(html, "REGIMEN_FISCAL", cat(regimenFiscal, parseada.regimenFiscal));
    html = this.reemplazar(html, "LUGAR_EXPEDICION", parseada.lugarExpedicion);
    html = this.reemplazar(html, "FECHA", parseada.fecha?.replace("T", " "));
    html = this.reemplazar(html, "NO_CERTIFICADO", parseada.noCertificado || "");
    html = this.reemplazar(html, "EXPORTACION", parseada.exportacion === "01" ? "No aplica" : parseada.exportacion || "");
    html = this.reemplazar(html, "RFC_RECEPTOR", parseada.rfcReceptor);
    html = this.reemplazar(html, "NOMBRE_RECEPTOR", parseada.nombreReceptor);
    html = this.reemplazar(html, "CP_RECEPTOR", parseada.cpReceptor || "");
    html = this.reemplazar(html, "REGIMEN_FISCAL_RECEPTOR", cat(regimenFiscal, parseada.regimenFiscalReceptor || ""));
    html = this.reemplazar(html, "USO_CFDI", cat(usoCFDI, parseada.usoCFDI));
    html = this.reemplazar(html, "MONEDA", parseada.moneda);
    const tipoLabel = { I: "Ingreso", E: "Egreso", T: "Traslado", N: "Nómina", P: "Pago" };
    html = this.reemplazar(html, "TIPO_COMPROBANTE_LABEL", tipoLabel[parseada.tipoDeComprobante] || parseada.tipoDeComprobante);
    const serieFolio = [parseada.serie, parseada.folio].filter(Boolean).join("-");
    html = this.bloque(html, "SERIE_FOLIO", !!serieFolio, serieFolio);
    html = this.bloque(html, "FORMA_PAGO", !!parseada.formaPago, cat(formaPago, parseada.formaPago || ""));
    html = this.bloque(html, "METODO_PAGO", !!parseada.metodoPago, cat(metodoPago, parseada.metodoPago || ""));
    const conceptosRows = parseada.conceptos.map((c) => {
      const impuestosHtml = c.impuestos && c.impuestos.length > 0 ? `<tr class="impuesto-concepto">
                    <td colspan="2"></td>
                    <td colspan="6" style="padding: 2px 6px; font-size: 9px; color: #666;">
          ${c.impuestos.map((imp) => `${imp.tipo === "traslado" ? "Traslado" : "Retención"} 
                    ${cat(impuesto, imp.impuesto)} 
                    ${(imp.tasa * 100).toFixed(0)}% = 
                    ${fmt(imp.importe)}`).join(" | ")}
                    </td> </tr>` : "";
      return `
            <tr>
            <td>${c.claveProdServ}</td>
            <td>${c.noIdentificacion || "-"}</td>
            <td>${c.descripcion}</td>
            <td class="text-right">${c.cantidad}</td>
            <td>${c.claveUnidad}</td>
            <td class="text-right">${fmt(c.valorUnitario)}</td>
            <td class="text-right">${fmt(c.importe)}</td>
            <td>${c.objetoImp === "02" ? "Sí objeto" : c.objetoImp === "01" ? "No objeto" : c.objetoImp || ""}</td>
            </tr>
            ${impuestosHtml}`;
    }).join("");
    html = this.reemplazar(html, "CONCEPTOS_ROWS", conceptosRows);
    html = this.reemplazar(html, "SUBTOTAL", fmt(parseada.subtotal));
    html = this.reemplazar(html, "TOTAL", fmt(parseada.total));
    html = this.bloque(html, "DESCUENTO", !!parseada.descuento, fmt(parseada.descuento || 0));
    html = this.bloque(html, "IVA", !!parseada.totalImpuestosTrasladados, fmt(parseada.totalImpuestosTrasladados || 0));
    html = this.bloque(html, "RETENCION", !!parseada.totalImpuestosRetenidos, fmt(parseada.totalImpuestosRetenidos || 0));
    const esNomina = !!parseada.complementoNomina;
    html = this.bloqueContenido(html, "ES_NOMINA", esNomina);
    if (esNomina && parseada.complementoNomina) {
      const n = parseada.complementoNomina;
      html = this.reemplazar(html, "TIPO_NOMINA", n.tipoNomina === "O" ? "Ordinaria" : "Extraordinaria");
      html = this.reemplazar(html, "FECHA_PAGO_NOMINA", n.fechaPago);
      html = this.reemplazar(html, "PERIODO_NOMINA", `${n.fechaInicialPago} - ${n.fechaFinalPago}`);
      html = this.reemplazar(html, "DIAS_PAGADOS", String(n.numDiasPagados));
      html = this.reemplazar(html, "TOTAL_PERCEPCIONES", fmt(n.totalPercepciones));
      html = this.reemplazar(html, "TOTAL_DEDUCCIONES", fmt(n.totalDeducciones));
      const percRows = n.percepciones.map((p) => `
        <tr>
          <td>${p.clave}</td>
          <td>${cat(tipoPercepcion, p.clave)}</td>
          <td class="text-right">${fmt(p.importeGravado)}</td>
          <td class="text-right">${fmt(p.importeExento)}</td>
        </tr>`).join("");
      html = this.reemplazar(html, "PERCEPCIONES_ROWS", percRows);
      const dedRows = n.deducciones.map((d) => `
        <tr>
          <td>${d.clave}</td>
          <td>${cat(tipoDeduccion, d.clave)}</td>
          <td class="text-right">${fmt(d.importe)}</td>
        </tr>`).join("");
      html = this.reemplazar(html, "DEDUCCIONES_ROWS", dedRows);
    }
    const esPago = !!parseada.complementoPago;
    html = this.bloqueContenido(html, "ES_PAGO", esPago);
    if (esPago && parseada.complementoPago) {
      const pagosHtml = parseada.complementoPago.pagos.map((p) => `
        <div style="margin-bottom:8px;padding:8px;border:1px solid #ddd;">
          <div><strong>Fecha:</strong> ${p.fechaPago} &nbsp;
               <strong>Forma:</strong> ${cat(formaPago, p.formaDePago)} &nbsp;
               <strong>Monto:</strong> ${fmt(p.monto)}</div>
          <table style="margin-top:6px">
            <thead><tr><th>UUID Relacionado</th><th class="text-right">Saldo Anterior</th><th class="text-right">Importe Pagado</th></tr></thead>
            <tbody>${p.doctoRelacionados.map((d) => `
              <tr>
                <td style="font-size:8px">${d.uuid}</td>
                <td class="text-right">${fmt(d.impSaldoAnt)}</td>
                <td class="text-right">${fmt(d.impPagado)}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>`).join("");
      html = this.reemplazar(html, "PAGOS_ROWS", pagosHtml);
    }
    const t = parseada.timbre;
    html = this.reemplazar(html, "FECHA_TIMBRADO", t?.fechaTimbrado || "");
    html = this.reemplazar(html, "RFC_PAC", t?.rfcProvCertif || "");
    html = this.reemplazar(html, "NO_CERT_SAT", t?.noCertificadoSAT || "");
    html = this.reemplazar(html, "SELLO_CFD", t?.selloCFD || "");
    html = this.reemplazar(html, "SELLO_SAT", t?.selloSAT || "");
    const qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${parseada.rfcEmisor}&rr=${parseada.rfcReceptor}&tt=${parseada.total}&fe=${(t?.selloCFD || "").slice(-8)}`;
    const qrDataUrl = await this.generarQrDataUrl(qrUrl);
    html = this.reemplazar(html, "QR_DATA_URL", qrDataUrl);
    return html;
  }
  async htmlAPdf(html, rutaDestino) {
    const context = await BrowserManager.newContext();
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({
      path: rutaDestino,
      format: "Letter",
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      printBackground: true
    });
    await context.close();
  }
  reemplazar(html, clave, valor) {
    return html.replace(new RegExp(`{{${clave}}}`, "g"), valor || "");
  }
  bloque(html, clave, mostrar, valor) {
    if (mostrar) {
      html = html.replace(new RegExp(`{{#${clave}}}`, "g"), "");
      html = html.replace(new RegExp(`{{/${clave}}}`, "g"), "");
      html = this.reemplazar(html, clave, valor);
    } else {
      html = html.replace(new RegExp(`{{#${clave}}}[\\s\\S]*?{{/${clave}}}`, "g"), "");
    }
    return html;
  }
  bloqueContenido(html, clave, mostrar) {
    if (mostrar) {
      html = html.replace(new RegExp(`{{#${clave}}}`, "g"), "");
      html = html.replace(new RegExp(`{{/${clave}}}`, "g"), "");
    } else {
      html = html.replace(new RegExp(`{{#${clave}}}[\\s\\S]*?{{/${clave}}}`, "g"), "");
    }
    return html;
  }
  /* QR simple en SVG (sin dependencias externas)
  private generarQrSvg(url: string): string {
      // Usamos una URL de API pública para generar el QR como data URL
      return `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(url)}`
  }*/
  async generarQrDataUrl(url) {
    const QRCode = require("qrcode");
    return await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: "H",
      rendererOpts: {
        quality: 1
        // Asegura la máxima calidad en la generación
      }
    });
  }
}
class ProfileManager {
  constructor(db) {
    this.db = db;
  }
  static perfilActivo = null;
  obtenerTodos() {
    return this.db.prepare("SELECT * FROM perfiles ORDER BY nombre ASC").all();
  }
  obtenerPorRfc(rfc) {
    return this.db.prepare("SELECT * FROM perfiles WHERE rfc = ?").get(rfc);
  }
  insertar(perfil) {
    this.db.prepare(`
      INSERT OR REPLACE INTO perfiles
        (rfc, nombre, metodo_auth, contrasena, ruta_cer, ruta_key, contrasena_fiel, carpeta_descarga)
      VALUES
        (@rfc, @nombre, @metodo_auth, @contrasena, @ruta_cer, @ruta_key, @contrasena_fiel, @carpeta_descarga)
    `).run({
      contrasena: null,
      ruta_cer: null,
      ruta_key: null,
      contrasena_fiel: null,
      carpeta_descarga: null,
      ...perfil
    });
    this.crearTablasPerfil(perfil.rfc);
  }
  eliminar(rfc) {
    this.db.prepare("DELETE FROM perfiles WHERE rfc = ?").run(rfc);
  }
  static getPerfilActivo() {
    return this.perfilActivo;
  }
  static setPerfilActivo(perfil) {
    this.perfilActivo = perfil;
  }
  static limpiarPerfil() {
    this.perfilActivo = null;
  }
  static getTablaFacturas(rfc) {
    const r = rfc || this.perfilActivo?.rfc;
    if (!r) throw new Error("No hay perfil activo");
    return `facturas_${r.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }
  static getTablaPendientes(rfc) {
    const r = rfc || this.perfilActivo?.rfc;
    if (!r) throw new Error("No hay perfil activo");
    return `descargas_pendientes_${r.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }
  static getTablaConciliaciones(rfc) {
    const r = rfc || this.perfilActivo?.rfc;
    if (!r) throw new Error("No hay perfil activo");
    return `conciliaciones_${r.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }
  static getTablaPagosComplemento(rfc) {
    const r = rfc || this.perfilActivo?.rfc;
    if (!r) throw new Error("No hay perfil activo");
    return `pagos_complemento_${r.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }
  static getTablaNominaComplemento(rfc) {
    const r = rfc || this.perfilActivo?.rfc;
    if (!r) throw new Error("No hay perfil activo");
    return `nomina_complemento_${r.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }
  static getRfcActivo() {
    return ProfileManager.perfilActivo?.rfc || "";
  }
  crearTablasPerfil(rfc) {
    const r = rfc.replace(/[^A-Z0-9]/gi, "");
    this.db.prepare(`CREATE TABLE IF NOT EXISTS facturas_${r} (
      uuid TEXT PRIMARY KEY,
      version TEXT, serie TEXT, folio TEXT,
      fecha_emision TEXT, fecha_timbrado TEXT,
      rfc_emisor TEXT, nombre_emisor TEXT,
      rfc_receptor TEXT, nombre_receptor TEXT,
      subtotal REAL, descuento REAL,
      total_impuestos_trasladados REAL,
      total_impuestos_retenidos REAL,
      total REAL, tipo_comprobante TEXT,
      forma_pago TEXT, metodo_pago TEXT,
      moneda TEXT, tipo_cambio REAL,
      estado TEXT, estado_cancelacion TEXT,
      estado_proceso_cancelacion TEXT,
      fecha_cancelacion TEXT, rfc_pac TEXT,
      folio_sustitucion TEXT, xml TEXT,
      tipo_descarga TEXT, fecha_descarga TEXT
    )`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS descargas_pendientes_${r} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE, rfc_emisor TEXT, nombre_emisor TEXT,
      rfc_receptor TEXT, nombre_receptor TEXT,
      fecha_emision TEXT, total REAL,
      tipo_comprobante TEXT, estado TEXT,
      url_descarga TEXT, tipo_descarga TEXT,
      error TEXT, intentos INTEGER, fecha_fallo TEXT
    )`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS clientes_${r} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc TEXT UNIQUE NOT NULL, nombre TEXT,
      telefono TEXT, email TEXT, direccion TEXT,
      contacto TEXT, notas TEXT,
      limite_credito REAL, dias_credito INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS proveedores_${r} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc TEXT UNIQUE NOT NULL, nombre TEXT,
      telefono TEXT, email TEXT, direccion TEXT,
      contacto TEXT, notas TEXT,
      limite_credito REAL, dias_credito INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS empleados_${r} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc TEXT UNIQUE NOT NULL, nombre TEXT,
      telefono TEXT, email TEXT, direccion TEXT,
      notas TEXT, puesto TEXT, fecha_ingreso DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS patrones_${r} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc TEXT UNIQUE NOT NULL, nombre TEXT,
      telefono TEXT, email TEXT, direccion TEXT,
      contacto TEXT, notas TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS conciliaciones_${r} (
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
    )`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS pagos_complemento_${r} (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid_rep      TEXT NOT NULL,
      fecha_pago    TEXT,
      forma_pago_p  TEXT,
      moneda_p      TEXT,
      tipo_cambio_p REAL,
      monto         REAL,
      documentos    TEXT,
      FOREIGN KEY (uuid_rep) REFERENCES facturas_${r}(uuid)
    )`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS nomina_complemento_${r} (
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
    )`).run();
  }
}
class PagoComplementoRepository {
  constructor(db) {
    this.db = db;
  }
  get tabla() {
    return ProfileManager.getTablaPagosComplemento();
  }
  insertar(pago) {
    this.db.prepare(`
      INSERT OR IGNORE INTO ${this.tabla}
        (uuid_rep, fecha_pago, forma_pago_p, moneda_p, tipo_cambio_p, monto, documentos)
      VALUES
        (@uuid_rep, @fecha_pago, @forma_pago_p, @moneda_p, @tipo_cambio_p, @monto, @documentos)
    `).run({
      fecha_pago: null,
      forma_pago_p: null,
      moneda_p: null,
      tipo_cambio_p: null,
      monto: null,
      documentos: null,
      ...pago
    });
  }
  obtenerPorUuidRep(uuid_rep) {
    return this.db.prepare(`SELECT * FROM ${this.tabla} WHERE uuid_rep = ?`).get(uuid_rep);
  }
  obtenerTodos() {
    return this.db.prepare(`SELECT * FROM ${this.tabla} ORDER BY fecha_pago DESC`).all();
  }
  eliminar(uuid_rep) {
    this.db.prepare(`DELETE FROM ${this.tabla} WHERE uuid_rep = ?`).run(uuid_rep);
  }
}
function manejarErrorSat(error) {
  const mensaje = String(error);
  if (mensaje.includes("SAT_SATURADO")) {
    return "El SAT se encuentra saturado en este momento. Intenta de nuevo en 20 minutos.";
  }
  if (mensaje.includes("CAPTCHA_INVALIDO")) {
    return "El captcha es incorrecto. Recarga el captcha e intenta de nuevo.";
  }
  if (mensaje.includes("SAT_TIMEOUT")) {
    return "El servicio del SAT parece inestable en este momento. Intenta de nuevo en 5 minutos.";
  }
  return mensaje;
}
class LicenseService {
  repository;
  constructor(repository) {
    this.repository = repository;
  }
  /**
   * Obtiene información completa de la licencia
   */
  obtenerLicencia() {
    const licencia = this.repository.obtenerLicencia();
    if (!licencia) {
      return {
        estado: "Demo",
        dias_restantes: null,
        rfc_disponible: true,
        maquina_disponible: true,
        vigente: true
      };
    }
    const diasRestantes = this.calcularDiasRestantes(licencia.fecha_vencimiento);
    return {
      estado: licencia.estado,
      fecha_inicio: licencia.fecha_inicio,
      fecha_vencimiento: licencia.fecha_vencimiento,
      dias_restantes: diasRestantes,
      rfc_maximo: licencia.rfc_maximo,
      rfc_usado: licencia.rfc_usado,
      maquinas_maximo: licencia.maquinas_maximo,
      maquinas_usado: licencia.maquinas_usado,
      rfc_disponible: this.repository.validarRfcDisponible(),
      maquina_disponible: this.repository.validarMaquinaDisponible(),
      vigente: this.repository.validarVigencia()
    };
  }
  /**
   * Obtiene solo el estado actual
   */
  obtenerEstado() {
    const licencia = this.repository.obtenerLicencia();
    if (!licencia) return "Demo";
    return licencia.estado;
  }
  /**
   * Calcula días restantes
   */
  calcularDiasRestantes(fechaVencimiento) {
    if (!fechaVencimiento) return null;
    const hoy = /* @__PURE__ */ new Date();
    const vencimiento = new Date(fechaVencimiento);
    const diferencia = vencimiento.getTime() - hoy.getTime();
    const dias = Math.ceil(diferencia / (1e3 * 60 * 60 * 24));
    return dias > 0 ? dias : 0;
  }
  /**
   * Valida si puede agregar un nuevo RFC
   */
  validarAgregarRfc() {
    if (!this.repository.validarVigencia()) {
      return { valido: false, motivo: "Licencia vencida" };
    }
    if (!this.repository.validarRfcDisponible()) {
      return { valido: false, motivo: "Límite de RFCs alcanzado" };
    }
    return { valido: true };
  }
  /**
   * Valida si puede registrar una nueva máquina
   */
  validarRegistrarMaquina() {
    if (!this.repository.validarVigencia()) {
      return { valido: false, motivo: "Licencia vencida" };
    }
    if (!this.repository.validarMaquinaDisponible()) {
      return { valido: false, motivo: "Límite de máquinas alcanzado" };
    }
    return { valido: true };
  }
  /**
   * Valida si puede descargar CFDIs
   */
  validarDescargaCfdi() {
    const licencia = this.repository.obtenerLicencia();
    if (!licencia) {
      return { valido: false, motivo: "No hay licencia" };
    }
    if (licencia.estado === "Vencido") {
      return { valido: false, motivo: "Licencia vencida - Debe renovar" };
    }
    if (licencia.estado === "Demo") {
      if (!this.repository.validarDescargasCfdiDisponibles()) {
        return {
          valido: false,
          motivo: "Ha alcanzado el límite de 3 descargas en la versión Demo",
          usos_restantes: 0
        };
      }
      const restantes = licencia.descargas_cfdi_maximo - licencia.descargas_cfdi_usado;
      return { valido: true, usos_restantes: restantes - 1 };
    }
    return { valido: true };
  }
  /**
   * Valida si puede importar CFDIs
   */
  validarImportacionCfdi() {
    const licencia = this.repository.obtenerLicencia();
    if (!licencia) {
      return { valido: false, motivo: "No hay licencia" };
    }
    if (licencia.estado === "Vencido") {
      return { valido: false, motivo: "Licencia vencida - Debe renovar" };
    }
    if (licencia.estado === "Demo") {
      if (!this.repository.validarImportacionesCfdiDisponibles()) {
        return {
          valido: false,
          motivo: "Ha alcanzado el límite de 3 importaciones en la versión Demo",
          usos_restantes: 0
        };
      }
      const restantes = licencia.importaciones_cfdi_maximo - licencia.importaciones_cfdi_usado;
      return { valido: true, usos_restantes: restantes - 1 };
    }
    return { valido: true };
  }
  /**
   * Valida si puede hacer consolidaciones (conciliaciones)
   */
  validarConsolidacion() {
    const licencia = this.repository.obtenerLicencia();
    if (!licencia) {
      return { valido: false, motivo: "No hay licencia" };
    }
    if (licencia.estado === "Vencido") {
      return { valido: false, motivo: "Licencia vencida - Debe renovar" };
    }
    if (licencia.estado === "Demo") {
      if (!this.repository.validarConsolidacionesDisponibles()) {
        return {
          valido: false,
          motivo: "Ha alcanzado el límite de 1 consolidación en la versión Demo",
          usos_restantes: 0
        };
      }
      const restantes = licencia.consolidaciones_maximo - licencia.consolidaciones_usado;
      return { valido: true, usos_restantes: restantes - 1 };
    }
    return { valido: true };
  }
}
class LicenseRepository {
  constructor(db) {
    this.db = db;
  }
  /**
   * Obtiene la licencia actual (siempre es la ID 1)
   */
  obtenerLicencia() {
    const stmt = this.db.prepare("SELECT * FROM licencias WHERE id = 1");
    return stmt.get() || null;
  }
  /**
   * Actualiza el estado de la licencia
   */
  actualizarEstado(estado) {
    const stmt = this.db.prepare(`
      UPDATE licencias 
      SET estado = ?, fecha_actualizacion = datetime('now')
      WHERE id = 1
    `);
    stmt.run(estado);
    this.registrarAuditoria("ACTUALIZAR_ESTADO", `Estado: ${estado}`);
  }
  /**
   * Actualiza los límites de la licencia
   */
  actualizarLimites(rfcMaximo, maquinasMaximo, fechaInicio, fechaVencimiento) {
    const stmt = this.db.prepare(`
      UPDATE licencias 
      SET 
        rfc_maximo = ?,
        maquinas_maximo = ?,
        fecha_inicio = COALESCE(?, fecha_inicio),
        fecha_vencimiento = COALESCE(?, fecha_vencimiento),
        fecha_actualizacion = datetime('now')
      WHERE id = 1
    `);
    stmt.run(rfcMaximo, maquinasMaximo, fechaInicio, fechaVencimiento);
    this.registrarAuditoria(
      "ACTUALIZAR_LIMITES",
      `RFC máximo: ${rfcMaximo}, Máquinas máximo: ${maquinasMaximo}`
    );
  }
  /**
   * Incrementa el contador de RFCs usados
   */
  incrementarRfcUsado() {
    const stmt = this.db.prepare(`
      UPDATE licencias 
      SET rfc_usado = rfc_usado + 1, fecha_actualizacion = datetime('now')
      WHERE id = 1
    `);
    stmt.run();
  }
  /**
   * Decrementa el contador de RFCs usados
   */
  decrementarRfcUsado() {
    const stmt = this.db.prepare(`
      UPDATE licencias 
      SET rfc_usado = MAX(0, rfc_usado - 1), fecha_actualizacion = datetime('now')
      WHERE id = 1
    `);
    stmt.run();
  }
  /**
   * Registra una nueva máquina
   */
  registrarMaquina(identificador, nombre, so) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO maquinas_registradas (identificador_maquina, nombre_maquina, so)
        VALUES (?, ?, ?)
      `);
      stmt.run(identificador, nombre, so);
      const updateStmt = this.db.prepare(`
        UPDATE licencias 
        SET maquinas_usado = maquinas_usado + 1, fecha_actualizacion = datetime('now')
        WHERE id = 1
      `);
      updateStmt.run();
      this.registrarAuditoria("REGISTRAR_MAQUINA", `${nombre} (${so})`);
    } catch (error) {
      if (error.message.includes("UNIQUE constraint failed")) {
        this.actualizarUltimoAcceso(identificador);
      }
    }
  }
  /**
   * Obtiene todas las máquinas registradas
   */
  obtenerMaquinas() {
    const stmt = this.db.prepare(`
      SELECT * FROM maquinas_registradas WHERE activa = 1
      ORDER BY fecha_registro DESC
    `);
    return stmt.all();
  }
  /**
   * Actualiza el último acceso de una máquina
   */
  actualizarUltimoAcceso(identificador) {
    const stmt = this.db.prepare(`
      UPDATE maquinas_registradas 
      SET fecha_ultimo_acceso = datetime('now')
      WHERE identificador_maquina = ?
    `);
    stmt.run(identificador);
  }
  /**
   * Desactiva una máquina
   */
  desactivarMaquina(identificador) {
    const stmt = this.db.prepare(`
      UPDATE maquinas_registradas 
      SET activa = 0
      WHERE identificador_maquina = ?
    `);
    stmt.run(identificador);
    const updateStmt = this.db.prepare(`
      UPDATE licencias 
      SET maquinas_usado = MAX(0, maquinas_usado - 1), fecha_actualizacion = datetime('now')
      WHERE id = 1
    `);
    updateStmt.run();
    this.registrarAuditoria("DESACTIVAR_MAQUINA", `Identificador: ${identificador}`);
  }
  /**
  * Valida si puede agregar un nuevo RFC
  */
  validarRfcDisponible() {
    const licencia = this.obtenerLicencia();
    if (!licencia) return false;
    return licencia.rfc_usado < licencia.rfc_maximo;
  }
  /**
   * Valida si puede registrar una nueva máquina
   */
  validarMaquinaDisponible() {
    const licencia = this.obtenerLicencia();
    if (!licencia) return false;
    return licencia.maquinas_usado < licencia.maquinas_maximo;
  }
  /**
   * Valida si hay descargas CFDI disponibles
   */
  validarDescargasCfdiDisponibles() {
    const licencia = this.obtenerLicencia();
    if (!licencia) return false;
    if (licencia.estado === "Vigente" || licencia.estado === "Vencido") return licencia.estado === "Vigente";
    return licencia.descargas_cfdi_usado < licencia.descargas_cfdi_maximo;
  }
  /**
   * Incrementa contador de descargas CFDI
   */
  incrementarDescargasCfdi() {
    const stmt = this.db.prepare(`
      UPDATE licencias 
      SET descargas_cfdi_usado = descargas_cfdi_usado + 1, fecha_actualizacion = datetime('now')
      WHERE id = 1
    `);
    stmt.run();
    this.registrarAuditoria("DESCARGA_CFDI", "Descarga realizada");
  }
  /**
   * Valida si hay importaciones CFDI disponibles
   */
  validarImportacionesCfdiDisponibles() {
    const licencia = this.obtenerLicencia();
    if (!licencia) return false;
    if (licencia.estado === "Vigente" || licencia.estado === "Vencido") return licencia.estado === "Vigente";
    return licencia.importaciones_cfdi_usado < licencia.importaciones_cfdi_maximo;
  }
  /**
   * Incrementa contador de importaciones CFDI
   */
  incrementarImportacionesCfdi() {
    const stmt = this.db.prepare(`
      UPDATE licencias 
      SET importaciones_cfdi_usado = importaciones_cfdi_usado + 1, fecha_actualizacion = datetime('now')
      WHERE id = 1
    `);
    stmt.run();
    this.registrarAuditoria("IMPORTACION_CFDI", "Importación realizada");
  }
  /**
   * Valida si hay consolidaciones (conciliaciones) disponibles
   */
  validarConsolidacionesDisponibles() {
    const licencia = this.obtenerLicencia();
    if (!licencia) return false;
    if (licencia.estado === "Vigente" || licencia.estado === "Vencido") return licencia.estado === "Vigente";
    return licencia.consolidaciones_usado < licencia.consolidaciones_maximo;
  }
  /**
   * Incrementa contador de consolidaciones
   */
  incrementarConsolidaciones() {
    const stmt = this.db.prepare(`
      UPDATE licencias 
      SET consolidaciones_usado = consolidaciones_usado + 1, fecha_actualizacion = datetime('now')
      WHERE id = 1
    `);
    stmt.run();
    this.registrarAuditoria("CONSOLIDACION", "Consolidación realizada");
  }
  /**
   * Obtiene información de usos disponibles
   */
  obtenerUsosDemoBloqueados() {
    const licencia = this.obtenerLicencia();
    if (!licencia || licencia.estado !== "Demo") return null;
    return {
      descargas_disponibles: Math.max(0, licencia.descargas_cfdi_maximo - licencia.descargas_cfdi_usado),
      importaciones_disponibles: Math.max(0, licencia.importaciones_cfdi_maximo - licencia.importaciones_cfdi_usado),
      consolidaciones_disponibles: Math.max(0, licencia.consolidaciones_maximo - licencia.consolidaciones_usado),
      descargas_bloqueadas: licencia.descargas_cfdi_usado >= licencia.descargas_cfdi_maximo,
      importaciones_bloqueadas: licencia.importaciones_cfdi_usado >= licencia.importaciones_cfdi_maximo,
      consolidaciones_bloqueadas: licencia.consolidaciones_usado >= licencia.consolidaciones_maximo
    };
  }
  /**
   * Valida si la licencia está vigente
   */
  validarVigencia() {
    const licencia = this.obtenerLicencia();
    if (!licencia) return false;
    if (licencia.estado === "Demo") return true;
    if (licencia.estado === "Vencido") return false;
    if (licencia.fecha_vencimiento) {
      return new Date(licencia.fecha_vencimiento) > /* @__PURE__ */ new Date();
    }
    return true;
  }
  /**
   * Registra un evento en auditoría
   */
  registrarAuditoria(evento, descripcion) {
    const stmt = this.db.prepare(`
      INSERT INTO licencia_auditoria (evento, descripcion)
      VALUES (?, ?)
    `);
    stmt.run(evento, descripcion);
  }
  /**
   * Obtiene el historial de auditoría
   */
  obtenerAuditoria(limite = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM licencia_auditoria
      ORDER BY fecha_evento DESC
      LIMIT ?
    `);
    return stmt.all(limite);
  }
}
class FacturaHandler {
  constructor(descargaService, pendientesService, configuracionService, authService, db) {
    this.descargaService = descargaService;
    this.pendientesService = pendientesService;
    this.configuracionService = configuracionService;
    this.authService = authService;
    this.pagoComplementoRepository = new PagoComplementoRepository(db);
    const licenseRepository = new LicenseRepository(db);
    this.licenseService = new LicenseService(licenseRepository);
  }
  pagoComplementoRepository;
  licenseService;
  registrar() {
    electron.ipcMain.handle("obtener-captcha", async () => {
      try {
        const imagenBase64 = await this.authService.obtenerCaptcha();
        return { success: true, imagenBase64: imagenBase64.imagenBase64 };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("descargar-facturas", async (event, datos) => {
      try {
        const validacion = this.licenseService.validarDescargaCfdi();
        if (!validacion.valido) {
          return { success: false, error: validacion.motivo };
        }
        const config = this.configuracionService.obtener();
        if (!config) return { success: false, error: "No hay configuración guardada" };
        const resultado = await this.descargaService.descargar(
          config,
          datos.params,
          datos.captcha,
          (progreso) => event.sender.send("progreso-descarga", progreso)
        );
        if (resultado.total > 0 && (!resultado.errores || resultado.errores.length === 0)) {
          const licenseRepo = new LicenseRepository(this.licenseService.repository.db);
          licenseRepo.incrementarDescargasCfdi();
        }
        return { success: true, total: resultado.total, errores: resultado.errores };
      } catch (error) {
        return { success: false, error: manejarErrorSat(error) };
      } finally {
        await this.authService.cerrarSesion();
      }
    });
    electron.ipcMain.handle("reintentar-pendientes", async (event, datos) => {
      try {
        const validacion = this.licenseService.validarDescargaCfdi();
        if (!validacion.valido) {
          return { success: false, error: validacion.motivo };
        }
        const config = this.configuracionService.obtener();
        if (!config) return { success: false, error: "No hay configuración guardada" };
        const resultado = await this.pendientesService.reintentar(
          config,
          datos.captcha,
          (progreso) => event.sender.send("progreso-descarga", progreso)
        );
        if (resultado.total > 0 && (!resultado.errores || resultado.errores.length === 0)) {
          const licenseRepo = new LicenseRepository(this.licenseService.repository.db);
          licenseRepo.incrementarDescargasCfdi();
        }
        return { success: true, total: resultado.total, errores: resultado.errores };
      } catch (error) {
        return { success: false, error: manejarErrorSat(error) };
      } finally {
        await this.authService.cerrarSesion();
      }
    });
    electron.ipcMain.handle("obtener-facturas", async () => {
      try {
        return { success: true, facturas: this.descargaService.obtenerFacturas() };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("obtener-facturas-por-tipo", async (_, datos) => {
      try {
        const facturas = this.descargaService.obtenerFacturasPorTipo(
          datos.tipoDescarga,
          datos.filtros ?? {}
        );
        return { success: true, facturas };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("obtener-pago-complemento", async (_, uuid_rep) => {
      try {
        const pago = this.pagoComplementoRepository.obtenerPorUuidRep(uuid_rep);
        if (!pago) return { success: true, pago: null };
        return {
          success: true,
          pago: {
            ...pago,
            documentos: pago.documentos ? JSON.parse(pago.documentos) : []
          }
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("eliminar-factura", async (_, uuid) => {
      try {
        this.descargaService.eliminarFactura(uuid);
        this.pagoComplementoRepository.eliminar(uuid);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("abrir-archivo", async (_, ruta) => {
      const { shell } = require("electron");
      const { platform } = require("os");
      if (platform() === "win32") {
        await shell.openExternal(`file:///${ruta.replace(/\\/g, "/")}`);
      } else {
        await shell.openExternal(`file://${ruta}`);
      }
    });
    electron.ipcMain.handle("leer-xml", async (_, ruta) => {
      try {
        const fs2 = require("fs");
        return { success: true, contenido: fs2.readFileSync(ruta, "utf-8") };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("generar-pdf", async (_, datos) => {
      try {
        const pdfService = new PdfService();
        await pdfService.generarPdf(datos.xmlContenido, datos.parseada, datos.uuid, datos.plantilla, datos.rutaDestino);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("obtener-pendientes", async () => {
      try {
        return { success: true, pendientes: this.descargaService.obtenerPendientes() };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("contar-pendientes", async () => {
      try {
        return { success: true, total: this.descargaService.contarPendientes() };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("limpiar-pendientes", async () => {
      try {
        this.descargaService.limpiarPendientes();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("facturas-drill-down", async (_, rfc) => {
      try {
        return { success: true, data: this.descargaService.obtenerDrillDown(rfc) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("obtener-pdf-factura", async (_, datos) => {
      try {
        const fs2 = require("fs");
        const rutaPdf = datos.rutaXml.replace(/\.xml$/i, ".pdf");
        if (!fs2.existsSync(rutaPdf)) {
          const xmlContenido = fs2.readFileSync(datos.rutaXml, "utf-8");
          const pdfService = new PdfService();
          const plantilla = this.configuracionService.obtener()?.plantillaDefault ?? "clasica";
          await pdfService.generarPdf(xmlContenido, datos.parseada, datos.uuid, plantilla, rutaPdf);
        }
        const base64 = fs2.readFileSync(rutaPdf).toString("base64");
        return { success: true, base64, rutaPdf };
      } catch (error) {
        console.error("Error al obtener PDF de factura:", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("imprimir-pdf", async (event) => {
      try {
        event.sender.print({}, (success, reason) => {
          if (!success) console.error("Error al imprimir:", reason);
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
}
const ESTRUCTURA_DEFAULT$1 = [
  { id: "contribuyente", label: "Contribuyente", activo: true },
  { id: "ejercicio", label: "Ejercicio", activo: true },
  { id: "periodo", label: "Periodo", activo: false },
  { id: "emisor", label: "Emisor", activo: false },
  { id: "receptor", label: "Receptor", activo: false }
];
const CONFIG_NOMBRE_DEFAULT$1 = {
  rfcEmisor: true,
  rfcReceptor: false
};
class ConfiguracionService {
  constructor(db) {
    this.db = db;
  }
  guardar(config) {
    if (config.metodoAuth === "efirma") {
      if (config.rutaCer) config.rutaCer = this.copiarArchivoEfirma(config.rutaCer, "cer");
      if (config.rutaKey) config.rutaKey = this.copiarArchivoEfirma(config.rutaKey, "key");
    }
    this.db.prepare(`
      UPDATE perfiles SET
        metodo_auth            = @metodo_auth,
        contrasena             = @contrasena,
        ruta_cer               = @ruta_cer,
        ruta_key               = @ruta_key,
        contrasena_fiel        = @contrasena_fiel,
        carpeta_descarga       = @carpeta_descarga,
        plantilla_default      = @plantilla_default,
        carpeta_emitidos       = @carpeta_emitidos,
        carpeta_recibidos      = @carpeta_recibidos,
        estructura_emitidos    = @estructura_emitidos,
        estructura_recibidos   = @estructura_recibidos,
        config_nombre_archivo  = @config_nombre_archivo
      WHERE rfc = @rfc
    `).run({
      rfc: config.rfc,
      metodo_auth: config.metodoAuth,
      contrasena: config.contrasena || null,
      ruta_cer: config.rutaCer || null,
      ruta_key: config.rutaKey || null,
      contrasena_fiel: config.contrasenaFiel || null,
      carpeta_descarga: config.carpetaDescarga || null,
      plantilla_default: config.plantillaDefault || "clasica",
      carpeta_emitidos: config.carpetaEmitidos || null,
      carpeta_recibidos: config.carpetaRecibidos || null,
      estructura_emitidos: JSON.stringify(config.estructuraEmitidos ?? ESTRUCTURA_DEFAULT$1),
      estructura_recibidos: JSON.stringify(config.estructuraRecibidos ?? ESTRUCTURA_DEFAULT$1),
      config_nombre_archivo: JSON.stringify(config.configNombreArchivo ?? CONFIG_NOMBRE_DEFAULT$1)
    });
    const perfil = ProfileManager.getPerfilActivo();
    if (perfil) {
      ProfileManager.setPerfilActivo({
        ...perfil,
        metodo_auth: config.metodoAuth,
        contrasena: config.contrasena,
        ruta_cer: config.rutaCer,
        ruta_key: config.rutaKey,
        contrasena_fiel: config.contrasenaFiel,
        carpeta_descarga: config.carpetaDescarga,
        plantilla_default: config.plantillaDefault || "clasica",
        carpeta_emitidos: config.carpetaEmitidos,
        carpeta_recibidos: config.carpetaRecibidos,
        estructura_emitidos: JSON.stringify(config.estructuraEmitidos ?? ESTRUCTURA_DEFAULT$1),
        estructura_recibidos: JSON.stringify(config.estructuraRecibidos ?? ESTRUCTURA_DEFAULT$1),
        config_nombre_archivo: JSON.stringify(config.configNombreArchivo ?? CONFIG_NOMBRE_DEFAULT$1)
      });
    }
  }
  obtener() {
    const perfil = ProfileManager.getPerfilActivo();
    if (!perfil) return null;
    return {
      rfc: perfil.rfc,
      metodoAuth: perfil.metodo_auth,
      contrasena: perfil.contrasena,
      rutaCer: perfil.ruta_cer,
      rutaKey: perfil.ruta_key,
      contrasenaFiel: perfil.contrasena_fiel,
      carpetaDescarga: perfil.carpeta_descarga,
      plantillaDefault: perfil.plantilla_default || "clasica",
      carpetaEmitidos: perfil.carpeta_emitidos,
      carpetaRecibidos: perfil.carpeta_recibidos,
      estructuraEmitidos: this.parsearEstructura(perfil.estructura_emitidos),
      estructuraRecibidos: this.parsearEstructura(perfil.estructura_recibidos),
      configNombreArchivo: this.parsearConfigNombre(perfil.config_nombre_archivo)
    };
  }
  parsearEstructura(json) {
    try {
      if (!json || json === "[]") return [...ESTRUCTURA_DEFAULT$1];
      return JSON.parse(json);
    } catch {
      return [...ESTRUCTURA_DEFAULT$1];
    }
  }
  parsearConfigNombre(json) {
    try {
      if (!json || json === "{}") return { ...CONFIG_NOMBRE_DEFAULT$1 };
      return JSON.parse(json);
    } catch {
      return { ...CONFIG_NOMBRE_DEFAULT$1 };
    }
  }
  copiarArchivoEfirma(rutaOrigen, tipo) {
    const rfc = ProfileManager.getPerfilActivo()?.rfc || "default";
    const nombreArchivo = `efirma_${rfc}.${tipo}`;
    const rutaDestino = path.join(electron.app.getPath("userData"), nombreArchivo);
    fs__namespace.copyFileSync(rutaOrigen, rutaDestino);
    return rutaDestino;
  }
}
class ConfiguracionHandler {
  configuracionService;
  constructor(db) {
    this.configuracionService = new ConfiguracionService(db);
  }
  registrar() {
    this.handleGuardar();
    this.handleObtener();
    this.handleSeleccionarArchivo();
    this.handleSeleccionarCarpeta();
  }
  handleGuardar() {
    electron.ipcMain.handle("guardar-configuracion", async (_, config) => {
      try {
        this.configuracionService.guardar(config);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
  handleObtener() {
    electron.ipcMain.handle("obtener-configuracion", async () => {
      try {
        const config = this.configuracionService.obtener();
        return { success: true, config };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
  handleSeleccionarArchivo() {
    electron.ipcMain.handle("seleccionar-archivo", async (_, filtros) => {
      const resultado = await electron.dialog.showOpenDialog({
        properties: ["openFile"],
        filters: filtros
      });
      if (resultado.canceled) return { success: false };
      return { success: true, ruta: resultado.filePaths[0] };
    });
  }
  handleSeleccionarCarpeta() {
    electron.ipcMain.handle("seleccionar-carpeta", async () => {
      const resultado = await electron.dialog.showOpenDialog({
        properties: ["openDirectory"]
      });
      if (resultado.canceled) return { success: false };
      return { success: true, ruta: resultado.filePaths[0] };
    });
  }
}
class ConciliacionHandler {
  constructor(conciliacionService, configuracionService, authService, db) {
    this.conciliacionService = conciliacionService;
    this.configuracionService = configuracionService;
    this.authService = authService;
    if (db) {
      const licenseRepository = new LicenseRepository(db);
      this.licenseService = new LicenseService(licenseRepository);
    } else {
      this.licenseService = null;
    }
  }
  licenseService;
  registrar() {
    electron.ipcMain.handle("iniciar-conciliacion", async (event, params) => {
      try {
        if (this.licenseService) {
          const validacion = this.licenseService.validarConsolidacion();
          if (!validacion.valido) {
            return { success: false, error: validacion.motivo };
          }
        }
        const config = this.configuracionService.obtener();
        if (!config) return { success: false, error: "No hay configuración guardada" };
        const resumen = await this.conciliacionService.conciliar(
          config,
          params,
          (progreso) => event.sender.send("progreso-conciliacion", progreso)
        );
        if (this.licenseService && resumen && resumen.errores.length === 0) {
          const licenseRepo = new LicenseRepository(this.licenseService.repository.db);
          licenseRepo.incrementarConsolidaciones();
        }
        return { success: true, resumen };
      } catch (error) {
        return { success: false, error: manejarErrorSat(error) };
      } finally {
        await this.authService.cerrarSesion();
      }
    });
    electron.ipcMain.handle("obtener-ultima-conciliacion", (_, params) => {
      try {
        return { success: true, ultima: this.conciliacionService.obtenerUltima(params.tipo, params.ejercicio, params.periodo) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("obtener-historial-conciliaciones", () => {
      try {
        return { success: true, historial: this.conciliacionService.obtenerHistorial() };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
}
class ImportacionHandler {
  constructor(guardadoService, db) {
    this.guardadoService = guardadoService;
    if (db) {
      const licenseRepository = new LicenseRepository(db);
      this.licenseService = new LicenseService(licenseRepository);
    } else {
      this.licenseService = null;
    }
  }
  licenseService;
  registrar() {
    electron.ipcMain.handle("seleccionar-xmls", async () => {
      const result = await electron.dialog.showOpenDialog({
        title: "Seleccionar archivos XML",
        filters: [{ name: "XML", extensions: ["xml"] }],
        properties: ["openFile", "multiSelections"]
      });
      return { success: true, rutas: result.canceled ? [] : result.filePaths };
    });
    electron.ipcMain.handle("seleccionar-carpeta-xml", async () => {
      const result = await electron.dialog.showOpenDialog({
        title: "Seleccionar carpeta con XMLs",
        properties: ["openDirectory"]
      });
      if (result.canceled) return { success: true, rutas: [] };
      const carpeta = result.filePaths[0];
      const rutas = fs__namespace.readdirSync(carpeta).filter((f) => f.toLowerCase().endsWith(".xml")).map((f) => path__namespace.join(carpeta, f));
      return { success: true, rutas };
    });
    electron.ipcMain.handle("importar-xmls", async (_, rutas) => {
      if (this.licenseService) {
        const validacion = this.licenseService.validarImportacionCfdi();
        if (!validacion.valido) {
          return { success: false, error: validacion.motivo };
        }
      }
      let importadas = 0;
      let omitidas = 0;
      const errores = [];
      for (const ruta of rutas) {
        try {
          const resultado = this.guardadoService.importarDesdeRutaLocal(ruta);
          if (resultado === "importada") importadas++;
          else omitidas++;
        } catch (err) {
          errores.push({ archivo: path__namespace.basename(ruta), error: err.message });
        }
      }
      if (importadas > 0 && errores.length === 0) {
        const licenseRepo = new LicenseRepository(this.licenseService.repository.db);
        licenseRepo.incrementarImportacionesCfdi();
      }
      this.guardadoService.sincronizarCatalogos();
      return { success: true, importadas, omitidas, errores };
    });
  }
}
class PerfilHandler {
  constructor(profileManager, db) {
    this.profileManager = profileManager;
    if (db) {
      const licenseRepository = new LicenseRepository(db);
      this.licenseService = new LicenseService(licenseRepository);
    } else {
      this.licenseService = null;
    }
  }
  licenseService;
  registrar() {
    electron.ipcMain.handle("obtener-perfiles", async () => {
      try {
        const perfiles = this.profileManager.obtenerTodos();
        return { success: true, perfiles };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("crear-perfil", async (_, perfil) => {
      try {
        if (this.licenseService) {
          const validacion = this.licenseService.validarAgregarRfc();
          if (!validacion.valido) {
            return { success: false, error: validacion.motivo || "No puedes agregar más RFCs" };
          }
        }
        this.profileManager.insertar(perfil);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("eliminar-perfil", async (_, rfc) => {
      try {
        this.profileManager.eliminar(rfc);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("seleccionar-perfil", async (_, rfc) => {
      try {
        const perfil = this.profileManager.obtenerPorRfc(rfc);
        if (!perfil) return { success: false, error: "Perfil no encontrado" };
        ProfileManager.setPerfilActivo(perfil);
        this.profileManager.crearTablasPerfil(rfc);
        return { success: true, perfil };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("obtener-perfil-activo", async () => {
      try {
        const perfil = ProfileManager.getPerfilActivo();
        return { success: true, perfil };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("cerrar-perfil", async () => {
      try {
        ProfileManager.limpiarPerfil();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
}
class DashboardRepository {
  constructor(db) {
    this.db = db;
  }
  get tabla() {
    return ProfileManager.getTablaFacturas();
  }
  kpisDelMes(año, mes) {
    const mesStr = String(mes).padStart(2, "0");
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const añoAnterior = mes === 1 ? año - 1 : año;
    const mesAnteriorStr = String(mesAnterior).padStart(2, "0");
    const query = (a, m) => this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as ingresos,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as egresos,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_trasladados ELSE 0 END), 0) as iva_cobrado,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_trasladados ELSE 0 END), 0) as iva_pagado
      FROM ${this.tabla}
      WHERE strftime('%Y', fecha_emision) = '${a}' AND strftime('%m', fecha_emision) = '${m}'
    `).get();
    const actual = query(año, mesStr);
    const anterior = query(añoAnterior, mesAnteriorStr);
    const variacion = (a, b) => b === 0 ? 0 : Math.round((a - b) / b * 100);
    return {
      ingresos: actual.ingresos,
      egresos: actual.egresos,
      balance: actual.ingresos - actual.egresos,
      iva_estimado: actual.iva_cobrado - actual.iva_pagado,
      variacion_ingresos: variacion(actual.ingresos, anterior.ingresos),
      variacion_egresos: variacion(actual.egresos, anterior.egresos),
      variacion_balance: variacion(actual.ingresos - actual.egresos, anterior.ingresos - anterior.egresos)
    };
  }
  flujoAnual(año) {
    return this.db.prepare(`
      SELECT
        strftime('%m', fecha_emision) as mes,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as ingresos,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as egresos
      FROM ${this.tabla}
      WHERE strftime('%Y', fecha_emision) = '${año}'
      GROUP BY mes
      ORDER BY mes ASC
    `).all();
  }
  topProveedores(año, mes) {
    const mesStr = String(mes).padStart(2, "0");
    return this.db.prepare(`
      SELECT
        rfc_emisor as rfc,
        nombre_emisor as nombre,
        COUNT(*) as facturas,
        SUM(total) as total
      FROM ${this.tabla}
      WHERE tipo_descarga = 'recibida'
        AND tipo_comprobante = 'I'
        AND estado = 'vigente'
        AND strftime('%Y', fecha_emision) = '${año}'
        AND strftime('%m', fecha_emision) = '${mesStr}'
      GROUP BY rfc_emisor
      ORDER BY total DESC
      LIMIT 5
    `).all();
  }
  topClientes(año, mes) {
    const mesStr = String(mes).padStart(2, "0");
    return this.db.prepare(`
      SELECT
        rfc_receptor as rfc,
        nombre_receptor as nombre,
        COUNT(*) as facturas,
        SUM(total) as total
      FROM ${this.tabla}
      WHERE tipo_descarga = 'emitida'
        AND tipo_comprobante = 'I'
        AND estado = 'vigente'
        AND strftime('%Y', fecha_emision) = '${año}'
        AND strftime('%m', fecha_emision) = '${mesStr}'
      GROUP BY rfc_receptor
      ORDER BY total DESC
      LIMIT 5
    `).all();
  }
  obtenerConteos(rfcActivo) {
    return this.db.prepare(`
    SELECT
      SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' THEN 1 ELSE 0 END) as recibidas,
      SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' THEN 1 ELSE 0 END) as emitidas,
      SUM(CASE WHEN tipo_comprobante = 'N' THEN 1 ELSE 0 END) as nomina,
      SUM(CASE WHEN tipo_comprobante = 'P' THEN 1 ELSE 0 END) as pagos,
      COUNT(DISTINCT CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' THEN rfc_receptor END) as clientes,
      COUNT(DISTINCT CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' THEN rfc_emisor END) as proveedores,
      SUM(CASE WHEN tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}' THEN 1 ELSE 0 END) as empleados,
      SUM(CASE WHEN tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}' THEN 1 ELSE 0 END) as patrones
    FROM ${this.tabla}
  `).get();
  }
  ivaAnual(año) {
    return this.db.prepare(`
      SELECT
        strftime('%m', fecha_emision) AS mes,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida'  AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_trasladados ELSE 0 END), 0) AS iva_cobrado,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_trasladados ELSE 0 END), 0) AS iva_acreditable,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida'  AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_retenidos  ELSE 0 END), 0) AS iva_retenido_cobrado,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_retenidos  ELSE 0 END), 0) AS iva_retenido_pagado
      FROM ${this.tabla}
      WHERE strftime('%Y', fecha_emision) = '${año}'
      GROUP BY mes
      ORDER BY mes ASC
    `).all();
  }
  isrAnual(año, rfcActivo) {
    return this.db.prepare(`
      SELECT
        strftime('%m', fecha_emision) AS mes,
        COALESCE(SUM(CASE
          WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente'
          THEN subtotal
          WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'N' AND estado = 'vigente'
            AND rfc_receptor = '${rfcActivo}'
          THEN subtotal
          ELSE 0
        END), 0) AS ingresos,
        COALESCE(SUM(CASE
          WHEN tipo_descarga = 'recibida' AND tipo_comprobante IN ('I','E') AND estado = 'vigente'
          THEN subtotal ELSE 0
        END), 0) AS gastos,
        COALESCE(SUM(CASE
          WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente'
            AND rfc_emisor = '${rfcActivo}'
          THEN total_impuestos_retenidos ELSE 0
        END), 0) AS isr_retenido
      FROM ${this.tabla}
      WHERE strftime('%Y', fecha_emision) = '${año}'
      GROUP BY mes
      ORDER BY mes ASC
    `).all();
  }
  detalleMes(año, mes) {
    const mesStr = String(mes).padStart(2, "0");
    return this.db.prepare(`
      SELECT
        f.uuid,
        f.tipo_descarga,
        f.tipo_comprobante,
        f.rfc_emisor,
        f.nombre_emisor,
        f.rfc_receptor,
        f.nombre_receptor,
        f.metodo_pago,
        f.subtotal,
        f.descuento,
        f.total_impuestos_retenidos,
        f.total_impuestos_trasladados,
        f.total,
        f.estado,
        f.xml,
        COALESCE(p.pagado, CASE WHEN f.metodo_pago = 'PUE' THEN 1 ELSE 0 END) AS pagado
      FROM ${this.tabla} f
      LEFT JOIN cfdi_estado_pago p ON p.uuid = f.uuid
      WHERE f.estado = 'vigente'
        AND f.tipo_comprobante IN ('I', 'E', 'N', 'P', 'T')
        AND strftime('%Y', f.fecha_emision) = '${año}'
        AND strftime('%m', f.fecha_emision) = '${mesStr}'
      ORDER BY f.fecha_emision ASC
    `).all();
  }
  togglePagado(uuid, pagado) {
    this.db.prepare(`
      INSERT INTO cfdi_estado_pago (uuid, pagado, fecha_actualizacion)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(uuid) DO UPDATE SET
        pagado = excluded.pagado,
        fecha_actualizacion = excluded.fecha_actualizacion
    `).run(uuid, pagado ? 1 : 0);
  }
  obtenerRutaXmlMuestra() {
    const row = this.db.prepare(`
      SELECT xml FROM ${this.tabla}
      WHERE tipo_descarga = 'emitida'
        AND xml IS NOT NULL
        AND xml != ''
      LIMIT 1
    `).get();
    return row?.xml ?? null;
  }
}
class DashboardHandler {
  constructor(db) {
    this.db = db;
    this.repository = new DashboardRepository(db);
  }
  repository;
  registrar() {
    electron.ipcMain.handle("dashboard-kpis", async (_, año, mes) => {
      try {
        return { success: true, data: this.repository.kpisDelMes(año, mes) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("dashboard-flujo-anual", async (_, año) => {
      try {
        return { success: true, data: this.repository.flujoAnual(año) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("dashboard-top-proveedores", async (_, año, mes) => {
      try {
        return { success: true, data: this.repository.topProveedores(año, mes) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("dashboard-top-clientes", async (_, año, mes) => {
      try {
        return { success: true, data: this.repository.topClientes(año, mes) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("dashboard-obtener-conteos", async () => {
      try {
        const perfil = ProfileManager.getPerfilActivo();
        const data = this.repository.obtenerConteos(perfil?.rfc || "");
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("reportes-iva-anual", async (_, año) => {
      try {
        return { success: true, data: this.repository.ivaAnual(año) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("reportes-isr-anual", async (_, año, regimen) => {
      try {
        const perfil = ProfileManager.getPerfilActivo();
        if (!perfil) throw new Error("No hay perfil activo");
        const { IsrCalculadorService } = await Promise.resolve().then(() => require("./IsrCalculadorService-ucsK5Hcg.js"));
        const calculador = new IsrCalculadorService(this.db);
        const tabla = ProfileManager.getTablaFacturas();
        const data = calculador.calcularAnual(tabla, año, regimen, perfil.rfc);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("reportes-detalle-mes", async (_, año, mes) => {
      try {
        return { success: true, data: this.repository.detalleMes(año, mes) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("cfdi-toggle-pagado", async (_, uuid, pagado) => {
      try {
        this.repository.togglePagado(uuid, pagado);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("reportes-detectar-regimen", async () => {
      try {
        const rutaXml = this.repository.obtenerRutaXmlMuestra();
        if (!rutaXml) return { success: true, data: null };
        const { XmlParserService: XmlParserService2 } = await Promise.resolve().then(() => XmlParserService$1);
        const parser = new XmlParserService2();
        const campos = parser.extraerCampos(rutaXml);
        const regimen = campos.regimen_fiscal_emisor ?? null;
        return { success: true, data: regimen };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
}
class CatalogoRepository {
  constructor(db) {
    this.db = db;
  }
  tabla(tipo) {
    return `${tipo}_${ProfileManager.getRfcActivo()}`;
  }
  tablaFacturas() {
    return ProfileManager.getTablaFacturas();
  }
  obtenerTodos(tipo) {
    const tablaF = this.tablaFacturas();
    const rfcActivo = ProfileManager.getRfcActivo();
    const campoRfc = tipo === "clientes" || tipo === "empleados" ? "rfc_receptor" : "rfc_emisor";
    const filtroTipo = tipo === "clientes" ? `tipo_descarga = 'emitida' AND tipo_comprobante = 'I'` : tipo === "proveedores" ? `tipo_descarga = 'recibida' AND tipo_comprobante = 'I'` : tipo === "empleados" ? `tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}'` : `tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}'`;
    const camposExtra = tipo === "clientes" || tipo === "proveedores" ? `c.limite_credito, c.dias_credito, c.contacto,` : tipo === "empleados" ? `c.puesto, c.fecha_ingreso,` : `c.contacto,`;
    return this.db.prepare(`
    SELECT
      c.id, c.rfc, c.nombre, c.telefono, c.email,
      c.direccion, c.notas, ${camposExtra}
      c.created_at, c.updated_at,
      COUNT(f.uuid) as total_facturas,
      COALESCE(SUM(f.total), 0) as total_facturado,
      MAX(f.fecha_emision) as ultimo_cfdi
    FROM ${this.tabla(tipo)} c
    LEFT JOIN ${tablaF} f ON f.${campoRfc} = c.rfc AND ${filtroTipo}
    GROUP BY c.id
    ORDER BY total_facturado DESC
  `).all();
  }
  obtenerPorRfc(tipo, rfc) {
    const tablaF = this.tablaFacturas();
    const rfcActivo = ProfileManager.getRfcActivo();
    const campoRfc = tipo === "clientes" || tipo === "empleados" ? "rfc_receptor" : "rfc_emisor";
    const filtroTipo = tipo === "clientes" ? `tipo_descarga = 'emitida' AND tipo_comprobante = 'I'` : tipo === "proveedores" ? `tipo_descarga = 'recibida' AND tipo_comprobante = 'I'` : tipo === "empleados" ? `tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}'` : `tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}'`;
    return this.db.prepare(`
      SELECT
        c.*,
        COUNT(f.uuid) as total_facturas,
        COALESCE(SUM(f.total), 0) as total_facturado,
        MAX(f.fecha_emision) as ultimo_cfdi
      FROM ${this.tabla(tipo)} c
      LEFT JOIN ${tablaF} f ON f.${campoRfc} = c.rfc AND ${filtroTipo}
      WHERE c.rfc = ?
      GROUP BY c.id
    `).get(rfc);
  }
  actualizar(tipo, rfc, datos) {
    const campos = Object.keys(datos).filter((k) => k !== "rfc" && k !== "id").map((k) => `${k} = @${k}`).join(", ");
    this.db.prepare(`
      UPDATE ${this.tabla(tipo)}
      SET ${campos}, updated_at = datetime('now')
      WHERE rfc = @rfc
    `).run({ ...datos, rfc });
  }
  sincronizar(tipo) {
    const tablaF = this.tablaFacturas();
    const rfcActivo = ProfileManager.getRfcActivo();
    const queries = {
      clientes: `
        INSERT OR IGNORE INTO ${this.tabla("clientes")} (rfc, nombre)
        SELECT DISTINCT rfc_receptor, nombre_receptor
        FROM ${tablaF}
        WHERE tipo_descarga = 'emitida' AND tipo_comprobante = 'I'
          AND rfc_receptor IS NOT NULL AND rfc_receptor != ''
      `,
      proveedores: `
        INSERT OR IGNORE INTO ${this.tabla("proveedores")} (rfc, nombre)
        SELECT DISTINCT rfc_emisor, nombre_emisor
        FROM ${tablaF}
        WHERE tipo_descarga = 'recibida' AND tipo_comprobante = 'I'
          AND rfc_emisor IS NOT NULL AND rfc_emisor != ''
      `,
      empleados: `
        INSERT OR IGNORE INTO ${this.tabla("empleados")} (rfc, nombre)
        SELECT DISTINCT rfc_receptor, nombre_receptor
        FROM ${tablaF}
        WHERE tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}'
          AND rfc_receptor IS NOT NULL AND rfc_receptor != ''
      `,
      patrones: `
        INSERT OR IGNORE INTO ${this.tabla("patrones")} (rfc, nombre)
        SELECT DISTINCT rfc_emisor, nombre_emisor
        FROM ${tablaF}
        WHERE tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}'
          AND rfc_emisor IS NOT NULL AND rfc_emisor != ''
      `
    };
    this.db.prepare(queries[tipo]).run();
  }
  sincronizarTodos() {
    this.sincronizar("clientes");
    this.sincronizar("proveedores");
    this.sincronizar("empleados");
    this.sincronizar("patrones");
  }
}
class CatalogoHandler {
  repository;
  constructor(db) {
    this.repository = new CatalogoRepository(db);
  }
  registrar() {
    electron.ipcMain.handle("catalogo-obtener", async (_, tipo) => {
      try {
        const data = this.repository.obtenerTodos(tipo);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("catalogo-obtener-por-rfc", async (_, tipo, rfc) => {
      try {
        const data = this.repository.obtenerPorRfc(tipo, rfc);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("catalogo-actualizar", async (_, tipo, rfc, datos) => {
      try {
        this.repository.actualizar(tipo, rfc, datos);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("catalogo-sincronizar", async () => {
      try {
        this.repository.sincronizarTodos();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
}
class FacturaRepository {
  constructor(db) {
    this.db = db;
  }
  get tabla() {
    return ProfileManager.getTablaFacturas();
  }
  get tablaPagos() {
    return ProfileManager.getTablaPagosComplemento();
  }
  get tablaNomina() {
    return ProfileManager.getTablaNominaComplemento();
  }
  insertar(factura) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO ${this.tabla}
        (uuid, version, serie, folio, fecha_emision, fecha_timbrado,
         rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor,
         subtotal, descuento, total_impuestos_trasladados, total_impuestos_retenidos,
         total, tipo_comprobante, forma_pago, metodo_pago, moneda, tipo_cambio,
         estado, estado_cancelacion, estado_proceso_cancelacion, fecha_cancelacion,
         rfc_pac, folio_sustitucion, xml, tipo_descarga)
      VALUES
        (@uuid, @version, @serie, @folio, @fecha_emision, @fecha_timbrado,
         @rfc_emisor, @nombre_emisor, @rfc_receptor, @nombre_receptor,
         @subtotal, @descuento, @total_impuestos_trasladados, @total_impuestos_retenidos,
         @total, @tipo_comprobante, @forma_pago, @metodo_pago, @moneda, @tipo_cambio,
         @estado, @estado_cancelacion, @estado_proceso_cancelacion, @fecha_cancelacion,
         @rfc_pac, @folio_sustitucion, @xml, @tipo_descarga)
    `);
    stmt.run({
      version: null,
      serie: null,
      folio: null,
      fecha_timbrado: null,
      descuento: 0,
      total_impuestos_trasladados: 0,
      total_impuestos_retenidos: 0,
      forma_pago: null,
      metodo_pago: null,
      moneda: null,
      tipo_cambio: null,
      estado_cancelacion: null,
      estado_proceso_cancelacion: null,
      fecha_cancelacion: null,
      rfc_pac: null,
      folio_sustitucion: null,
      ...factura
    });
  }
  actualizar(uuid, campos) {
    const keys = Object.keys(campos).filter((k) => k !== "uuid");
    if (keys.length === 0) return;
    const sets = keys.map((k) => `${k} = @${k}`).join(", ");
    const stmt = this.db.prepare(`UPDATE ${this.tabla} SET ${sets} WHERE uuid = @uuid`);
    stmt.run({ ...campos, uuid });
  }
  obtenerTodas() {
    return this.db.prepare(`SELECT * FROM ${this.tabla} ORDER BY fecha_emision DESC`).all();
  }
  obtenerPorRfc(rfc) {
    return this.db.prepare(`
      SELECT * FROM ${this.tabla}
      WHERE rfc_emisor = ? OR rfc_receptor = ?
      ORDER BY fecha_emision DESC
    `).all(rfc, rfc);
  }
  obtenerPorUuid(uuid) {
    return this.db.prepare(`SELECT * FROM ${this.tabla} WHERE uuid = ?`).get(uuid);
  }
  eliminar(uuid) {
    this.db.prepare(`DELETE FROM ${this.tabla} WHERE uuid = ?`).run(uuid);
  }
  obtenerDrillDown(rfc) {
    return this.db.prepare(`
      SELECT * FROM ${this.tabla}
      WHERE (rfc_emisor = ? OR rfc_receptor = ?)
        AND tipo_comprobante IN ('I', 'E')
        AND estado = 'vigente'
      ORDER BY fecha_emision DESC
    `).all(rfc, rfc);
  }
  obtenerPorTipoDescarga(tipoDescarga, filtros = {}) {
    const esPago = filtros.tiposComprobante?.length === 1 && filtros.tiposComprobante[0] === "P";
    const esNomina = filtros.tiposComprobante?.length === 1 && filtros.tiposComprobante[0] === "N";
    const condiciones = ["f.tipo_descarga = @tipoDescarga"];
    const params = { tipoDescarga };
    if (filtros.tiposComprobante?.length) {
      const placeholders = filtros.tiposComprobante.map((_, i) => `@tc${i}`).join(", ");
      filtros.tiposComprobante.forEach((v, i) => {
        params[`tc${i}`] = v;
      });
      condiciones.push(`f.tipo_comprobante IN (${placeholders})`);
    }
    if (filtros.fechaDesde) {
      condiciones.push("f.fecha_emision >= @fechaDesde");
      params.fechaDesde = filtros.fechaDesde;
    }
    if (filtros.fechaHasta) {
      condiciones.push("f.fecha_emision <= @fechaHasta");
      params.fechaHasta = filtros.fechaHasta + "T23:59:59";
    }
    if (filtros.rfcContraparte) {
      const campo = tipoDescarga === "recibida" ? "f.rfc_emisor" : "f.rfc_receptor";
      condiciones.push(`${campo} LIKE @rfcContraparte`);
      params.rfcContraparte = `%${filtros.rfcContraparte}%`;
    }
    if (filtros.tipoComprobante) {
      condiciones.push("f.tipo_comprobante = @tipoComprobante");
      params.tipoComprobante = filtros.tipoComprobante;
    }
    if (filtros.formaPago) {
      condiciones.push("f.forma_pago = @formaPago");
      params.formaPago = filtros.formaPago;
    }
    if (filtros.metodoPago) {
      condiciones.push("f.metodo_pago = @metodoPago");
      params.metodoPago = filtros.metodoPago;
    }
    if (filtros.estado) {
      condiciones.push("f.estado = @estado");
      params.estado = filtros.estado;
    }
    if (filtros.busqueda) {
      condiciones.push(`(
        f.uuid LIKE @b OR
        f.rfc_emisor LIKE @b OR f.nombre_emisor LIKE @b OR
        f.rfc_receptor LIKE @b OR f.nombre_receptor LIKE @b OR
        f.serie LIKE @b OR f.folio LIKE @b
      )`);
      params.b = `%${filtros.busqueda}%`;
    }
    const where = condiciones.join(" AND ");
    if (esPago) {
      return this.db.prepare(`
        SELECT
          f.*,
          p.fecha_pago,
          p.forma_pago_p,
          p.moneda_p,
          p.tipo_cambio_p,
          p.monto,
          p.documentos
        FROM ${this.tabla} f
        LEFT JOIN ${this.tablaPagos} p ON p.uuid_rep = f.uuid
        WHERE ${where}
        ORDER BY p.fecha_pago DESC, f.fecha_timbrado DESC
      `).all(params);
    }
    if (esNomina) {
      return this.db.prepare(`
        SELECT
          f.*,
          n.tipo_nomina,
          n.fecha_pago,
          n.fecha_inicial_pago,
          n.fecha_final_pago,
          n.num_dias_pagados,
          n.total_percepciones,
          n.total_deducciones,
          n.total_otros_pagos,
          n.curp,
          n.num_empleado,
          n.departamento,
          n.puesto,
          n.tipo_regimen,
          n.tipo_contrato,
          n.periodicidad_pago,
          n.salario_diario_integrado
        FROM ${this.tabla} f
        LEFT JOIN ${this.tablaNomina} n ON n.uuid_cfdi = f.uuid
        WHERE ${where}
        ORDER BY n.fecha_pago DESC, f.fecha_timbrado DESC
      `).all(params);
    }
    return this.db.prepare(`SELECT f.* FROM ${this.tabla} f WHERE ${where} ORDER BY f.fecha_emision DESC`).all(params);
  }
  contarPorTipoDescarga() {
    const row = this.db.prepare(`
      SELECT
        SUM(CASE WHEN tipo_descarga = 'recibida' THEN 1 ELSE 0 END) AS recibidas,
        SUM(CASE WHEN tipo_descarga = 'emitida'  THEN 1 ELSE 0 END) AS emitidas,
        SUM(CASE WHEN tipo_comprobante = 'N'     THEN 1 ELSE 0 END) AS nomina,
        SUM(CASE WHEN tipo_comprobante = 'P'     THEN 1 ELSE 0 END) AS pagos
      FROM ${this.tabla}
    `).get();
    return {
      recibidas: row.recibidas || 0,
      emitidas: row.emitidas || 0,
      nomina: row.nomina || 0,
      pagos: row.pagos || 0
    };
  }
}
class ExportacionHandler {
  facturaRepository;
  constructor(db) {
    this.facturaRepository = new FacturaRepository(db);
  }
  registrar() {
    electron.ipcMain.handle("exportacion-obtener-preview", async (_, filtros) => {
      try {
        const facturas = this.facturaRepository.obtenerPorTipoDescarga(
          filtros.tipoDescarga,
          {
            tiposComprobante: filtros.tiposComprobante && filtros.tiposComprobante.length > 0 ? filtros.tiposComprobante : void 0,
            fechaDesde: filtros.fechaDesde,
            fechaHasta: filtros.fechaHasta
          }
        );
        console.log("Facturas obtenidas:", facturas.length);
        console.log("Primer factura:", facturas[0]);
        const totales = {
          cantidad_cfdis: facturas.length,
          subtotal: facturas.reduce((s, f) => s + (parseFloat(f.subtotal) || 0), 0),
          descuentos: facturas.reduce((s, f) => s + (parseFloat(f.descuento) || 0), 0),
          iva_trasladado: facturas.reduce((s, f) => s + (parseFloat(f.total_impuestos_trasladados) || 0), 0),
          total_impuestos_retenidos: facturas.reduce((s, f) => s + (parseFloat(f.total_impuestos_retenidos) || 0), 0),
          total_general: facturas.reduce((s, f) => s + (parseFloat(f.total) || 0), 0)
        };
        console.log("Totales calculados:", totales);
        return {
          success: true,
          datos: facturas.map((f) => ({
            uuid: f.uuid,
            serie: f.serie || "",
            folio: f.folio || "",
            fecha_emision: f.fecha_emision,
            tipo_comprobante: this.mapearTipoComprobante(f.tipo_comprobante),
            rfc_emisor: f.rfc_emisor,
            nombre_emisor: f.nombre_emisor,
            rfc_receptor: f.rfc_receptor,
            nombre_receptor: f.nombre_receptor,
            subtotal: parseFloat(f.subtotal) || 0,
            descuento: parseFloat(f.descuento) || 0,
            total_impuestos_trasladados: parseFloat(f.total_impuestos_trasladados) || 0,
            total_impuestos_retenidos: parseFloat(f.total_impuestos_retenidos) || 0,
            total: parseFloat(f.total) || 0,
            moneda: f.moneda || "MXN",
            forma_pago: f.forma_pago || "",
            metodo_pago: f.metodo_pago || "",
            estado: f.estado
          })),
          cantidad: facturas.length,
          totales
        };
      } catch (error) {
        console.error("Error en preview:", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("exportacion-generar-excel", async (_event, datos) => {
      try {
        const facturas = this.facturaRepository.obtenerPorTipoDescarga(
          datos.filtros.tipoDescarga,
          {
            tiposComprobante: datos.filtros.tiposComprobante && datos.filtros.tiposComprobante.length > 0 ? datos.filtros.tiposComprobante : void 0,
            fechaDesde: datos.filtros.fechaDesde,
            fechaHasta: datos.filtros.fechaHasta
          }
        );
        if (facturas.length === 0) {
          return { success: false, error: "No hay facturas para exportar" };
        }
        const XLSX = require("xlsx");
        const datosExcel = facturas.map((f) => ({
          "UUID": f.uuid,
          "Serie": f.serie || "",
          "Folio": f.folio || "",
          "Fecha": f.fecha_emision,
          "Tipo": this.mapearTipoComprobante(f.tipo_comprobante),
          "RFC Emisor": f.rfc_emisor,
          "Nombre Emisor": f.nombre_emisor,
          "RFC Receptor": f.rfc_receptor,
          "Nombre Receptor": f.nombre_receptor,
          "Subtotal": parseFloat(f.subtotal) || 0,
          "Descuento": parseFloat(f.descuento) || 0,
          "IVA Trasladado": parseFloat(f.total_impuestos_trasladados) || 0,
          "ISR Retenido": parseFloat(f.total_impuestos_retenidos) || 0,
          "Total": parseFloat(f.total) || 0,
          "Moneda": f.moneda || "MXN",
          "Forma Pago": f.forma_pago || "",
          "Método Pago": f.metodo_pago || "",
          "Estado": f.estado
        }));
        const ws = XLSX.utils.json_to_sheet(datosExcel);
        ws["!cols"] = [
          { wch: 36 },
          // UUID
          { wch: 8 },
          // Serie
          { wch: 8 },
          // Folio
          { wch: 12 },
          // Fecha
          { wch: 10 },
          // Tipo
          { wch: 12 },
          // RFC Emisor
          { wch: 20 },
          // Nombre Emisor
          { wch: 12 },
          // RFC Receptor
          { wch: 20 },
          // Nombre Receptor
          { wch: 12 },
          // Subtotal
          { wch: 12 },
          // Descuento
          { wch: 14 },
          // IVA Trasladado
          { wch: 14 },
          // ISR Retenido
          { wch: 12 },
          // Total
          { wch: 8 },
          // Moneda
          { wch: 12 },
          // Forma Pago
          { wch: 12 },
          // Método Pago
          { wch: 10 }
          // Estado
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Facturas");
        XLSX.writeFile(wb, datos.rutaDestino);
        return { success: true, cantidad: facturas.length };
      } catch (error) {
        console.error("Error generando Excel:", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("exportacion-obtener-tipos-cfdi", () => {
      try {
        return {
          success: true,
          tipos: [
            { code: "I", label: "Ingreso" },
            { code: "E", label: "Egreso" },
            { code: "N", label: "Nómina" },
            { code: "P", label: "Pago" },
            { code: "T", label: "Traslado" }
          ]
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("exportacion-seleccionar-carpeta", async () => {
      try {
        const result = await electron.dialog.showSaveDialog({
          title: "Guardar Excel como",
          defaultPath: `Exportacion_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.xlsx`,
          filters: [{ name: "Excel", extensions: ["xlsx"] }]
        });
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
  /**
   * Mapea código de tipo de comprobante a descripción
   */
  mapearTipoComprobante(tipo) {
    const mapeo = {
      "I": "Ingreso",
      "E": "Egreso",
      "T": "Traslado",
      "N": "Nómina",
      "P": "Pago"
    };
    return mapeo[tipo] || tipo;
  }
}
const CUMPLIMIENTO_PORTAL = "https://ptsc32d.clouda.sat.gob.mx";
const LOGIN_DOMAIN$1 = "loginda.siat.sat.gob.mx";
const RUTA_REPORTE = "https://ptsc32d.clouda.sat.gob.mx/#/reporteOpinion32DContribuyente";
const MAX_REINTENTOS$1 = 3;
class SatCumplimientoService {
  async obtenerCaptcha(page) {
    await page.goto(CUMPLIMIENTO_PORTAL, { waitUntil: "networkidle", timeout: 3e4 });
    await page.waitForURL(`**${LOGIN_DOMAIN$1}**`, { timeout: 2e4 });
    const captchaEl = await page.waitForSelector('img[src^="data:image"]', { timeout: 1e4 });
    const screenshot = await captchaEl.screenshot({ type: "png" });
    return { imagenBase64: `data:image/png;base64,${screenshot.toString("base64")}` };
  }
  async loginCiecYObtenerOpinion(page, carpetaTemp, rfc, password, captcha, onProgreso) {
    const accionLogin = async () => {
      await this.llenarFormularioCiec(page, rfc, password, captcha);
    };
    return this.ejecutarFlujoOpinion(page, carpetaTemp, accionLogin, "contrasena", onProgreso);
  }
  async loginFielYObtenerOpinion(page, carpetaTemp, rutaCer, rutaKey, password, onProgreso) {
    const accionLogin = async () => {
      await this.llenarFormularioFiel(page, rutaCer, rutaKey, password);
    };
    return this.ejecutarFlujoOpinion(page, carpetaTemp, accionLogin, "efirma", onProgreso);
  }
  // ---------------------------------------------------------------------------
  async ejecutarFlujoOpinion(page, carpetaTemp, accionLogin, metodo, onProgreso) {
    try {
      onProgreso?.("Conectando con el SAT...");
      const pdfPromesa = this.configurarInterceptacionPdf(page, carpetaTemp);
      onProgreso?.("Iniciando sesión...");
      await this.intentarLogin(page, accionLogin, metodo);
      onProgreso?.("Generando reporte de cumplimiento...");
      const rutaArchivo = await this.navegarYCapturarReporte(page, pdfPromesa, onProgreso);
      onProgreso?.("Procesando resultado...");
      return this.formatearRespuesta(rutaArchivo);
    } catch (error) {
      return this.manejarError(metodo === "contrasena" ? "CIEC" : "FIEL", error);
    }
  }
  async intentarLogin(page, accion, metodoAuth, intento = 1) {
    try {
      await accion();
      const resultado = await Promise.race([
        page.waitForSelector(".alert-danger, #msgError, #pnlError", { timeout: 7e3 }).then(async (el) => ({ tipo: "ERROR", texto: await el?.innerText() })),
        page.waitForSelector('a[href*="Logout"], .separador-menu, #header', { timeout: 2e4 }).then(() => ({ tipo: "EXITO", texto: null })),
        page.waitForURL(`**/ptsc32d.clouda.sat.gob.mx/#/`, { timeout: 2e4 }).then(() => ({ tipo: "EXITO", texto: null }))
      ]);
      if (resultado?.tipo === "ERROR") {
        const txt = resultado.texto?.toLowerCase() || "";
        if (txt.includes("captcha")) throw new Error("CAPTCHA_INVALIDO");
        if (txt.includes("rfc") || txt.includes("contraseña") || txt.includes("acceso"))
          throw new Error("CREDENCIALES_INVALIDAS");
        throw new Error(resultado.texto || "ERROR_DESCONOCIDO_SAT");
      }
      console.log("[SatCumplimientoService] Login verificado con éxito");
    } catch (error) {
      if (error.message === "CAPTCHA_INVALIDO" || error.message === "CREDENCIALES_INVALIDAS") {
        throw error;
      }
      const esTimeout = error.message?.toLowerCase().includes("timeout");
      if (esTimeout && intento < MAX_REINTENTOS$1) {
        console.log(`[SatCumplimientoService] Timeout (intento ${intento}/${MAX_REINTENTOS$1}), verificando estado...`);
        const estaAdentro = await page.evaluate(
          () => document.body.innerText.includes("Cerrar sesión") || !!document.querySelector(".separador-menu")
        ).catch(() => false);
        if (estaAdentro) {
          console.log("[SatCumplimientoService] Ya estamos adentro, continuando...");
          return;
        }
        await page.goto(CUMPLIMIENTO_PORTAL, { waitUntil: "networkidle" });
        return this.intentarLogin(page, accion, metodoAuth, intento + 1);
      }
      throw error;
    }
  }
  async navegarYCapturarReporte(page, pdfPromesa, onProgreso) {
    await page.waitForURL(`**ptsc32d.clouda.sat.gob.mx**`, { timeout: 2e4 });
    await page.waitForTimeout(2e3);
    onProgreso?.("Descargando PDF de opinión...");
    await page.goto(RUTA_REPORTE, { waitUntil: "commit", timeout: 45e3 });
    await page.waitForSelector("sat-mf-reporte-opinion-contribuyente-root", { timeout: 3e4 }).catch(() => null);
    return await pdfPromesa;
  }
  async configurarInterceptacionPdf(page, carpetaTemp) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        page.removeListener("response", handler);
        resolve(void 0);
      }, 6e4);
      const handler = async (response) => {
        const url = response.url();
        const contentType = (response.headers()["content-type"] || "").toLowerCase();
        if (url.includes("GeneraOpinion") || contentType.includes("pdf")) {
          try {
            const buffer = await response.body();
            if (buffer.length > 5e3) {
              const rutaFinal = path.join(carpetaTemp, `opinion_${Date.now()}.pdf`);
              fs.writeFileSync(rutaFinal, buffer);
              clearTimeout(timer);
              page.removeListener("response", handler);
              resolve(rutaFinal);
            }
          } catch {
          }
        }
      };
      page.on("response", handler);
    });
  }
  async formatearRespuesta(rutaArchivo) {
    let resultado = "unknown";
    if (rutaArchivo) {
      resultado = await this.determinarResultadoDesdePdf(rutaArchivo);
    }
    return {
      resultado,
      fecha_emision: (/* @__PURE__ */ new Date()).toISOString(),
      descripcion: rutaArchivo ? "Procesado con éxito." : "Error: PDF no capturado.",
      rutaArchivo
    };
  }
  manejarError(tipo, error) {
    const msg = error.message || "Error desconocido";
    console.error(`[SatCumplimientoService] ${tipo}: ${msg}`);
    return {
      resultado: "unknown",
      fecha_emision: (/* @__PURE__ */ new Date()).toISOString(),
      descripcion: `FALLO_${tipo}: ${msg}`
    };
  }
  async determinarResultadoDesdePdf(ruta) {
    try {
      const buffer = fs.readFileSync(ruta);
      const loadingTask = pdfjsLib__namespace.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;
      let textoCompleto = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const pagina = await pdf.getPage(i);
        const content = await pagina.getTextContent();
        textoCompleto += content.items.map((item) => item.str).join(" ") + "\n";
      }
      const texto = textoCompleto.toUpperCase();
      if (texto.includes("POSITIVO")) return "positivo";
      if (texto.includes("NEGATIVO")) return "negativo";
      return "unknown";
    } catch (error) {
      console.error("[SatCumplimientoService] Error procesando PDF:", error);
      return "unknown";
    }
  }
  async llenarFormularioCiec(page, rfc, password, captcha) {
    await page.waitForSelector("#rfc", { timeout: 1e4 });
    await page.fill("#rfc", rfc);
    await page.fill("#password", password);
    const captchaSelector = 'input[id*="captcha" i], input[name*="captcha" i], input[placeholder*="captcha" i]';
    await page.waitForSelector(captchaSelector, { timeout: 5e3 });
    await page.click(captchaSelector);
    await page.fill(captchaSelector, "");
    await page.type(captchaSelector, captcha, { delay: 50 });
    await page.click("#submit");
  }
  async llenarFormularioFiel(page, rutaCer, rutaKey, password) {
    const tabFiel = page.locator('a:has-text("e.firma")');
    if (await tabFiel.count() > 0) await tabFiel.first().click();
    await page.setInputFiles('input[accept*=".cer"]', rutaCer);
    await page.setInputFiles('input[accept*=".key"]', rutaKey);
    await page.fill('input[type="password"]', password);
    await page.click("#submit");
  }
}
class CumplimientoHandler {
  cumplimientoService;
  configuracionService;
  paginaActiva = null;
  constructor(configuracionService) {
    this.cumplimientoService = new SatCumplimientoService();
    this.configuracionService = configuracionService;
  }
  registrar() {
    electron.ipcMain.handle("cumplimiento-obtener-captcha", async () => {
      try {
        await this.cerrarPaginaActiva();
        const contexto = await BrowserManager.newContext();
        this.paginaActiva = await contexto.newPage();
        const captcha = await this.cumplimientoService.obtenerCaptcha(this.paginaActiva);
        return { success: true, data: captcha };
      } catch (error) {
        console.error("[CumplimientoHandler] obtener-captcha:", error);
        await this.cerrarPaginaActiva();
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error obteniendo captcha"
        };
      }
    });
    electron.ipcMain.handle("cumplimiento-obtener-opinion", async (_, data) => {
      try {
        const config = this.configuracionService.obtener();
        if (!config?.rfc) {
          return { success: false, error: "No hay RFC configurado. Ve a Configuración primero." };
        }
        const carpetaTemp = config.carpetaDescarga || electron.app.getPath("downloads");
        const tipoLogin = config.metodoAuth ?? "contrasena";
        const onProgreso = (mensaje) => {
          electron.BrowserWindow.getAllWindows()[0]?.webContents.send("progreso-cumplimiento", mensaje);
        };
        let opinion;
        if (tipoLogin === "efirma") {
          await this.cerrarPaginaActiva();
          const contexto = await BrowserManager.newContext();
          this.paginaActiva = await contexto.newPage();
          opinion = await this.cumplimientoService.loginFielYObtenerOpinion(
            this.paginaActiva,
            carpetaTemp,
            config.rutaCer ?? "",
            config.rutaKey ?? "",
            config.contrasenaFiel ?? "",
            onProgreso
          );
        } else {
          if (!this.paginaActiva || this.paginaActiva.isClosed()) {
            return { success: false, error: "La sesión expiró. Recarga el captcha e intenta de nuevo." };
          }
          if (!data.captcha?.trim()) {
            return { success: false, error: "El captcha es requerido." };
          }
          opinion = await this.cumplimientoService.loginCiecYObtenerOpinion(
            this.paginaActiva,
            carpetaTemp,
            config.rfc,
            config.contrasena ?? "",
            data.captcha,
            onProgreso
          );
        }
        return { success: true, data: opinion };
      } catch (error) {
        console.error("[CumplimientoHandler] obtener-opinion:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error obteniendo opinión"
        };
      } finally {
        await this.cerrarPaginaActiva();
      }
    });
    electron.ipcMain.handle("cumplimiento-cerrar-sesion", async () => {
      await this.cerrarPaginaActiva();
      return { success: true };
    });
  }
  async cerrarPaginaActiva() {
    if (this.paginaActiva && !this.paginaActiva.isClosed()) {
      await this.paginaActiva.close().catch(() => null);
    }
    this.paginaActiva = null;
  }
}
class DescargaPendienteRepository {
  constructor(db) {
    this.db = db;
  }
  get tabla() {
    return ProfileManager.getTablaPendientes();
  }
  insertar(pendiente) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ${this.tabla}
        (uuid, rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor,
         fecha_emision, total, tipo_comprobante, estado, url_descarga,
         tipo_descarga, error, intentos, fecha_fallo)
      VALUES
        (@uuid, @rfc_emisor, @nombre_emisor, @rfc_receptor, @nombre_receptor,
         @fecha_emision, @total, @tipo_comprobante, @estado, @url_descarga,
         @tipo_descarga, @error,
         COALESCE((SELECT intentos + 1 FROM ${this.tabla} WHERE uuid = @uuid), 1),
         datetime('now'))
    `);
    stmt.run(pendiente);
  }
  obtenerTodas() {
    return this.db.prepare(`SELECT * FROM ${this.tabla} ORDER BY fecha_fallo DESC`).all();
  }
  eliminar(uuid) {
    this.db.prepare(`DELETE FROM ${this.tabla} WHERE uuid = ?`).run(uuid);
  }
  limpiar() {
    this.db.prepare(`DELETE FROM ${this.tabla}`).run();
  }
  contar() {
    const row = this.db.prepare(`SELECT COUNT(*) as total FROM ${this.tabla}`).get();
    return row.total;
  }
}
class ConciliacionRepository {
  constructor(db) {
    this.db = db;
  }
  get tabla() {
    return ProfileManager.getTablaConciliaciones();
  }
  insertar(c) {
    this.db.prepare(`
      INSERT INTO ${this.tabla}
        (tipo, ejercicio, periodo, total_sat, total_local, descargadas, actualizadas, errores)
      VALUES
        (@tipo, @ejercicio, @periodo, @total_sat, @total_local, @descargadas, @actualizadas, @errores)
    `).run(c);
  }
  obtenerUltima(tipo, ejercicio, periodo) {
    return this.db.prepare(`
      SELECT * FROM ${this.tabla}
      WHERE tipo = ? AND ejercicio = ? AND periodo = ?
      ORDER BY fecha_conciliacion DESC
      LIMIT 1
    `).get(tipo, ejercicio, periodo);
  }
  obtenerHistorial(limite = 20) {
    return this.db.prepare(`
      SELECT * FROM ${this.tabla}
      ORDER BY fecha_conciliacion DESC
      LIMIT ?
    `).all(limite);
  }
}
const MAX_REINTENTOS = 3;
const ESPERA_ENTRE_REINTENTOS_MS = 5e3;
class SatAuthService {
  context = null;
  paginaLogin = null;
  async getContext() {
    if (!this.context) {
      this.context = await BrowserManager.newContext();
    }
    return this.context;
  }
  async obtenerCaptcha() {
    if (this.paginaLogin) {
      await this.paginaLogin.close().catch(() => null);
      this.paginaLogin = null;
    }
    const context = await this.getContext();
    this.paginaLogin = await context.newPage();
    await this.paginaLogin.goto("https://portalcfdi.facturaelectronica.sat.gob.mx/");
    await this.paginaLogin.waitForSelector("#divCaptcha", { timeout: 15e3 });
    const imagenBase64 = await this.paginaLogin.$eval(
      "#divCaptcha img",
      (img) => img.src
    );
    return { imagenBase64 };
  }
  async loginConContrasena(rfc, password, captcha) {
    if (!this.paginaLogin) {
      throw new Error("Primero debes cargar el captcha");
    }
    const page = this.paginaLogin;
    this.paginaLogin = null;
    await page.fill("#rfc", rfc);
    await page.fill("#password", password);
    await page.fill("#userCaptcha", captcha.toUpperCase());
    await this.intentarLogin(page, () => page.click("#submit", { timeout: 9e4 }), "contrasena");
    return page;
  }
  async loginConEfirma(rutaCer, rutaKey, contrasenaFiel) {
    const context = await this.getContext();
    const page = this.paginaLogin ?? await context.newPage();
    this.paginaLogin = null;
    if (!page.url().includes("portalcfdi")) {
      await page.goto("https://portalcfdi.facturaelectronica.sat.gob.mx/");
    }
    await page.waitForSelector("#buttonFiel", { timeout: 15e3 });
    await page.click("#buttonFiel");
    await page.waitForSelector("#fileCertificate", { timeout: 1e4 });
    await page.setInputFiles("#fileCertificate", rutaCer);
    await page.setInputFiles("#filePrivateKey", rutaKey);
    await page.fill("#privateKeyPassword", contrasenaFiel);
    await this.intentarLogin(page, () => page.click("#submit", { timeout: 9e4 }), "efirma");
    return page;
  }
  async cerrarSesion() {
    if (this.paginaLogin) {
      await this.paginaLogin.close().catch(() => null);
      this.paginaLogin = null;
    }
    if (this.context) {
      await this.context.close().catch(() => null);
      this.context = null;
    }
    await BrowserManager.cerrar();
  }
  async intentarLogin(page, accion, metodoAuth, intento = 1) {
    try {
      await this.esperarLoginExitoso(page, accion);
    } catch (error) {
      const esTimeout = error.message?.includes("Timeout") || error.message?.includes("timeout");
      const esCaptchaInvalido = error.message?.includes("CAPTCHA_INVALIDO");
      const esSaturado = error.message?.includes("SAT_SATURADO");
      if (esCaptchaInvalido || esSaturado) throw error;
      if (esTimeout && metodoAuth === "contrasena") {
        throw new Error("SAT_TIMEOUT");
      }
      if (esTimeout && intento < MAX_REINTENTOS) {
        console.log(`Login timeout (intento ${intento}/${MAX_REINTENTOS}), reintentando en ${ESPERA_ENTRE_REINTENTOS_MS / 1e3}s...`);
        await page.waitForTimeout(ESPERA_ENTRE_REINTENTOS_MS);
        await page.goto("https://portalcfdi.facturaelectronica.sat.gob.mx/");
        await page.waitForSelector("#divCaptcha", { timeout: 15e3 });
        return this.intentarLogin(page, accion, metodoAuth, intento + 1);
      }
      if (esTimeout) throw new Error("SAT_TIMEOUT");
      throw error;
    }
  }
  async esperarLoginExitoso(page, accion) {
    await Promise.all([
      page.waitForNavigation({ timeout: 9e4 }).catch(() => null),
      accion()
    ]);
    await page.waitForTimeout(4e3);
    const url = page.url();
    console.log("URL después de login:", url);
    const esPaginaError = await page.$("text=Ha ocurrido un error al procesar").catch(() => null);
    if (esPaginaError) throw new Error("SAT_SATURADO");
    const errorCaptcha = await page.$("#divCapError, .alert-danger, .mensaje-error").catch(() => null);
    if (errorCaptcha) {
      const textoError = await errorCaptcha.textContent().catch(() => "");
      throw new Error(`CAPTCHA_INVALIDO: ${textoError?.trim()}`);
    }
    const llegamosAlPortal = url.includes("portalcfdi.facturaelectronica.sat.gob.mx") && !url.includes("login") && !url.includes("Login");
    if (!llegamosAlPortal) {
      const mensajeError = await page.$eval(
        '.alert, .error, [class*="error"], [class*="Error"]',
        (el) => el.textContent?.trim()
      ).catch(() => null);
      throw new Error(mensajeError || "Login fallido: no se pudo acceder al portal");
    }
    console.log("Login exitoso");
  }
  async logout(page) {
    try {
      await page.click("#salir");
    } finally {
      await page.close();
    }
  }
}
class SatBusquedaService {
  async buscarPorParametros(page, params, onProgreso) {
    if (params.buscarPor === "folio") {
      return this.buscarEnPagina(page, params);
    }
    if (params.tipo === "recibidas") {
      return this.buscarRecibidasPorMes(page, params, onProgreso);
    }
    return this.buscarEnPagina(page, params);
  }
  async buscarRecibidasPorMes(page, params, onProgreso) {
    const meses = this.dividirEnMeses(params.fechaInicio, params.fechaFin);
    const [dI, mI, aI] = params.fechaInicio.split("/").map(Number);
    const [dF, mF, aF] = params.fechaFin.split("/").map(Number);
    const fechaMin = new Date(aI, mI - 1, dI, 0, 0, 0);
    const fechaMax = new Date(aF, mF - 1, dF, 23, 59, 59);
    const todas = [];
    for (let i = 0; i < meses.length; i++) {
      onProgreso?.(i + 1, meses.length);
      const paramsMes = { ...params, fechaInicio: meses[i].inicio, fechaFin: meses[i].fin };
      const filas = await this.buscarEnPagina(page, paramsMes);
      const filtradas = filas.filter((f) => {
        const fechaFactura = new Date(f.fecha_emision.replace(" ", "T"));
        return fechaFactura >= fechaMin && fechaFactura <= fechaMax;
      });
      todas.push(...filtradas);
      console.log(`Mes ${i + 1}/${meses.length}: ${filtradas.length} facturas`);
    }
    return todas;
  }
  async buscarEnPagina(page, params) {
    const urlConsulta = params.tipo === "recibidas" ? "https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaReceptor.aspx" : "https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaEmisor.aspx";
    await page.goto(urlConsulta);
    await page.waitForSelector("#ctl00_MainContent_BtnBusqueda", { timeout: 15e3 });
    if (params.buscarPor === "folio") {
      await page.click("#ctl00_MainContent_RdoFolioFiscal");
      await page.waitForTimeout(1e3);
      await page.fill("#ctl00_MainContent_TxtUUID", params.folioFiscal);
    } else {
      await page.click("#ctl00_MainContent_RdoFechas");
      await page.waitForTimeout(1500);
      const [diaI, mesI, anioI] = params.fechaInicio.split("/");
      if (params.tipo === "recibidas") {
        await page.selectOption("#DdlAnio", anioI);
        await page.waitForTimeout(500);
        await page.selectOption("#ctl00_MainContent_CldFecha_DdlMes", String(parseInt(mesI)));
        await page.waitForTimeout(300);
        await page.selectOption("#ctl00_MainContent_CldFecha_DdlDia", String(parseInt(diaI)));
      } else {
        const [diaF, mesF, anioF] = params.fechaFin.split("/");
        await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (el) el.removeAttribute("disabled");
        }, "ctl00_MainContent_CldFechaInicial2_Calendario_text");
        await page.fill("#ctl00_MainContent_CldFechaInicial2_Calendario_text", `${diaI}/${mesI}/${anioI}`);
        await page.waitForTimeout(300);
        await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (el) el.removeAttribute("disabled");
        }, "ctl00_MainContent_CldFechaFinal2_Calendario_text");
        await page.fill("#ctl00_MainContent_CldFechaFinal2_Calendario_text", `${diaF}/${mesF}/${anioF}`);
        await page.waitForTimeout(300);
        await page.selectOption("#ctl00_MainContent_CldFechaFinal2_DdlHora", "23");
        await page.selectOption("#ctl00_MainContent_CldFechaFinal2_DdlMinuto", "59");
        await page.selectOption("#ctl00_MainContent_CldFechaFinal2_DdlSegundo", "59");
      }
    }
    if (params.rfcTercero) {
      await page.fill("#ctl00_MainContent_TxtRfcReceptor", params.rfcTercero);
    }
    if (params.estadoComprobante) {
      const valorEstado = params.estadoComprobante === "cancelado" ? "0" : "1";
      await page.selectOption("#ctl00_MainContent_DdlEstadoComprobante", valorEstado);
    }
    await page.click("#ctl00_MainContent_BtnBusqueda");
    await page.waitForTimeout(6e3);
    const sinResultados = await page.$("#ctl00_MainContent_PnlNoResultados");
    if (sinResultados && await sinResultados.isVisible()) return [];
    return page.$$eval(
      "#ctl00_MainContent_tblResult tbody tr:not(:first-child)",
      (filas) => filas.map((fila) => {
        const celdas = fila.querySelectorAll("td");
        if (celdas.length < 17) return null;
        const checkbox = fila.querySelector("input.ListaFolios");
        const btnDescarga = fila.querySelector("#BtnDescarga");
        const getText = (idx) => celdas[idx]?.textContent?.trim() || "";
        const onclick = btnDescarga?.getAttribute("onclick") || "";
        const match = onclick.match(/RecuperaCfdi\.aspx\?Datos=[^']+/);
        const urlDescarga = match ? match[0] : "";
        const totalStr = getText(16).replace("$", "").replace(/,/g, "").trim();
        const tipoTexto = getText(17).toLowerCase();
        let tipo = "I";
        if (tipoTexto.includes("egreso")) tipo = "E";
        else if (tipoTexto.includes("traslado")) tipo = "T";
        else if (tipoTexto.includes("nómina") || tipoTexto.includes("nomina")) tipo = "N";
        else if (tipoTexto.includes("pago")) tipo = "P";
        return {
          uuid: checkbox?.value || getText(8),
          rfc_emisor: getText(9),
          nombre_emisor: getText(10),
          rfc_receptor: getText(11),
          nombre_receptor: getText(12),
          fecha_emision: getText(13),
          total: parseFloat(totalStr) || 0,
          tipo_comprobante: tipo,
          estado: getText(19).toLowerCase().includes("vigente") ? "vigente" : "cancelado",
          urlDescarga
        };
      }).filter(Boolean)
    );
  }
  dividirEnMeses(fechaInicio, fechaFin) {
    const [_diaI, mesI, anioI] = fechaInicio.split("/").map(Number);
    const [_diaF, mesF, anioF] = fechaFin.split("/").map(Number);
    const meses = [];
    let anio = anioI;
    let mes = mesI;
    while (anio < anioF || anio === anioF && mes <= mesF) {
      const ultimoDia = new Date(anio, mes, 0).getDate();
      const inicio = anio === anioI && mes === mesI ? fechaInicio : `01/${String(mes).padStart(2, "0")}/${anio}`;
      const fin = anio === anioF && mes === mesF ? fechaFin : `${ultimoDia}/${String(mes).padStart(2, "0")}/${anio}`;
      meses.push({ inicio, fin });
      mes++;
      if (mes > 12) {
        mes = 1;
        anio++;
      }
    }
    return meses;
  }
}
class SatDescargaService {
  LOTE_SIZE = 10;
  async descargarEnLote(page, filas, carpetaTemp, onProgreso) {
    const exitosas = [];
    const errores = [];
    const context = page.context();
    const cookies = await context.cookies();
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const referer = page.url();
    let procesadas = 0;
    for (let i = 0; i < filas.length; i += this.LOTE_SIZE) {
      const lote = filas.slice(i, i + this.LOTE_SIZE);
      const resultados = await Promise.all(
        lote.map((fila) => this.descargarUnoConAxios(fila, carpetaTemp, cookieString, userAgent, referer))
      );
      for (const r of resultados) {
        if (r) exitosas.push(r);
        else if (lote[resultados.indexOf(r)]) {
          const fila = lote[resultados.indexOf(r)];
          errores.push({ uuid: fila.uuid, error: "Descarga fallida", fila });
        }
      }
      procesadas += lote.length;
      onProgreso?.(procesadas, filas.length, lote[lote.length - 1]?.uuid || "");
    }
    return { exitosas, errores };
  }
  async descargarUnoConPlaywright(page, urlRelativa, uuid, carpetaTemp) {
    try {
      const urlCompleta = `https://portalcfdi.facturaelectronica.sat.gob.mx/${urlRelativa}`;
      const rutaFinal = path.join(carpetaTemp, `${uuid}.xml`);
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 2e4 }),
        page.evaluate((url) => {
          window.location.href = url;
        }, urlCompleta)
      ]);
      const rutaTemp = await download.path();
      if (!rutaTemp) return null;
      fs__namespace.renameSync(rutaTemp, rutaFinal);
      return rutaFinal;
    } catch {
      return null;
    }
  }
  async descargarUnoConAxios(fila, carpetaTemp, cookieString, userAgent, referer) {
    if (!fila.urlDescarga) return null;
    try {
      const urlCompleta = `https://portalcfdi.facturaelectronica.sat.gob.mx/${fila.urlDescarga}`;
      const rutaTemp = path.join(carpetaTemp, `${fila.uuid}.xml`);
      const response = await axios({
        method: "get",
        url: urlCompleta,
        headers: {
          Cookie: cookieString,
          "User-Agent": userAgent,
          Referer: referer,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        timeout: 15e3,
        responseType: "text",
        httpsAgent: new (require("https")).Agent({ rejectUnauthorized: false })
      });
      if (!response.data.includes("<?xml")) return null;
      fs__namespace.writeFileSync(rutaTemp, response.data);
      return {
        rutaTemp,
        meta: {
          uuid: fila.uuid,
          rfc_emisor: fila.rfc_emisor,
          nombre_emisor: fila.nombre_emisor,
          rfc_receptor: fila.rfc_receptor,
          nombre_receptor: fila.nombre_receptor,
          fecha_emision: fila.fecha_emision,
          total: fila.total,
          tipo_comprobante: fila.tipo_comprobante,
          estado: fila.estado,
          tipo_descarga: fila.tipo_descarga
        }
      };
    } catch (err) {
      console.error(`Fallo descarga ${fila.uuid}:`, err.message);
      return null;
    }
  }
}
class NominaComplementoRepository {
  constructor(db) {
    this.db = db;
  }
  get tabla() {
    return ProfileManager.getTablaNominaComplemento();
  }
  insertar(nomina) {
    this.db.prepare(`
      INSERT OR IGNORE INTO ${this.tabla}
        (uuid_cfdi, tipo_nomina, fecha_pago, fecha_inicial_pago, fecha_final_pago,
         num_dias_pagados, total_percepciones, total_deducciones, total_otros_pagos,
         curp, num_empleado, departamento, puesto, tipo_regimen, tipo_contrato,
         periodicidad_pago, salario_diario_integrado,
         percepciones, deducciones, otros_pagos, incapacidades)
      VALUES
        (@uuid_cfdi, @tipo_nomina, @fecha_pago, @fecha_inicial_pago, @fecha_final_pago,
         @num_dias_pagados, @total_percepciones, @total_deducciones, @total_otros_pagos,
         @curp, @num_empleado, @departamento, @puesto, @tipo_regimen, @tipo_contrato,
         @periodicidad_pago, @salario_diario_integrado,
         @percepciones, @deducciones, @otros_pagos, @incapacidades)
    `).run({
      tipo_nomina: null,
      fecha_pago: null,
      fecha_inicial_pago: null,
      fecha_final_pago: null,
      num_dias_pagados: null,
      total_percepciones: null,
      total_deducciones: null,
      total_otros_pagos: null,
      curp: null,
      num_empleado: null,
      departamento: null,
      puesto: null,
      tipo_regimen: null,
      tipo_contrato: null,
      periodicidad_pago: null,
      salario_diario_integrado: null,
      percepciones: null,
      deducciones: null,
      otros_pagos: null,
      incapacidades: null,
      ...nomina
    });
  }
  obtenerPorUuid(uuid_cfdi) {
    return this.db.prepare(`SELECT * FROM ${this.tabla} WHERE uuid_cfdi = ?`).get(uuid_cfdi);
  }
  eliminar(uuid_cfdi) {
    this.db.prepare(`DELETE FROM ${this.tabla} WHERE uuid_cfdi = ?`).run(uuid_cfdi);
  }
}
class XmlParserService {
  extraerCampos(rutaXml) {
    try {
      const contenido = fs__namespace.readFileSync(rutaXml, "utf-8");
      const parser = new xmldom.DOMParser();
      const doc = parser.parseFromString(contenido, "text/xml");
      const ns = "http://www.sat.gob.mx/cfd/4";
      const nsTfd = "http://www.sat.gob.mx/TimbreFiscalDigital";
      const cfdi = doc.getElementsByTagNameNS(ns, "Comprobante")[0] || doc.documentElement;
      const tfd = doc.getElementsByTagNameNS(nsTfd, "TimbreFiscalDigital")[0] || null;
      const cfdiRelacionado = doc.getElementsByTagNameNS(ns, "CfdiRelacionado")[0] || null;
      const todosLosImpuestos = doc.getElementsByTagNameNS(ns, "Impuestos");
      const impuestosEl = todosLosImpuestos.length > 0 ? todosLosImpuestos[todosLosImpuestos.length - 1] : null;
      const emisor = doc.getElementsByTagNameNS(ns, "Emisor")[0] || null;
      const receptor = doc.getElementsByTagNameNS(ns, "Receptor")[0] || null;
      const getAttr = (el, attr) => el?.getAttribute(attr) || "";
      const getFloat = (el, attr) => parseFloat(el?.getAttribute(attr) || "0") || 0;
      const tipoTexto = getAttr(cfdi, "TipoDeComprobante");
      const base = {
        uuid: getAttr(tfd, "UUID"),
        version: getAttr(cfdi, "Version"),
        serie: getAttr(cfdi, "Serie"),
        folio: getAttr(cfdi, "Folio"),
        fecha_emision: getAttr(cfdi, "Fecha"),
        forma_pago: getAttr(cfdi, "FormaPago"),
        metodo_pago: getAttr(cfdi, "MetodoPago"),
        moneda: getAttr(cfdi, "Moneda"),
        tipo_cambio: getFloat(cfdi, "TipoCambio"),
        descuento: getFloat(cfdi, "Descuento"),
        subtotal: getFloat(cfdi, "SubTotal"),
        total: getFloat(cfdi, "Total"),
        tipo_comprobante: tipoTexto,
        rfc_emisor: getAttr(emisor, "Rfc"),
        nombre_emisor: getAttr(emisor, "Nombre"),
        rfc_receptor: getAttr(receptor, "Rfc"),
        nombre_receptor: getAttr(receptor, "Nombre"),
        fecha_timbrado: getAttr(tfd, "FechaTimbrado"),
        rfc_pac: getAttr(tfd, "RfcProvCertif"),
        folio_sustitucion: getAttr(cfdiRelacionado, "UUID"),
        total_impuestos_trasladados: getFloat(impuestosEl, "TotalImpuestosTrasladados"),
        total_impuestos_retenidos: getFloat(impuestosEl, "TotalImpuestosRetenidos"),
        regimen_fiscal_emisor: getAttr(emisor, "RegimenFiscal"),
        regimen_fiscal_receptor: getAttr(receptor, "RegimenFiscal"),
        uso_cfdi: getAttr(receptor, "UsoCFDI")
      };
      if (tipoTexto === "P") {
        return { ...base, complementoPago: this.extraerComplementoPago(doc) };
      }
      if (tipoTexto === "N") {
        return { ...base, complementoNomina: this.extraerComplementoNomina(doc) };
      }
      return base;
    } catch (err) {
      console.error("Error extrayendo campos XML:", err);
      return {};
    }
  }
  extraerComplementoPago(doc) {
    try {
      const nsPago = "http://www.sat.gob.mx/Pagos20";
      const pagoEl = doc.getElementsByTagNameNS(nsPago, "Pago")[0] || null;
      if (!pagoEl) return null;
      const getAttr = (el, attr) => el?.getAttribute(attr) || "";
      const getFloat = (el, attr) => parseFloat(el?.getAttribute(attr) || "0") || 0;
      const getInt = (el, attr) => parseInt(el?.getAttribute(attr) || "0", 10) || 0;
      const doctosEl = pagoEl.getElementsByTagNameNS(nsPago, "DoctoRelacionado");
      const documentos = Array.from({ length: doctosEl.length }, (_, i) => {
        const d = doctosEl[i];
        return {
          id_documento: getAttr(d, "IdDocumento"),
          serie: getAttr(d, "Serie"),
          folio: getAttr(d, "Folio"),
          moneda_dr: getAttr(d, "MonedaDR"),
          tipo_cambio_dr: getFloat(d, "TipoCambioDR"),
          metodo_pago_dr: getAttr(d, "MetodoDePagoDR"),
          num_parcialidad: getInt(d, "NumParcialidad"),
          imp_saldo_anterior: getFloat(d, "ImpSaldoAnterior"),
          imp_pagado: getFloat(d, "ImpPagado"),
          imp_saldo_insoluto: getFloat(d, "ImpSaldoInsoluto")
        };
      });
      return {
        fecha_pago: getAttr(pagoEl, "FechaPago"),
        forma_pago_p: getAttr(pagoEl, "FormaDePagoP"),
        moneda_p: getAttr(pagoEl, "MonedaP"),
        tipo_cambio_p: getFloat(pagoEl, "TipoCambioP"),
        monto: getFloat(pagoEl, "Monto"),
        documentos
      };
    } catch (err) {
      console.error("Error extrayendo complemento de pago:", err);
      return null;
    }
  }
  extraerComplementoNomina(doc) {
    try {
      const nsNomina = "http://www.sat.gob.mx/nomina12";
      const nominaEl = doc.getElementsByTagNameNS(nsNomina, "Nomina")[0] || null;
      if (!nominaEl) return null;
      const getAttr = (el, attr) => el?.getAttribute(attr) || "";
      const getFloat = (el, attr) => parseFloat(el?.getAttribute(attr) || "0") || 0;
      const getInt = (el, attr) => parseInt(el?.getAttribute(attr) || "0", 10) || 0;
      const receptorEl = nominaEl.getElementsByTagNameNS(nsNomina, "Receptor")[0] || null;
      const percepcionesEls = nominaEl.getElementsByTagNameNS(nsNomina, "Percepcion");
      const percepciones = Array.from({ length: percepcionesEls.length }, (_, i) => {
        const p = percepcionesEls[i];
        return {
          tipo: getAttr(p, "TipoPercepcion"),
          clave: getAttr(p, "Clave"),
          concepto: getAttr(p, "Concepto"),
          importe_gravado: getFloat(p, "ImporteGravado"),
          importe_exento: getFloat(p, "ImporteExento")
        };
      });
      const deduccionesEls = nominaEl.getElementsByTagNameNS(nsNomina, "Deduccion");
      const deducciones = Array.from({ length: deduccionesEls.length }, (_, i) => {
        const d = deduccionesEls[i];
        return {
          tipo: getAttr(d, "TipoDeduccion"),
          clave: getAttr(d, "Clave"),
          concepto: getAttr(d, "Concepto"),
          importe: getFloat(d, "Importe")
        };
      });
      const otrosPagosEls = nominaEl.getElementsByTagNameNS(nsNomina, "OtroPago");
      const otros_pagos = Array.from({ length: otrosPagosEls.length }, (_, i) => {
        const o = otrosPagosEls[i];
        return {
          tipo: getAttr(o, "TipoOtroPago"),
          clave: getAttr(o, "Clave"),
          concepto: getAttr(o, "Concepto"),
          importe: getFloat(o, "Importe")
        };
      });
      const incapacidadesEls = nominaEl.getElementsByTagNameNS(nsNomina, "Incapacidad");
      const incapacidades = Array.from({ length: incapacidadesEls.length }, (_, i) => {
        const inc = incapacidadesEls[i];
        return {
          dias: getInt(inc, "DiasIncapacidad"),
          tipo: getAttr(inc, "TipoIncapacidad"),
          importe: getFloat(inc, "ImporteMonetario")
        };
      });
      return {
        tipo_nomina: getAttr(nominaEl, "TipoNomina"),
        fecha_pago: getAttr(nominaEl, "FechaPago"),
        fecha_inicial_pago: getAttr(nominaEl, "FechaInicialPago"),
        fecha_final_pago: getAttr(nominaEl, "FechaFinalPago"),
        num_dias_pagados: getFloat(nominaEl, "NumDiasPagados"),
        total_percepciones: getFloat(nominaEl, "TotalPercepciones"),
        total_deducciones: getFloat(nominaEl, "TotalDeducciones"),
        total_otros_pagos: getFloat(nominaEl, "TotalOtrosPagos"),
        curp: getAttr(receptorEl, "Curp"),
        num_empleado: getAttr(receptorEl, "NumEmpleado"),
        departamento: getAttr(receptorEl, "Departamento"),
        puesto: getAttr(receptorEl, "Puesto"),
        tipo_regimen: getAttr(receptorEl, "TipoRegimen"),
        tipo_contrato: getAttr(receptorEl, "TipoContrato"),
        periodicidad_pago: getAttr(receptorEl, "PeriodicidadPago"),
        salario_diario_integrado: getFloat(receptorEl, "SalarioDiarioIntegrado"),
        percepciones,
        deducciones,
        otros_pagos,
        incapacidades
      };
    } catch (err) {
      console.error("Error extrayendo complemento de nómina:", err);
      return null;
    }
  }
}
const XmlParserService$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  XmlParserService
}, Symbol.toStringTag, { value: "Module" }));
const ESTRUCTURA_DEFAULT = [
  { id: "contribuyente", label: "Contribuyente", activo: true },
  { id: "ejercicio", label: "Ejercicio", activo: true },
  { id: "periodo", label: "Periodo", activo: false },
  { id: "emisor", label: "Emisor", activo: false },
  { id: "receptor", label: "Receptor", activo: false }
];
const CONFIG_NOMBRE_DEFAULT = {
  rfcEmisor: true,
  rfcReceptor: false
};
class RutaArchivoService {
  /**
   * Construye la ruta absoluta destino para un XML dado.
   * Crea las carpetas intermedias si no existen.
   * Lanza error descriptivo si faltan carpetas base en el perfil.
   */
  construirRutaXml(params) {
    const perfil = ProfileManager.getPerfilActivo();
    if (!perfil) throw new Error("No hay perfil activo");
    const esEmitida = params.tipo_descarga === "emitida";
    const carpetaBase = esEmitida ? perfil.carpeta_emitidos : perfil.carpeta_recibidos;
    if (!carpetaBase) {
      const tipo = esEmitida ? "emitidos" : "recibidos";
      throw new Error(
        `La carpeta de ${tipo} no está configurada. Ve a Configuración > PDF para establecer la ruta.`
      );
    }
    const estructura = this.parsearEstructura(
      esEmitida ? perfil.estructura_emitidos : perfil.estructura_recibidos
    );
    const configNombre = this.parsearConfigNombre(perfil.config_nombre_archivo);
    const fechaStr = params.fecha_emision?.replace("T", " ").split("+")[0].split("-06")[0] ?? "";
    const fecha = fechaStr ? new Date(fechaStr) : /* @__PURE__ */ new Date();
    const subcarpetas = estructura.filter((s) => s.activo).map((s) => this.resolverSlot(s.id, params, perfil.rfc, fecha));
    const carpetaDestino = path__namespace.join(carpetaBase, ...subcarpetas);
    fs__namespace.mkdirSync(carpetaDestino, { recursive: true });
    const segmentos = [];
    if (configNombre.rfcEmisor) segmentos.push(params.rfc_emisor);
    if (configNombre.rfcReceptor) segmentos.push(params.rfc_receptor);
    segmentos.push(params.uuid);
    const nombreArchivo = segmentos.join("_") + ".xml";
    return path__namespace.join(carpetaDestino, nombreArchivo);
  }
  resolverSlot(id, params, rfcActivo, fecha) {
    switch (id) {
      case "contribuyente":
        return rfcActivo;
      case "ejercicio":
        return isNaN(fecha.getTime()) ? "SIN_FECHA" : String(fecha.getFullYear());
      case "periodo":
        return isNaN(fecha.getTime()) ? "00" : String(fecha.getMonth() + 1).padStart(2, "0");
      case "emisor":
        return params.rfc_emisor;
      case "receptor":
        return params.rfc_receptor;
    }
  }
  parsearEstructura(json) {
    try {
      if (!json || json === "[]") return [...ESTRUCTURA_DEFAULT];
      return JSON.parse(json);
    } catch {
      return [...ESTRUCTURA_DEFAULT];
    }
  }
  parsearConfigNombre(json) {
    try {
      if (!json || json === "{}") return { ...CONFIG_NOMBRE_DEFAULT };
      return JSON.parse(json);
    } catch {
      return { ...CONFIG_NOMBRE_DEFAULT };
    }
  }
}
class CfdiGuardadoService {
  constructor(facturaRepository, pendienteRepository, db) {
    this.facturaRepository = facturaRepository;
    this.pendienteRepository = pendienteRepository;
    this.catalogoRepository = new CatalogoRepository(db);
    this.pagoComplementoRepository = new PagoComplementoRepository(db);
    this.nominaComplementoRepository = new NominaComplementoRepository(db);
  }
  xmlParser = new XmlParserService();
  rutaService = new RutaArchivoService();
  catalogoRepository;
  pagoComplementoRepository;
  nominaComplementoRepository;
  guardarDesdeRuta(rutaTemp, meta) {
    const rutaDestino = this.rutaService.construirRutaXml({
      uuid: meta.uuid,
      fecha_emision: meta.fecha_emision,
      rfc_emisor: meta.rfc_emisor,
      rfc_receptor: meta.rfc_receptor,
      tipo_descarga: meta.tipo_descarga
    });
    fs__namespace.copyFileSync(rutaTemp, rutaDestino);
    const camposXml = this.xmlParser.extraerCampos(rutaDestino);
    const { complementoPago, complementoNomina, ...camposSinComplemento } = camposXml;
    const yaExiste = this.facturaRepository.obtenerPorUuid(meta.uuid);
    if (!yaExiste) {
      this.facturaRepository.insertar({
        uuid: meta.uuid,
        fecha_emision: meta.fecha_emision,
        rfc_emisor: meta.rfc_emisor,
        nombre_emisor: meta.nombre_emisor,
        rfc_receptor: meta.rfc_receptor,
        nombre_receptor: meta.nombre_receptor,
        subtotal: meta.total,
        total: meta.total,
        tipo_comprobante: meta.tipo_comprobante,
        estado: meta.estado,
        xml: rutaDestino,
        tipo_descarga: meta.tipo_descarga,
        fecha_descarga: (/* @__PURE__ */ new Date()).toISOString(),
        ...camposSinComplemento
      });
    } else {
      this.facturaRepository.actualizar(meta.uuid, { xml: rutaDestino, ...camposSinComplemento });
    }
    if (meta.tipo_comprobante === "P" && complementoPago) {
      this.pagoComplementoRepository.insertar({
        uuid_rep: meta.uuid,
        fecha_pago: complementoPago.fecha_pago,
        forma_pago_p: complementoPago.forma_pago_p,
        moneda_p: complementoPago.moneda_p,
        tipo_cambio_p: complementoPago.tipo_cambio_p,
        monto: complementoPago.monto,
        documentos: JSON.stringify(complementoPago.documentos)
      });
    }
    if (meta.tipo_comprobante === "N" && complementoNomina) {
      this.nominaComplementoRepository.insertar({
        uuid_cfdi: meta.uuid,
        tipo_nomina: complementoNomina.tipo_nomina,
        fecha_pago: complementoNomina.fecha_pago,
        fecha_inicial_pago: complementoNomina.fecha_inicial_pago,
        fecha_final_pago: complementoNomina.fecha_final_pago,
        num_dias_pagados: complementoNomina.num_dias_pagados,
        total_percepciones: complementoNomina.total_percepciones,
        total_deducciones: complementoNomina.total_deducciones,
        total_otros_pagos: complementoNomina.total_otros_pagos,
        curp: complementoNomina.curp,
        num_empleado: complementoNomina.num_empleado,
        departamento: complementoNomina.departamento,
        puesto: complementoNomina.puesto,
        tipo_regimen: complementoNomina.tipo_regimen,
        tipo_contrato: complementoNomina.tipo_contrato,
        periodicidad_pago: complementoNomina.periodicidad_pago,
        salario_diario_integrado: complementoNomina.salario_diario_integrado,
        percepciones: JSON.stringify(complementoNomina.percepciones),
        deducciones: JSON.stringify(complementoNomina.deducciones),
        otros_pagos: JSON.stringify(complementoNomina.otros_pagos),
        incapacidades: JSON.stringify(complementoNomina.incapacidades)
      });
    }
    this.pendienteRepository.eliminar(meta.uuid);
  }
  importarDesdeRutaLocal(rutaOrigen) {
    const perfil = ProfileManager.getPerfilActivo();
    if (!perfil) throw new Error("No hay perfil activo");
    const camposXml = this.xmlParser.extraerCampos(rutaOrigen);
    if (!camposXml.uuid) throw new Error("No se encontró UUID en el XML");
    const perteneceAlPerfil = camposXml.rfc_emisor === perfil.rfc || camposXml.rfc_receptor === perfil.rfc;
    if (!perteneceAlPerfil) {
      throw new Error(`El XML no pertenece al contribuyente activo (${perfil.rfc})`);
    }
    const yaExiste = this.facturaRepository.obtenerPorUuid(camposXml.uuid);
    if (yaExiste) return "omitida";
    const tipoDes = camposXml.rfc_receptor === perfil.rfc ? "recibida" : "emitida";
    const rutaDestino = this.rutaService.construirRutaXml({
      uuid: camposXml.uuid,
      fecha_emision: camposXml.fecha_emision || "",
      rfc_emisor: camposXml.rfc_emisor || "",
      rfc_receptor: camposXml.rfc_receptor || "",
      tipo_descarga: tipoDes
    });
    fs__namespace.copyFileSync(rutaOrigen, rutaDestino);
    const { complementoPago, complementoNomina, ...camposSinComplemento } = camposXml;
    this.facturaRepository.insertar({
      uuid: camposXml.uuid,
      fecha_emision: camposXml.fecha_emision || "",
      rfc_emisor: camposXml.rfc_emisor || "",
      nombre_emisor: camposXml.nombre_emisor || "",
      rfc_receptor: camposXml.rfc_receptor || "",
      nombre_receptor: camposXml.nombre_receptor || "",
      subtotal: camposXml.subtotal || 0,
      total: camposXml.total || 0,
      tipo_comprobante: camposXml.tipo_comprobante || "I",
      estado: "vigente",
      xml: rutaDestino,
      tipo_descarga: tipoDes,
      fecha_descarga: (/* @__PURE__ */ new Date()).toISOString(),
      ...camposSinComplemento
    });
    if (camposXml.tipo_comprobante === "P" && complementoPago) {
      this.pagoComplementoRepository.insertar({
        uuid_rep: camposXml.uuid,
        fecha_pago: complementoPago.fecha_pago,
        forma_pago_p: complementoPago.forma_pago_p,
        moneda_p: complementoPago.moneda_p,
        tipo_cambio_p: complementoPago.tipo_cambio_p,
        monto: complementoPago.monto,
        documentos: JSON.stringify(complementoPago.documentos)
      });
    }
    if (camposXml.tipo_comprobante === "N" && complementoNomina) {
      this.nominaComplementoRepository.insertar({
        uuid_cfdi: camposXml.uuid,
        tipo_nomina: complementoNomina.tipo_nomina,
        fecha_pago: complementoNomina.fecha_pago,
        fecha_inicial_pago: complementoNomina.fecha_inicial_pago,
        fecha_final_pago: complementoNomina.fecha_final_pago,
        num_dias_pagados: complementoNomina.num_dias_pagados,
        total_percepciones: complementoNomina.total_percepciones,
        total_deducciones: complementoNomina.total_deducciones,
        total_otros_pagos: complementoNomina.total_otros_pagos,
        curp: complementoNomina.curp,
        num_empleado: complementoNomina.num_empleado,
        departamento: complementoNomina.departamento,
        puesto: complementoNomina.puesto,
        tipo_regimen: complementoNomina.tipo_regimen,
        tipo_contrato: complementoNomina.tipo_contrato,
        periodicidad_pago: complementoNomina.periodicidad_pago,
        salario_diario_integrado: complementoNomina.salario_diario_integrado,
        percepciones: JSON.stringify(complementoNomina.percepciones),
        deducciones: JSON.stringify(complementoNomina.deducciones),
        otros_pagos: JSON.stringify(complementoNomina.otros_pagos),
        incapacidades: JSON.stringify(complementoNomina.incapacidades)
      });
    }
    return "importada";
  }
  actualizarEstado(uuid, estado) {
    this.facturaRepository.actualizar(uuid, { estado });
  }
  guardarPendiente(meta, error) {
    this.pendienteRepository.insertar({
      uuid: meta.uuid,
      rfc_emisor: meta.rfc_emisor,
      nombre_emisor: meta.nombre_emisor,
      rfc_receptor: meta.rfc_receptor,
      nombre_receptor: meta.nombre_receptor,
      fecha_emision: meta.fecha_emision,
      total: meta.total,
      tipo_comprobante: meta.tipo_comprobante,
      estado: meta.estado,
      url_descarga: "",
      tipo_descarga: meta.tipo_descarga,
      error
    });
  }
  sincronizarCatalogos() {
    this.catalogoRepository.sincronizarTodos();
  }
}
class DescargaService {
  constructor(authService, busquedaService, descargaService, guardadoService, facturaRepository, pendienteRepository) {
    this.authService = authService;
    this.busquedaService = busquedaService;
    this.descargaService = descargaService;
    this.guardadoService = guardadoService;
    this.facturaRepository = facturaRepository;
    this.pendienteRepository = pendienteRepository;
  }
  async descargar(config, params, captcha, onProgreso) {
    const page = await this.login(config, captcha);
    const carpetaTemp = config.carpetaDescarga || electron.app.getPath("downloads");
    const tipoDes = params.tipo === "recibidas" ? "recibida" : "emitida";
    onProgreso?.({ etapa: "buscando" });
    const filas = await this.busquedaService.buscarPorParametros(
      page,
      params,
      (mesActual, totalMeses) => onProgreso?.({ etapa: "buscando", mesActual, totalMeses })
    );
    const filasConTipo = filas.map((f) => ({ ...f, tipo_descarga: tipoDes }));
    const { exitosas, errores: erroresDescarga } = await this.descargaService.descargarEnLote(
      page,
      filasConTipo,
      carpetaTemp,
      (descargadas, totalFacturas, uuid) => onProgreso?.({ etapa: "descargando", descargadas, totalFacturas, uuid })
    );
    let guardadas = 0;
    const errores = [];
    for (const { rutaTemp, meta } of exitosas) {
      try {
        this.guardadoService.guardarDesdeRuta(rutaTemp, meta);
        guardadas++;
      } catch (err) {
        errores.push({ uuid: meta.uuid, error: err.message });
      }
    }
    for (const e of erroresDescarga) {
      this.guardadoService.guardarPendiente({
        uuid: e.uuid,
        rfc_emisor: e.fila.rfc_emisor,
        nombre_emisor: e.fila.nombre_emisor,
        rfc_receptor: e.fila.rfc_receptor,
        nombre_receptor: e.fila.nombre_receptor,
        fecha_emision: e.fila.fecha_emision,
        total: e.fila.total,
        tipo_comprobante: e.fila.tipo_comprobante,
        estado: e.fila.estado,
        tipo_descarga: tipoDes
      }, e.error);
    }
    this.guardadoService.sincronizarCatalogos();
    onProgreso?.({ etapa: "completado", totalFacturas: guardadas });
    return { total: guardadas, errores: [...errores, ...erroresDescarga.map((e) => ({ uuid: e.uuid, error: e.error }))] };
  }
  async login(config, captcha) {
    if (config.metodoAuth === "contrasena") {
      return this.authService.loginConContrasena(config.rfc, config.contrasena, captcha);
    }
    return this.authService.loginConEfirma(config.rutaCer, config.rutaKey, config.contrasenaFiel);
  }
  obtenerFacturas() {
    return this.facturaRepository.obtenerTodas();
  }
  obtenerFacturaPorUuid(uuid) {
    return this.facturaRepository.obtenerPorUuid(uuid);
  }
  eliminarFactura(uuid) {
    return this.facturaRepository.eliminar(uuid);
  }
  obtenerDrillDown(rfc) {
    return this.facturaRepository.obtenerDrillDown(rfc);
  }
  obtenerPendientes() {
    return this.pendienteRepository.obtenerTodas();
  }
  contarPendientes() {
    return this.pendienteRepository.contar();
  }
  limpiarPendientes() {
    return this.pendienteRepository.limpiar();
  }
  obtenerFacturasPorTipo(tipoDescarga, filtros) {
    return this.facturaRepository.obtenerPorTipoDescarga(tipoDescarga, filtros);
  }
  obtenerConteos() {
    return this.facturaRepository.contarPorTipoDescarga();
  }
}
class PendientesService {
  constructor(authService, busquedaService, descargaService, guardadoService, pendienteRepository) {
    this.authService = authService;
    this.busquedaService = busquedaService;
    this.descargaService = descargaService;
    this.guardadoService = guardadoService;
    this.pendienteRepository = pendienteRepository;
  }
  async reintentar(config, captcha, onProgreso) {
    const pendientes = this.pendienteRepository.obtenerTodas();
    if (pendientes.length === 0) return { total: 0, errores: [] };
    const page = await this.login(config, captcha);
    const carpetaTemp = config.carpetaDescarga || electron.app.getPath("downloads");
    let guardadas = 0;
    const errores = [];
    for (let i = 0; i < pendientes.length; i++) {
      const pendiente = pendientes[i];
      onProgreso?.({
        etapa: "descargando",
        descargadas: i,
        totalFacturas: pendientes.length,
        uuid: pendiente.uuid
      });
      try {
        const tipoBusqueda = pendiente.tipo_descarga === "recibida" ? "recibidas" : "emitidas";
        const filas = await this.busquedaService.buscarEnPagina(page, {
          tipo: tipoBusqueda,
          buscarPor: "folio",
          folioFiscal: pendiente.uuid
        });
        if (!filas.length || !filas[0].urlDescarga) {
          errores.push({ uuid: pendiente.uuid, error: "No encontrado en el portal" });
          continue;
        }
        const rutaTemp = await this.descargaService.descargarUnoConPlaywright(
          page,
          filas[0].urlDescarga,
          pendiente.uuid,
          carpetaTemp
        );
        if (!rutaTemp) {
          errores.push({ uuid: pendiente.uuid, error: "No se pudo descargar el archivo" });
          continue;
        }
        this.guardadoService.guardarDesdeRuta(rutaTemp, {
          uuid: pendiente.uuid,
          rfc_emisor: pendiente.rfc_emisor,
          nombre_emisor: pendiente.nombre_emisor,
          rfc_receptor: pendiente.rfc_receptor,
          nombre_receptor: pendiente.nombre_receptor,
          fecha_emision: pendiente.fecha_emision,
          total: pendiente.total,
          tipo_comprobante: pendiente.tipo_comprobante,
          estado: pendiente.estado,
          tipo_descarga: pendiente.tipo_descarga
        });
        guardadas++;
      } catch (err) {
        errores.push({ uuid: pendiente.uuid, error: err.message });
      }
    }
    this.guardadoService.sincronizarCatalogos();
    onProgreso?.({ etapa: "completado", totalFacturas: guardadas });
    return { total: guardadas, errores };
  }
  async login(config, captcha) {
    if (config.metodoAuth === "contrasena") {
      return this.authService.loginConContrasena(config.rfc, config.contrasena, captcha);
    }
    return this.authService.loginConEfirma(config.rutaCer, config.rutaKey, config.contrasenaFiel);
  }
}
class ConciliacionService {
  constructor(authService, busquedaService, descargaService, guardadoService, facturaRepository, conciliacionRepository) {
    this.authService = authService;
    this.busquedaService = busquedaService;
    this.descargaService = descargaService;
    this.guardadoService = guardadoService;
    this.facturaRepository = facturaRepository;
    this.conciliacionRepository = conciliacionRepository;
  }
  async conciliar(config, params, onProgreso) {
    const mes = params.periodo.padStart(2, "0");
    const ultimoDia = new Date(parseInt(params.ejercicio), parseInt(mes), 0).getDate();
    const fechaInicio = `01/${mes}/${params.ejercicio}`;
    const fechaFin = `${ultimoDia}/${mes}/${params.ejercicio}`;
    const tipoDes = params.tipo === "recibidas" ? "recibida" : "emitida";
    const carpetaTemp = config.carpetaDescarga || electron.app.getPath("downloads");
    const page = await this.login(config, params.captcha);
    onProgreso?.({ etapa: "consultando" });
    const filasSat = await this.busquedaService.buscarEnPagina(page, {
      tipo: params.tipo,
      buscarPor: "fecha",
      fechaInicio,
      fechaFin
    });
    const totalSat = filasSat.length;
    onProgreso?.({ etapa: "comparando" });
    const faltantes = filasSat.filter((f) => !this.facturaRepository.obtenerPorUuid(f.uuid));
    const aActualizar = filasSat.filter((f) => {
      const local = this.facturaRepository.obtenerPorUuid(f.uuid);
      return local && local.estado === "vigente" && f.estado === "cancelado";
    });
    const totalLocal = totalSat - faltantes.length;
    let descargadas = 0;
    const errores = [];
    if (faltantes.length > 0) {
      onProgreso?.({ etapa: "descargando", descargadas: 0, totalFaltantes: faltantes.length });
      const filasConTipo = faltantes.map((f) => ({ ...f, tipo_descarga: tipoDes }));
      const { exitosas, errores: erroresDescarga } = await this.descargaService.descargarEnLote(
        page,
        filasConTipo,
        carpetaTemp,
        (desc, _total, _uuid) => onProgreso?.({ etapa: "descargando", descargadas: desc, totalFaltantes: faltantes.length })
      );
      for (const { rutaTemp, meta } of exitosas) {
        try {
          this.guardadoService.guardarDesdeRuta(rutaTemp, meta);
          descargadas++;
        } catch (err) {
          errores.push({ uuid: meta.uuid, error: err.message });
        }
      }
      for (const e of erroresDescarga) {
        errores.push({ uuid: e.uuid, error: e.error });
      }
    }
    let actualizadas = 0;
    if (aActualizar.length > 0) {
      onProgreso?.({ etapa: "actualizando" });
      for (const f of aActualizar) {
        try {
          this.guardadoService.actualizarEstado(f.uuid, "cancelado");
          actualizadas++;
        } catch (err) {
          errores.push({ uuid: f.uuid, error: err.message });
        }
      }
    }
    this.conciliacionRepository.insertar({
      tipo: params.tipo,
      ejercicio: params.ejercicio,
      periodo: params.periodo,
      total_sat: totalSat,
      total_local: totalLocal,
      descargadas,
      actualizadas,
      errores: errores.length
    });
    this.guardadoService.sincronizarCatalogos();
    onProgreso?.({ etapa: "completado" });
    return { totalSat, totalLocal, descargadas, actualizadas, errores };
  }
  async login(config, captcha) {
    if (config.metodoAuth === "contrasena") {
      return this.authService.loginConContrasena(config.rfc, config.contrasena, captcha);
    }
    return this.authService.loginConEfirma(config.rutaCer, config.rutaKey, config.contrasenaFiel);
  }
  obtenerUltima(tipo, ejercicio, periodo) {
    return this.conciliacionRepository.obtenerUltima(tipo, ejercicio, periodo);
  }
  obtenerHistorial() {
    return this.conciliacionRepository.obtenerHistorial();
  }
}
class UpdaterService {
  win;
  constructor(win) {
    this.win = win;
    electronUpdater.autoUpdater.autoDownload = false;
    electronUpdater.autoUpdater.autoInstallOnAppQuit = false;
  }
  iniciar() {
    this.registrarEventos();
    this.registrarHandlers();
    setTimeout(() => {
      electronUpdater.autoUpdater.checkForUpdates().catch((err) => {
        console.error("[UpdaterService] checkForUpdates falló:", err);
      });
    }, 3e3);
  }
  send(canal, payload) {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send(canal, payload);
    }
  }
  registrarEventos() {
    electronUpdater.autoUpdater.on("checking-for-update", () => {
      this.send("update-status", "checking");
    });
    electronUpdater.autoUpdater.on("update-available", () => {
      this.send("update-status", "available");
    });
    electronUpdater.autoUpdater.on("update-not-available", () => {
      this.send("update-status", "not-available");
    });
    electronUpdater.autoUpdater.on("download-progress", (p) => {
      this.send("update-progress", p.percent);
    });
    electronUpdater.autoUpdater.on("update-downloaded", () => {
      this.send("update-status", "downloaded");
    });
    electronUpdater.autoUpdater.on("error", (err) => {
      console.error("[UpdaterService] error:", err);
      this.send("update-status", "error");
    });
  }
  registrarHandlers() {
    electron.ipcMain.on("install-update", () => {
      electronUpdater.autoUpdater.quitAndInstall(false, true);
    });
    electron.ipcMain.on("postpone-update", () => {
      electron.app.quit();
    });
    electron.ipcMain.on("download-update", () => {
      electronUpdater.autoUpdater.downloadUpdate().catch((err) => {
        console.error("[UpdaterService] downloadUpdate falló:", err);
        this.send("update-status", "error");
      });
    });
  }
}
class LicenseHandler {
  service;
  constructor(db) {
    const repository = new LicenseRepository(db);
    this.service = new LicenseService(repository);
  }
  registrar() {
    electron.ipcMain.handle("obtener-licencia", async () => {
      try {
        const licencia = this.service.obtenerLicencia();
        return { success: true, licencia };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("obtener-estado-licencia", async () => {
      try {
        const estado = this.service.obtenerEstado();
        return { success: true, estado };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("validar-agregar-rfc", async () => {
      try {
        const validacion = this.service.validarAgregarRfc();
        return { success: true, ...validacion };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("validar-registrar-maquina", async () => {
      try {
        const validacion = this.service.validarRegistrarMaquina();
        return { success: true, ...validacion };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("validar-descarga-cfdi", async () => {
      try {
        const validacion = this.service.validarDescargaCfdi();
        return { success: true, ...validacion };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("incrementar-descarga-cfdi", async () => {
      try {
        const repository = new LicenseRepository(this.service.repository.db);
        repository.incrementarDescargasCfdi();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("validar-importacion-cfdi", async () => {
      try {
        const validacion = this.service.validarImportacionCfdi();
        return { success: true, ...validacion };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("incrementar-importacion-cfdi", async () => {
      try {
        const repository = new LicenseRepository(this.service.repository.db);
        repository.incrementarImportacionesCfdi();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("validar-consolidacion", async () => {
      try {
        const validacion = this.service.validarConsolidacion();
        return { success: true, ...validacion };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("incrementar-consolidacion", async () => {
      try {
        const repository = new LicenseRepository(this.service.repository.db);
        repository.incrementarConsolidaciones();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
}
const LOGIN_URL = "https://wwwmat.sat.gob.mx/app/seg/faces/pages/lanzador.jsf?url=/operacion/43824/reimprime-tus-acuses-del-rfc&tipoLogeo=c&target=principal&hostServer=https://wwwmat.sat.gob.mx";
const LOGIN_DOMAIN = "login.siat.sat.gob.mx";
const PORTAL_DOMAIN = "wwwmat.sat.gob.mx";
const PORTAL_REPORTE = "https://wwwmat.sat.gob.mx/operacion/43824/reimprime-tus-acuses-del-rfc";
class SatConstanciaService {
  async obtenerCaptcha(page) {
    await page.goto(LOGIN_URL, { waitUntil: "networkidle", timeout: 3e4 });
    await page.waitForURL(`**${LOGIN_DOMAIN}**`, { timeout: 2e4 });
    await page.waitForLoadState("networkidle");
    const captchaEl = await page.waitForSelector('img[src^="data:image"]', { timeout: 1e4 });
    const screenshot = await captchaEl.screenshot({ type: "png" });
    return { imagenBase64: `data:image/png;base64,${screenshot.toString("base64")}` };
  }
  async loginCiecYObtenerConstancia(page, carpetaTemp, rfc, password, captcha, onProgreso) {
    return this.ejecutarFlujoConstancia(
      page,
      carpetaTemp,
      () => this.llenarFormularioCiec(page, rfc, password, captcha),
      "CIEC",
      rfc,
      onProgreso
    );
  }
  async loginFielYObtenerConstancia(page, carpetaTemp, rfc, rutaCer, rutaKey, password, onProgreso) {
    return this.ejecutarFlujoConstancia(
      page,
      carpetaTemp,
      () => this.llenarFormularioFiel(page, rutaCer, rutaKey, password),
      "FIEL",
      rfc,
      onProgreso
    );
  }
  // ---------------------------------------------------------------------------
  async ejecutarFlujoConstancia(page, carpetaTemp, accionLogin, metodo, rfc, onProgreso) {
    try {
      onProgreso?.("Conectando con el SAT...");
      if (!page.url().includes(LOGIN_DOMAIN)) {
        await page.goto(LOGIN_URL, { waitUntil: "networkidle", timeout: 3e4 });
        await page.waitForURL(`**${LOGIN_DOMAIN}**`, { timeout: 2e4 });
      }
      onProgreso?.(`Iniciando sesión con ${metodo}...`);
      await accionLogin();
      await page.waitForURL("**", { timeout: 4e4 });
      console.log(`[SatConstanciaService] URL después de login: ${page.url()}`);
      onProgreso?.("Accediendo al portal de constancias...");
      await page.waitForURL(`**${PORTAL_DOMAIN}**`, { timeout: 4e4 });
      await page.waitForLoadState("networkidle", { timeout: 2e4 });
      if (!page.url().includes("/operacion/43824")) {
        await page.goto(PORTAL_REPORTE, { waitUntil: "networkidle", timeout: 3e4 });
      }
      if (page.url().includes("error.seg")) {
        throw new Error("El SAT rechazó el acceso al portal. Intenta de nuevo en unos minutos.");
      }
      onProgreso?.("Generando constancia...");
      const frame = await this.obtenerFrameConstancia(page);
      const boton = frame.locator('button:has-text("Generar Constancia"), input[value="Generar Constancia"]');
      await boton.waitFor({ state: "visible", timeout: 2e4 });
      onProgreso?.("Descargando PDF...");
      const rutaArchivo = await this.interceptarYDescargar(page, boton, carpetaTemp);
      const paginas = page.context().pages();
      for (const p of paginas) {
        if (p !== page) {
          await p.close().catch(() => null);
        }
      }
      return {
        rfc,
        fecha_emision: (/* @__PURE__ */ new Date()).toISOString(),
        rutaArchivo,
        descripcion: rutaArchivo ? "Constancia generada y descargada correctamente." : "No se pudo capturar el PDF automáticamente."
      };
    } catch (error) {
      console.error(`[SatConstanciaService] ${metodo}:`, error);
      return {
        rfc,
        fecha_emision: (/* @__PURE__ */ new Date()).toISOString(),
        descripcion: `Error: ${error.message || "Error desconocido"}`
      };
    }
  }
  /**
   * Registra el interceptor de ruta ANTES del clic para atrapar el PDF
   * cuando el botón abre el popup con IdcGeneraConstancia.jsf.
   * Cierra el popup automáticamente tras capturar el buffer.
   */
  interceptarYDescargar(page, boton, carpetaTemp) {
    return new Promise((resolve) => {
      let resuelto = false;
      let popupRef = null;
      const limpiar = () => {
        page.context().unroute("**IdcGeneraConstancia**").catch(() => null);
      };
      const timer = setTimeout(() => {
        limpiar();
        resolve(void 0);
      }, 3e4);
      page.context().route("**IdcGeneraConstancia**", async (route) => {
        try {
          const response = await route.fetch();
          const contentType = response.headers()["content-type"] ?? "";
          if (contentType.includes("pdf")) {
            const buffer = Buffer.from(await response.body());
            if (buffer.length > 5e3 && !resuelto) {
              resuelto = true;
              const rutaFinal = path.join(carpetaTemp, `constancia_${Date.now()}.pdf`);
              fs.writeFileSync(rutaFinal, buffer);
              console.log("[SatConstanciaService] Constancia capturada:", rutaFinal);
              clearTimeout(timer);
              limpiar();
              await route.fulfill({ response }).catch(() => null);
              await popupRef?.close().catch(() => null);
              resolve(rutaFinal);
              return;
            }
          }
          await route.fulfill({ response }).catch(() => null);
        } catch {
          await route.abort().catch(() => null);
        }
      });
      page.context().once("page", (p) => {
        popupRef = p;
      });
      boton.click().catch(() => null);
    });
  }
  async obtenerFrameConstancia(page) {
    await page.waitForLoadState("networkidle", { timeout: 15e3 }).catch(() => null);
    const iframeEl = await page.waitForSelector("#iframetoload", { timeout: 15e3 });
    const frame = await iframeEl.contentFrame();
    if (!frame) throw new Error("No se pudo acceder al iframe de constancias");
    await frame.waitForLoadState("networkidle", { timeout: 15e3 }).catch(() => null);
    return frame;
  }
  async llenarFormularioCiec(page, rfc, password, captcha) {
    await page.waitForSelector("#rfc", { timeout: 1e4 });
    await page.fill("#rfc", rfc);
    await page.fill("#password", password);
    const captchaSelector = 'input[id*="captcha" i], input[name*="captcha" i], input[placeholder*="captcha" i]';
    await page.waitForSelector(captchaSelector, { timeout: 5e3 });
    await page.click(captchaSelector);
    await page.fill(captchaSelector, "");
    await page.type(captchaSelector, captcha, { delay: 50 });
    await page.click("#submit");
  }
  async llenarFormularioFiel(page, rutaCer, rutaKey, password) {
    const tabFiel = page.locator('a:has-text("e.firma")');
    if (await tabFiel.count() > 0) await tabFiel.first().click();
    await page.setInputFiles('input[accept*=".cer"]', rutaCer);
    await page.setInputFiles('input[accept*=".key"]', rutaKey);
    await page.fill('input[type="password"]', password);
    await page.click("#submit");
  }
}
class ConstanciaHandler {
  constanciaService;
  configuracionService;
  paginaActiva = null;
  constructor(configuracionService) {
    this.constanciaService = new SatConstanciaService();
    this.configuracionService = configuracionService;
  }
  registrar() {
    electron.ipcMain.handle("constancia-obtener-captcha", async () => {
      try {
        await this.cerrarPaginaActiva();
        const contexto = await BrowserManager.newContext();
        this.paginaActiva = await contexto.newPage();
        const captcha = await this.constanciaService.obtenerCaptcha(this.paginaActiva);
        return { success: true, data: captcha };
      } catch (error) {
        console.error("[ConstanciaHandler] obtener-captcha:", error);
        await this.cerrarPaginaActiva();
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error obteniendo captcha"
        };
      }
    });
    electron.ipcMain.handle("constancia-obtener-constancia", async (_, data) => {
      try {
        const config = this.configuracionService.obtener();
        if (!config?.rfc) {
          return { success: false, error: "No hay RFC configurado. Ve a Configuración primero." };
        }
        const carpetaTemp = config.carpetaDescarga || electron.app.getPath("downloads");
        const tipoLogin = config.metodoAuth ?? "contrasena";
        const onProgreso = (mensaje) => {
          electron.BrowserWindow.getAllWindows()[0]?.webContents.send("progreso-constancia", mensaje);
        };
        let constancia;
        if (tipoLogin === "efirma") {
          await this.cerrarPaginaActiva();
          const contexto = await BrowserManager.newContext();
          this.paginaActiva = await contexto.newPage();
          constancia = await this.constanciaService.loginFielYObtenerConstancia(
            this.paginaActiva,
            carpetaTemp,
            config.rfc,
            config.rutaCer ?? "",
            config.rutaKey ?? "",
            config.contrasenaFiel ?? "",
            onProgreso
          );
        } else {
          if (!this.paginaActiva || this.paginaActiva.isClosed()) {
            return { success: false, error: "La sesión expiró. Recarga el captcha e intenta de nuevo." };
          }
          if (!data.captcha?.trim()) {
            return { success: false, error: "El captcha es requerido." };
          }
          constancia = await this.constanciaService.loginCiecYObtenerConstancia(
            this.paginaActiva,
            carpetaTemp,
            config.rfc,
            config.contrasena ?? "",
            data.captcha,
            onProgreso
          );
        }
        return { success: true, data: constancia };
      } catch (error) {
        console.error("[ConstanciaHandler] obtener-constancia:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error obteniendo constancia"
        };
      } finally {
        await this.cerrarPaginaActiva();
      }
    });
    electron.ipcMain.handle("constancia-cerrar-sesion", async () => {
      await this.cerrarPaginaActiva();
      return { success: true };
    });
  }
  async cerrarPaginaActiva() {
    if (this.paginaActiva && !this.paginaActiva.isClosed()) {
      await this.paginaActiva.context().close().catch(() => null);
    }
    this.paginaActiva = null;
  }
}
class EfosRepository {
  constructor(db) {
    this.db = db;
  }
  // Propiedad auxiliar para obtener el nombre de la tabla de facturas actual
  get tablaFacturas() {
    return ProfileManager.getTablaFacturas();
  }
  upsertMany(registros) {
    const insertar = this.db.prepare(`
            INSERT INTO efos (rfc, nombre, situacion)
            VALUES (@rfc, @nombre, @situacion)
            ON CONFLICT(rfc) DO UPDATE SET
                nombre    = excluded.nombre,
                situacion = excluded.situacion
        `);
    const transaccion = this.db.transaction((items) => {
      this.db.exec("DELETE FROM efos");
      for (const item of items) insertar.run(item);
    });
    transaccion(registros);
  }
  actualizarMeta(total) {
    this.db.prepare(`
            UPDATE efos_meta
            SET ultima_sync = datetime('now', 'localtime'),
                total_registros = ?
            WHERE id = 1
        `).run(total);
  }
  obtenerMeta() {
    return this.db.prepare(`
            SELECT ultima_sync, total_registros FROM efos_meta WHERE id = 1
        `).get();
  }
  cruzarConCfdis() {
    try {
      const query = `
                SELECT
                    e.rfc,
                    e.nombre,
                    e.situacion,
                    COUNT(f.uuid)                           AS total_facturas,
                    COALESCE(SUM(CAST(f.total AS REAL)), 0) AS monto_total
                FROM efos e
                INNER JOIN ${this.tablaFacturas} f ON UPPER(f.rfc_emisor) = UPPER(e.rfc)
                WHERE f.tipo_descarga = 'recibida'
                  AND f.estado = 'vigente'
                  AND e.situacion IN ('Definitivo', 'Presunto')
                GROUP BY e.rfc, e.nombre, e.situacion
                ORDER BY
                    CASE e.situacion WHEN 'Definitivo' THEN 1 ELSE 2 END,
                    monto_total DESC
            `;
      return this.db.prepare(query).all();
    } catch (error) {
      if (error.message.includes("no such table")) {
        console.warn(`[EfosRepository] La tabla ${this.tablaFacturas} no existe aún.`);
        return [];
      }
      throw error;
    }
  }
}
const URL_LISTADO_COMPLETO = "https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGAFF/Listado_completo_69-B.csv";
const SITUACION_MAP = {
  "definitivo": "Definitivo",
  "presunto": "Presunto",
  "desvirtuado": "Desvirtuado",
  "sentencia favorable": "SentenciaFavorable",
  "sentenciafavorable": "SentenciaFavorable",
  "sentencias favorables": "SentenciaFavorable"
};
class Lista69BService {
  constructor(efosRepository) {
    this.efosRepository = efosRepository;
  }
  async sincronizar(onProgreso) {
    onProgreso("Conectando con el SAT...");
    const csv = await this.descargarCsv(URL_LISTADO_COMPLETO);
    onProgreso("Procesando registros...");
    const registros = this.parsearCsv(csv);
    if (registros.length === 0) {
      throw new Error("No se pudieron procesar registros. Verifica tu conexión e intenta de nuevo.");
    }
    onProgreso(`Guardando ${registros.length.toLocaleString("es-MX")} registros...`);
    this.efosRepository.upsertMany(registros);
    this.efosRepository.actualizarMeta(registros.length);
    onProgreso(`Listo. ${registros.length.toLocaleString("es-MX")} contribuyentes cargados.`);
    return { total: registros.length };
  }
  analizarRiesgo() {
    const resultados = this.efosRepository.cruzarConCfdis();
    const definitivos = resultados.filter((r) => r.situacion === "Definitivo");
    const presuntos = resultados.filter((r) => r.situacion === "Presunto");
    return {
      definitivos,
      presuntos,
      montoDefinitivo: definitivos.reduce((s, r) => s + r.monto_total, 0),
      montoPresunto: presuntos.reduce((s, r) => s + r.monto_total, 0),
      sinRiesgo: resultados.length === 0
    };
  }
  obtenerMeta() {
    return this.efosRepository.obtenerMeta();
  }
  async descargarCsv(url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Tiempo de espera agotado al descargar la lista del SAT")),
        6e4
      );
      https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode !== 200) {
          clearTimeout(timeout);
          reject(new Error(`Error HTTP ${res.statusCode} al descargar lista`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          clearTimeout(timeout);
          const buffer = Buffer.concat(chunks);
          const contenido = buffer[0] === 239 && buffer[1] === 187 && buffer[2] === 191 ? buffer.subarray(3).toString("utf-8") : buffer.toString("utf-8");
          resolve(contenido);
        });
        res.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }).on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
  parsearCsv(contenido) {
    const separador = ";";
    const lineas = contenido.split(/\r?\n/).filter((l) => l.trim().length > 10);
    const registros = [];
    const rfcRegex = /[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/i;
    for (const linea of lineas) {
      const cols = linea.split(separador).map((c) => c.trim().replace(/^"|"$/g, ""));
      const indexRFC = cols.findIndex((c) => rfcRegex.test(c));
      if (indexRFC !== -1) {
        const rfc = cols[indexRFC].toUpperCase();
        const nombre = cols[indexRFC + 1] || "SIN NOMBRE";
        const situacionRaw = (cols[indexRFC + 2] || "").toLowerCase().trim();
        const situacion = SITUACION_MAP[situacionRaw] || "Desvirtuado";
        registros.push({ rfc, nombre, situacion });
      }
    }
    return registros;
  }
}
class Lista69BHandler {
  constructor(lista69BService) {
    this.lista69BService = lista69BService;
  }
  registrar() {
    electron.ipcMain.handle("lista69b-sincronizar", async () => {
      try {
        const onProgreso = (mensaje) => {
          electron.BrowserWindow.getAllWindows()[0]?.webContents.send("progreso-lista69b", mensaje);
        };
        const resultado = await this.lista69BService.sincronizar(onProgreso);
        return { success: true, data: resultado };
      } catch (error) {
        console.error("[Lista69BHandler] sincronizar:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error al sincronizar lista 69-B"
        };
      }
    });
    electron.ipcMain.handle("lista69b-analizar", () => {
      try {
        const resultado = this.lista69BService.analizarRiesgo();
        return { success: true, data: resultado };
      } catch (error) {
        console.error("[Lista69BHandler] analizar:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error al analizar riesgo"
        };
      }
    });
    electron.ipcMain.handle("lista69b-obtener-meta", () => {
      try {
        const meta = this.lista69BService.obtenerMeta();
        return { success: true, data: meta };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
}
let mainWindow;
function initDatabase() {
  const db = Database.getInstance();
  const migrationRunner = new MigrationRunner(db);
  try {
    migrationRunner.run();
  } catch (err) {
    console.error("Error en migraciones:", err);
  }
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.setTitle("IFRAT - Inteligencia Fiscal para la Revisión y Administración Tributaria");
  });
  mainWindow.on("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(async () => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window2) => {
    utils.optimizer.watchWindowShortcuts(window2);
  });
  initDatabase();
  const db = Database.getInstance();
  const authService = new SatAuthService();
  const busquedaService = new SatBusquedaService();
  const satDescargaService = new SatDescargaService();
  const facturaRepository = new FacturaRepository(db);
  const pendienteRepository = new DescargaPendienteRepository(db);
  const conciliacionRepository = new ConciliacionRepository(db);
  const configuracionService = new ConfiguracionService(db);
  const guardadoService = new CfdiGuardadoService(facturaRepository, pendienteRepository, db);
  const efosRepository = new EfosRepository(db);
  const descargaService = new DescargaService(authService, busquedaService, satDescargaService, guardadoService, facturaRepository, pendienteRepository);
  const pendientesService = new PendientesService(authService, busquedaService, satDescargaService, guardadoService, pendienteRepository);
  const conciliacionService = new ConciliacionService(authService, busquedaService, satDescargaService, guardadoService, facturaRepository, conciliacionRepository);
  const lista69BService = new Lista69BService(efosRepository);
  const profileManager = new ProfileManager(db);
  new PerfilHandler(profileManager, db).registrar();
  new FacturaHandler(descargaService, pendientesService, configuracionService, authService, db).registrar();
  new ConciliacionHandler(conciliacionService, configuracionService, authService, db).registrar();
  new ImportacionHandler(guardadoService, db).registrar();
  new ConfiguracionHandler(db).registrar();
  new DashboardHandler(db).registrar();
  new CatalogoHandler(db).registrar();
  new LicenseHandler(db).registrar();
  new ExportacionHandler(db).registrar();
  new CumplimientoHandler(configuracionService).registrar();
  new ConstanciaHandler(configuracionService).registrar();
  new Lista69BHandler(lista69BService).registrar();
  createWindow();
  if (!utils.is.dev) {
    new UpdaterService(mainWindow).iniciar();
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    BrowserManager.cerrar();
    Database.close();
    electron.app.quit();
  }
});
electron.ipcMain.handle("app-version", () => {
  return electron.app.getVersion();
});
