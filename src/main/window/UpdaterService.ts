import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow, app } from 'electron'

export class UpdaterService {
    private win: BrowserWindow

    constructor(win: BrowserWindow) {
        this.win = win
        autoUpdater.autoDownload = false
        autoUpdater.autoInstallOnAppQuit = false
    }

    iniciar(): void {
        this.registrarEventos()
        this.registrarHandlers()

        // Delay para que el renderer esté listo antes de recibir eventos
        setTimeout(() => {
            autoUpdater.checkForUpdates().catch((err) => {
                console.error('[UpdaterService] checkForUpdates falló:', err)
            })
        }, 3000)
    }

    private send(canal: string, payload?: unknown): void {
        if (!this.win.isDestroyed()) {
            this.win.webContents.send(canal, payload)
        }
    }

    private registrarEventos(): void {
        autoUpdater.on('checking-for-update', () => {
            this.send('update-status', 'checking')
        })

        autoUpdater.on('update-available', () => {
            this.send('update-status', 'available')
        })

        autoUpdater.on('update-not-available', () => {
            this.send('update-status', 'not-available')
        })

        autoUpdater.on('download-progress', (p) => {
            this.send('update-progress', p.percent)
        })

        autoUpdater.on('update-downloaded', () => {
            // Solo notifica al renderer — él decide cuándo instalar
            this.send('update-status', 'downloaded')
        })

        autoUpdater.on('error', (err) => {
            console.error('[UpdaterService] error:', err)
            this.send('update-status', 'error')
        })
    }

    private registrarHandlers(): void {
        ipcMain.on('install-update', () => {
            autoUpdater.quitAndInstall(false, true)
        })

        ipcMain.on('postpone-update', () => {
            app.quit()
        })
        ipcMain.on('download-update', () => {
            autoUpdater.downloadUpdate().catch((err) => {
                console.error('[UpdaterService] downloadUpdate falló:', err)
                this.send('update-status', 'error')
            })
        })
    }
}