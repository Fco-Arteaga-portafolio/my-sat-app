import BetterSqlite3 from 'better-sqlite3'

export interface Perfil {
  id?: number
  rfc: string
  nombre: string
  metodo_auth: 'contrasena' | 'efirma'
  contrasena?: string
  ruta_cer?: string
  ruta_key?: string
  contrasena_fiel?: string
  carpeta_descarga?: string
  activo?: number
  fecha_creacion?: string
}

export class ProfileManager {
  private static perfilActivo: Perfil | null = null

  constructor(private readonly db: BetterSqlite3.Database) {}

  // ── Perfiles ──────────────────────────────────────────
  obtenerTodos(): Perfil[] {
    return this.db.prepare('SELECT * FROM perfiles ORDER BY nombre ASC').all() as Perfil[]
  }

  obtenerPorRfc(rfc: string): Perfil | null {
    return this.db.prepare('SELECT * FROM perfiles WHERE rfc = ?').get(rfc) as Perfil | null
  }

  insertar(perfil: Perfil): void {
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
    })
    // Crear tablas para este RFC si no existen
    this.crearTablasPerfil(perfil.rfc)
  }

  eliminar(rfc: string): void {
    this.db.prepare('DELETE FROM perfiles WHERE rfc = ?').run(rfc)
    // Las tablas se mantienen por seguridad — se pueden limpiar manualmente
  }

  // ── Perfil activo ─────────────────────────────────────
  static getPerfilActivo(): Perfil | null {
    return this.perfilActivo
  }

  static setPerfilActivo(perfil: Perfil): void {
    this.perfilActivo = perfil
  }

  static limpiarPerfil(): void {
    this.perfilActivo = null
  }

  // ── Nombres de tablas dinámicos ───────────────────────
  static getTablaFacturas(rfc?: string): string {
    const r = rfc || this.perfilActivo?.rfc
    if (!r) throw new Error('No hay perfil activo')
    return `facturas_${r.replace(/[^a-zA-Z0-9]/g, '_')}`
  }

  static getTablaPendientes(rfc?: string): string {
    const r = rfc || this.perfilActivo?.rfc
    if (!r) throw new Error('No hay perfil activo')
    return `descargas_pendientes_${r.replace(/[^a-zA-Z0-9]/g, '_')}`
  }

  // ── Crear tablas para un RFC nuevo ────────────────────
  crearTablasPerfil(rfc: string): void {
    const tablaFacturas = ProfileManager.getTablaFacturas(rfc)
    const tablaPendientes = ProfileManager.getTablaPendientes(rfc)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${tablaFacturas} (
        id                              INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid                            TEXT UNIQUE NOT NULL,
        version                         TEXT,
        serie                           TEXT,
        folio                           TEXT,
        fecha_emision                   TEXT,
        fecha_timbrado                  TEXT,
        rfc_emisor                      TEXT,
        nombre_emisor                   TEXT,
        rfc_receptor                    TEXT,
        nombre_receptor                 TEXT,
        subtotal                        REAL,
        descuento                       REAL DEFAULT 0,
        total_impuestos_trasladados     REAL DEFAULT 0,
        total_impuestos_retenidos       REAL DEFAULT 0,
        total                           REAL,
        tipo_comprobante                TEXT,
        forma_pago                      TEXT,
        metodo_pago                     TEXT,
        moneda                          TEXT,
        tipo_cambio                     REAL,
        estado                          TEXT,
        estado_cancelacion              TEXT,
        estado_proceso_cancelacion      TEXT,
        fecha_cancelacion               TEXT,
        rfc_pac                         TEXT,
        folio_sustitucion               TEXT,
        xml                             TEXT,
        tipo_descarga                   TEXT CHECK(tipo_descarga IN ('recibida', 'emitida')),
        fecha_descarga                  TEXT
      )
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${tablaPendientes} (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid              TEXT UNIQUE NOT NULL,
        rfc_emisor        TEXT,
        nombre_emisor     TEXT,
        rfc_receptor      TEXT,
        nombre_receptor   TEXT,
        fecha_emision     TEXT,
        total             REAL,
        tipo_comprobante  TEXT,
        estado            TEXT,
        url_descarga      TEXT,
        tipo_descarga     TEXT CHECK(tipo_descarga IN ('recibida', 'emitida')),
        error             TEXT,
        intentos          INTEGER DEFAULT 1,
        fecha_fallo       TEXT DEFAULT (datetime('now'))
      )
    `)
  }
}