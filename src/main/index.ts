import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { Database } from './database/Database'
import { MigrationRunner } from './database/MigrationRunner'
import { FacturaHandler } from './ipc/FacturaHandler'
import { ConfiguracionHandler } from './ipc/ConfiguracionHandler'
import { FacturaRepository } from './database/repositories/FacturaRepository'
import { DescargaPendienteRepository } from './database/repositories/DescargaPendienteRepository'
import { FacturaService } from './services/FacturaService'
import { ConfiguracionService } from './services/ConfiguracionService'

function initDatabase(): void {
  const db = Database.getInstance()
  const migrationRunner = new MigrationRunner(db)
  migrationRunner.run()
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDatabase()
  const db = Database.getInstance()

  const facturaRepository = new FacturaRepository(db)
  const descargaPendienteRepository = new DescargaPendienteRepository(db)
  const configuracionService = new ConfiguracionService()
  const facturaService = new FacturaService(facturaRepository, descargaPendienteRepository)

  new FacturaHandler(facturaService, configuracionService).registrar()
  new ConfiguracionHandler().registrar()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    Database.close()
    app.quit()
  }
})