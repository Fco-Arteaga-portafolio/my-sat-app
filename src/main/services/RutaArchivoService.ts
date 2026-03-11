import * as fs from 'fs'
import * as path from 'path'
import { ProfileManager } from '../database/ProfileManager'

interface SlotCarpeta {
  id: 'contribuyente' | 'ejercicio' | 'periodo' | 'emisor' | 'receptor'
  label: string
  activo: boolean
}

interface ConfigNombreArchivo {
  rfcEmisor: boolean
  rfcReceptor: boolean
}

interface ParamsCfdi {
  uuid: string
  fecha_emision: string
  rfc_emisor: string
  rfc_receptor: string
  tipo_descarga: 'emitida' | 'recibida'
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

export class RutaArchivoService {
  /**
   * Construye la ruta absoluta destino para un XML dado.
   * Crea las carpetas intermedias si no existen.
   * Lanza error descriptivo si faltan carpetas base en el perfil.
   */
  construirRutaXml(params: ParamsCfdi): string {
    const perfil = ProfileManager.getPerfilActivo()
    if (!perfil) throw new Error('No hay perfil activo')

    const esEmitida = params.tipo_descarga === 'emitida'

    const carpetaBase = esEmitida ? perfil.carpeta_emitidos : perfil.carpeta_recibidos
    if (!carpetaBase) {
      const tipo = esEmitida ? 'emitidos' : 'recibidos'
      throw new Error(
        `La carpeta de ${tipo} no está configurada. ` +
        `Ve a Configuración > PDF para establecer la ruta.`
      )
    }

    const estructura = this.parsearEstructura(
      esEmitida ? perfil.estructura_emitidos : perfil.estructura_recibidos
    )
    const configNombre = this.parsearConfigNombre(perfil.config_nombre_archivo)

    // Construir subcarpetas
    const fecha = new Date(params.fecha_emision)
    const subcarpetas = estructura
      .filter(s => s.activo)
      .map(s => this.resolverSlot(s.id, params, perfil.rfc, fecha))

    const carpetaDestino = path.join(carpetaBase, ...subcarpetas)
    fs.mkdirSync(carpetaDestino, { recursive: true })

    // Construir nombre de archivo
    const segmentos: string[] = []
    if (configNombre.rfcEmisor)   segmentos.push(params.rfc_emisor)
    if (configNombre.rfcReceptor) segmentos.push(params.rfc_receptor)
    segmentos.push(params.uuid)

    const nombreArchivo = segmentos.join('_') + '.xml'
    return path.join(carpetaDestino, nombreArchivo)
  }

  private resolverSlot(
    id: SlotCarpeta['id'],
    params: ParamsCfdi,
    rfcActivo: string,
    fecha: Date
  ): string {
    switch (id) {
      case 'contribuyente': return rfcActivo
      case 'ejercicio':     return String(fecha.getFullYear())
      case 'periodo':       return String(fecha.getMonth() + 1).padStart(2, '0')
      case 'emisor':        return params.rfc_emisor
      case 'receptor':      return params.rfc_receptor
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
}