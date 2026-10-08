import BetterSqlite3 from 'better-sqlite3'

/**
 * Guarda en la BD las credenciales de la cuenta (email + contraseña cifrada)
 * y la marca de "alguna vez logueó correctamente". Sirven para re-loguear en
 * segundo plano si el refresh token expira o se revoca, de modo que el usuario
 * no vuelva a ver la pantalla de login nunca más.
 */
export function migration020(db: BetterSqlite3.Database): void {
  const columnas = (db.prepare('PRAGMA table_info(sesion)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  const agregar = (nombre: string, definicion: string): void => {
    if (!columnas.includes(nombre)) {
      db.exec(`ALTER TABLE sesion ADD COLUMN ${nombre} ${definicion}`)
    }
  }

  agregar('usuario', 'TEXT')
  agregar('contrasena', 'TEXT')
  agregar('login_exitoso', 'INTEGER NOT NULL DEFAULT 0')
  agregar('fecha_ultimo_login', 'TEXT')
}
