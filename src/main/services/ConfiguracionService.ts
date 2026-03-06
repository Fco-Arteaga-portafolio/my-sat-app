import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { ProfileManager } from '../database/ProfileManager'
import BetterSqlite3 from 'better-sqlite3'

export interface Configuracion {
  rfc: string
  metodoAuth: 'contrasena' | 'efirma'
  contrasena?: string
  rutaCer?: string
  rutaKey?: string
  contrasenaFiel?: string
  carpetaDescarga?: string
}

export class ConfiguracionService {
  constructor(private readonly db: BetterSqlite3.Database) {}

  guardar(config: Configuracion): void {
    if (config.metodoAuth === 'efirma') {
      if (config.rutaCer) config.rutaCer = this.copiarArchivoEfirma(config.rutaCer, 'cer')
      if (config.rutaKey) config.rutaKey = this.copiarArchivoEfirma(config.rutaKey, 'key')
    }

    this.db.prepare(`
      UPDATE perfiles SET
        metodo_auth = @metodo_auth,
        contrasena = @contrasena,
        ruta_cer = @ruta_cer,
        ruta_key = @ruta_key,
        contrasena_fiel = @contrasena_fiel,
        carpeta_descarga = @carpeta_descarga
      WHERE rfc = @rfc
    `).run({
      rfc: config.rfc,
      metodo_auth: config.metodoAuth,
      contrasena: config.contrasena || null,
      ruta_cer: config.rutaCer || null,
      ruta_key: config.rutaKey || null,
      contrasena_fiel: config.contrasenaFiel || null,
      carpeta_descarga: config.carpetaDescarga || null
    })

    // Actualizar perfil activo en memoria
    const perfil = ProfileManager.getPerfilActivo()
    if (perfil) {
      ProfileManager.setPerfilActivo({
        ...perfil,
        metodo_auth: config.metodoAuth,
        contrasena: config.contrasena,
        ruta_cer: config.rutaCer,
        ruta_key: config.rutaKey,
        contrasena_fiel: config.contrasenaFiel,
        carpeta_descarga: config.carpetaDescarga
      })
    }
  }

  obtener(): Configuracion | null {
    const perfil = ProfileManager.getPerfilActivo()
    if (!perfil) return null

    return {
      rfc: perfil.rfc,
      metodoAuth: perfil.metodo_auth,
      contrasena: perfil.contrasena,
      rutaCer: perfil.ruta_cer,
      rutaKey: perfil.ruta_key,
      contrasenaFiel: perfil.contrasena_fiel,
      carpetaDescarga: perfil.carpeta_descarga
    }
  }

  copiarArchivoEfirma(rutaOrigen: string, tipo: 'cer' | 'key'): string {
    const rfc = ProfileManager.getPerfilActivo()?.rfc || 'default'
    const nombreArchivo = `efirma_${rfc}.${tipo}`
    const rutaDestino = join(app.getPath('userData'), nombreArchivo)
    fs.copyFileSync(rutaOrigen, rutaDestino)
    return rutaDestino
  }
}