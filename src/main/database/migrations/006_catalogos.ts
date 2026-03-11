import BetterSqlite3 from 'better-sqlite3'
import { ProfileManager } from '../ProfileManager'

export const migration006 = (db: BetterSqlite3.Database): void => {
  // Crear tablas de catálogos para cada perfil existente
  const perfiles = db.prepare('SELECT rfc FROM perfiles').all() as { rfc: string }[]
  
  for (const { rfc } of perfiles) {
    const r = rfc.replace(/[^A-Z0-9]/gi, '')
    
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
    `).run()

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
    `).run()

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
    `).run()

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
    `).run()
  }
}