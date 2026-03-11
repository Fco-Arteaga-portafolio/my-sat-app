import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { ProfileManager } from '../database/ProfileManager'
import BetterSqlite3 from 'better-sqlite3'

export interface SlotCarpeta {
  id: 'contribuyente' | 'ejercicio' | 'periodo' | 'emisor' | 'receptor'
  label: string
  activo: boolean
}

export interface ConfigNombreArchivo {
  rfcEmisor: boolean
  rfcReceptor: boolean
}

export interface Configuracion {
  rfc: string
  metodoAuth: 'contrasena' | 'efirma'
  contrasena?: string
  rutaCer?: string
  rutaKey?: string
  contrasenaFiel?: string
  carpetaDescarga?: string
  // Configuración PDF
  plantillaDefault?: string
  carpetaEmitidos?: string
  carpetaRecibidos?: string
  estructuraEmitidos?: SlotCarpeta[]
  estructuraRecibidos?: SlotCarpeta[]
  configNombreArchivo?: ConfigNombreArchivo
}

const ESTRUCTURA_DEFAULT: SlotCarpeta[] = [
  { id: 'contribuyente', label: 'Contribuyente', activo: true },
  { id: 'ejercicio',     label: 'Ejercicio',     activo: true },
  { id: 'periodo',       label: 'Periodo',       activo: false },
  { id: 'emisor',        label: 'Emisor',        activo: false },
  { id: 'receptor',      label: 'Receptor',      activo: false }
]

const CONFIG_NOMBRE_DEFAULT: ConfigNombreArchivo = {
  rfcEmisor: true,
  rfcReceptor: false
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
      rfc:                   config.rfc,
      metodo_auth:           config.metodoAuth,
      contrasena:            config.contrasena            || null,
      ruta_cer:              config.rutaCer               || null,
      ruta_key:              config.rutaKey               || null,
      contrasena_fiel:       config.contrasenaFiel        || null,
      carpeta_descarga:      config.carpetaDescarga       || null,
      plantilla_default:     config.plantillaDefault      || 'clasica',
      carpeta_emitidos:      config.carpetaEmitidos       || null,
      carpeta_recibidos:     config.carpetaRecibidos      || null,
      estructura_emitidos:   JSON.stringify(config.estructuraEmitidos  ?? ESTRUCTURA_DEFAULT),
      estructura_recibidos:  JSON.stringify(config.estructuraRecibidos ?? ESTRUCTURA_DEFAULT),
      config_nombre_archivo: JSON.stringify(config.configNombreArchivo ?? CONFIG_NOMBRE_DEFAULT)
    })

    const perfil = ProfileManager.getPerfilActivo()
    if (perfil) {
      ProfileManager.setPerfilActivo({
        ...perfil,
        metodo_auth:           config.metodoAuth,
        contrasena:            config.contrasena,
        ruta_cer:              config.rutaCer,
        ruta_key:              config.rutaKey,
        contrasena_fiel:       config.contrasenaFiel,
        carpeta_descarga:      config.carpetaDescarga,
        plantilla_default:     config.plantillaDefault      || 'clasica',
        carpeta_emitidos:      config.carpetaEmitidos,
        carpeta_recibidos:     config.carpetaRecibidos,
        estructura_emitidos:   JSON.stringify(config.estructuraEmitidos  ?? ESTRUCTURA_DEFAULT),
        estructura_recibidos:  JSON.stringify(config.estructuraRecibidos ?? ESTRUCTURA_DEFAULT),
        config_nombre_archivo: JSON.stringify(config.configNombreArchivo ?? CONFIG_NOMBRE_DEFAULT)
      })
    }
  }

  obtener(): Configuracion | null {
    const perfil = ProfileManager.getPerfilActivo()
    if (!perfil) return null

    return {
      rfc:                  perfil.rfc,
      metodoAuth:           perfil.metodo_auth,
      contrasena:           perfil.contrasena,
      rutaCer:              perfil.ruta_cer,
      rutaKey:              perfil.ruta_key,
      contrasenaFiel:       perfil.contrasena_fiel,
      carpetaDescarga:      perfil.carpeta_descarga,
      plantillaDefault:     perfil.plantilla_default     || 'clasica',
      carpetaEmitidos:      perfil.carpeta_emitidos,
      carpetaRecibidos:     perfil.carpeta_recibidos,
      estructuraEmitidos:   this.parsearEstructura(perfil.estructura_emitidos),
      estructuraRecibidos:  this.parsearEstructura(perfil.estructura_recibidos),
      configNombreArchivo:  this.parsearConfigNombre(perfil.config_nombre_archivo)
    }
  }

  private parsearEstructura(json?: string): SlotCarpeta[] {
    try {
      if (!json || json === '[]') return [...ESTRUCTURA_DEFAULT]
      return JSON.parse(json) as SlotCarpeta[]
    } catch {
      return [...ESTRUCTURA_DEFAULT]
    }
  }

  private parsearConfigNombre(json?: string): ConfigNombreArchivo {
    try {
      if (!json || json === '{}') return { ...CONFIG_NOMBRE_DEFAULT }
      return JSON.parse(json) as ConfigNombreArchivo
    } catch {
      return { ...CONFIG_NOMBRE_DEFAULT }
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