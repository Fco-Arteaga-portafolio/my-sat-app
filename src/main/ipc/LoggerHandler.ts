import { app, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../services/LoggerService'
import { IpcWrapper } from './IpcWrapper'

export class LoggerHandler {
  registrar(): void {
    IpcWrapper.handle('obtener-logs', () => {
      return { logs: logger.getLogs() }
    })

    IpcWrapper.handle('obtener-ruta-logs', () => {
      return { ruta: logger.getLogFile() }
    })

    IpcWrapper.handle('limpiar-logs', () => {
      logger.clearLogs()
      return {}
    })

    /**
     * Guarda un .txt con todos los logs del día (más los días anteriores que
     * sigan en la carpeta) para que el cliente lo envíe por correo/WhatsApp.
     * Si viene `contenido` (reporte de soporte armado por la UI), ese se guarda
     * y los logs se añaden al final como evidencia.
     */
    IpcWrapper.handle('exportar-logs', async (_event, opciones?: { contenido?: string }) => {
      const partes: string[] = []

      if (opciones?.contenido) {
        partes.push(opciones.contenido)
      }

      partes.push(this.concatenarArchivosDeLog())

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar logs de soporte',
        defaultPath: path.join(
          app.getPath('desktop'),
          `ifrat-logs-${new Date().toISOString().slice(0, 10)}.txt`
        ),
        filters: [{ name: 'Archivo de texto', extensions: ['txt'] }]
      })

      if (canceled || !filePath) {
        return { cancelado: true }
      }

      fs.writeFileSync(filePath, partes.join('\n\n'), 'utf-8')
      return { ruta: filePath }
    })
  }

  /**
   * Concatena todos los app-*.log en orden cronológico y lista las capturas
   * PNG que se generaron al fallar (quedan en la misma carpeta).
   */
  private concatenarArchivosDeLog(): string {
    const dir = logger.getLogsDir()
    const encabezado = [
      '===== LOGS IFRAT DESKTOP =====',
      `Generado: ${new Date().toISOString()}`,
      `Carpeta: ${dir}`,
      ''
    ].join('\n')

    let archivos: string[] = []
    try {
      archivos = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith('app-') && f.endsWith('.log'))
        .sort()
    } catch {
      // Sin carpeta: se exporta solo el archivo activo.
    }

    if (archivos.length === 0 && fs.existsSync(logger.getLogFile())) {
      archivos = [path.basename(logger.getLogFile())]
    }

    const secciones = archivos.map((nombre) => {
      try {
        const contenido = fs.readFileSync(path.join(dir, nombre), 'utf-8')
        return `===== ${nombre} =====\n${contenido}`
      } catch (error) {
        return `===== ${nombre} =====\n(no se pudo leer: ${String(error)})`
      }
    })

    const capturas = (() => {
      try {
        const pngs = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
        return pngs.length
          ? ['', 'Capturas de error (en la misma carpeta):', ...pngs.map((p) => ` - ${path.join(dir, p)}`)].join('\n')
          : ''
      } catch {
        return ''
      }
    })()

    return [encabezado, capturas, ...secciones].filter(Boolean).join('\n\n')
  }
}
