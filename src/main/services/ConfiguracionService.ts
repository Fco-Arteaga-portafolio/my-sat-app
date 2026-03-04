import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'

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
  private readonly configPath: string

  constructor() {
    this.configPath = join(app.getPath('userData'), 'configuracion.json')
  }

  guardar(config: Configuracion): void {
    if (config.metodoAuth === 'efirma') {
      if (config.rutaCer) {
        config.rutaCer = this.copiarArchivoEfirma(config.rutaCer, 'cer')
      }
      if (config.rutaKey) {
        config.rutaKey = this.copiarArchivoEfirma(config.rutaKey, 'key')
      }
    }
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  obtener(): Configuracion | null {
    try {
      if (!fs.existsSync(this.configPath)) return null
      const data = fs.readFileSync(this.configPath, 'utf-8')
      return JSON.parse(data) as Configuracion
    } catch {
      return null
    }
  }

  limpiar(): void {
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath)
    }
  }

  copiarArchivoEfirma(rutaOrigen: string, tipo: 'cer' | 'key'): string {
    const nombreArchivo = `efirma.${tipo}`
    const rutaDestino = join(app.getPath('userData'), nombreArchivo)
    fs.copyFileSync(rutaOrigen, rutaDestino)
    return rutaDestino
  }
}