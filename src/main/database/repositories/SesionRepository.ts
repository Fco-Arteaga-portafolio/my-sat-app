import BetterSqlite3 from 'better-sqlite3'

export interface SesionRow {
  id: number
  jwt: string
  refresh_token: string
  nombre: string
  email: string
  hardware_id: string
  usuario: string | null
  contrasena: string | null
  login_exitoso: number
  fecha_ultimo_login: string | null
  fecha_creacion: string
  fecha_actualizacion: string
}

export interface SesionDatos {
  jwt: string
  refreshToken: string
  nombre: string
  email: string
  hardwareId: string
}

export class SesionRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  /**
   * Guarda (o reemplaza) la sesión de cuenta del escritorio (una sola por máquina).
   */
  guardar(datos: SesionDatos): void {
    this.db
      .prepare(
        `
      INSERT INTO sesion (id, jwt, refresh_token, nombre, email, hardware_id)
      VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        jwt = excluded.jwt,
        refresh_token = excluded.refresh_token,
        nombre = excluded.nombre,
        email = excluded.email,
        hardware_id = excluded.hardware_id,
        fecha_actualizacion = datetime('now')
    `
      )
      .run(datos.jwt, datos.refreshToken, datos.nombre, datos.email, datos.hardwareId)
  }

  obtener(): SesionRow | null {
    const fila = this.db.prepare('SELECT * FROM sesion WHERE id = 1').get() as SesionRow | undefined
    return fila ?? null
  }

  /**
   * Registra que el usuario logueó correctamente y guarda sus credenciales
   * (la contraseña llega ya cifrada/ofuscada por SesionService) para poder
   * re-loguear en segundo plano cuando el refresh token expire o se revoque.
   */
  marcarLoginExitoso(usuario: string, contrasenaCifrada: string): void {
    this.db
      .prepare(
        `
        UPDATE sesion
        SET usuario = ?,
            contrasena = ?,
            login_exitoso = 1,
            fecha_ultimo_login = datetime('now')
        WHERE id = 1
      `
      )
      .run(usuario, contrasenaCifrada)
  }

  limpiar(): void {
    this.db.prepare('DELETE FROM sesion WHERE id = 1').run()
  }
}
