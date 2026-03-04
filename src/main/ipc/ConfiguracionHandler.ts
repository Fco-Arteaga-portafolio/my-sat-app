import { ipcMain, dialog } from 'electron'
import { ConfiguracionService, Configuracion } from '../services/ConfiguracionService'

export class ConfiguracionHandler {
  private readonly configuracionService: ConfiguracionService

  constructor() {
    this.configuracionService = new ConfiguracionService()
  }

  registrar(): void {
    this.handleGuardar()
    this.handleObtener()
    this.handleLimpiar()
    this.handleSeleccionarArchivo()
    this.handleSeleccionarCarpeta()
  }

  private handleGuardar(): void {
    ipcMain.handle('guardar-configuracion', async (_, config: Configuracion) => {
      try {
        this.configuracionService.guardar(config)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }

  private handleObtener(): void {
    ipcMain.handle('obtener-configuracion', async () => {
      try {
        const config = this.configuracionService.obtener()
        return { success: true, config }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }


  private handleLimpiar(): void {
    ipcMain.handle('limpiar-configuracion', async () => {
      try {
        this.configuracionService.limpiar()
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }

  private handleSeleccionarArchivo(): void {
    ipcMain.handle('seleccionar-archivo', async (_, filtros: Electron.FileFilter[]) => {
      const resultado = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: filtros
      })
      if (resultado.canceled) return { success: false }
      return { success: true, ruta: resultado.filePaths[0] }
    })
  }

  private handleSeleccionarCarpeta(): void {
    ipcMain.handle('seleccionar-carpeta', async () => {
      const resultado = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })
      if (resultado.canceled) return { success: false }
      return { success: true, ruta: resultado.filePaths[0] }
    })
  }
}