import { ipcMain, BrowserWindow } from 'electron'
import { Lista69BService } from '../services/Lista69BService'

export class Lista69BHandler {
    constructor(private readonly lista69BService: Lista69BService) { }

    registrar(): void {
        ipcMain.handle('lista69b-sincronizar', async () => {
            try {
                const onProgreso = (mensaje: string) => {
                    BrowserWindow.getAllWindows()[0]?.webContents.send('progreso-lista69b', mensaje)
                }
                const resultado = await this.lista69BService.sincronizar(onProgreso)
                return { success: true, data: resultado }
            } catch (error) {
                console.error('[Lista69BHandler] sincronizar:', error)
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Error al sincronizar lista 69-B',
                }
            }
        })

        ipcMain.handle('lista69b-analizar', () => {
            try {
                const resultado = this.lista69BService.analizarRiesgo()
                return { success: true, data: resultado }
            } catch (error) {
                console.error('[Lista69BHandler] analizar:', error)
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Error al analizar riesgo',
                }
            }
        })

        ipcMain.handle('lista69b-obtener-meta', () => {
            try {
                const meta = this.lista69BService.obtenerMeta()
                return { success: true, data: meta }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })
    }
}