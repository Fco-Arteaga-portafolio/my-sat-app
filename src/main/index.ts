import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { Database } from './database/Database'
import { MigrationRunner } from './database/MigrationRunner'
import { FacturaHandler } from './ipc/FacturaHandler'
import { ConfiguracionHandler } from './ipc/ConfiguracionHandler'
import { FacturaRepository } from './database/repositories/FacturaRepository'
import { DescargaPendienteRepository } from './database/repositories/DescargaPendienteRepository'
import { DescargaService } from './services/DescargaService'
import { ConfiguracionService } from './services/ConfiguracionService'
import { ProfileManager } from './database/ProfileManager'
import { PerfilHandler } from './ipc/PerfilHandler'
import { ImportacionHandler } from './ipc/ImportacionHandler'
import { DashboardHandler } from './ipc/DashboardHandler'
import { CatalogoHandler } from './ipc/CatalogoHandler'
import { ConciliacionService } from './services/ConciliacionService'
import { ConciliacionHandler } from './ipc/ConciliacionHandler'
import { ConciliacionRepository } from './database/repositories/ConciliacionRepository'
import { SatScraper } from './scraper/SatScraper'

function initDatabase(): void {
  const db = Database.getInstance()
  const migrationRunner = new MigrationRunner(db)
  try {
    migrationRunner.run()
  } catch (err) {
    console.error('Error en migraciones:', err)
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon,
    title: 'IFRAT',  // ← agregar esto
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle('IFRAT - Inteligencia Fiscal para la Revisión y Administración Tributaria')
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
  const satScraper = new SatScraper()
  new ImportacionHandler(db).registrar()
  const facturaRepository = new FacturaRepository(db)
  const descargaPendienteRepository = new DescargaPendienteRepository(db)
  const conciliacionRepository = new ConciliacionRepository(db)
  const configuracionService = new ConfiguracionService(db)
  const descargaService = new DescargaService(facturaRepository, descargaPendienteRepository, db, satScraper)
  const conciliacionService = new ConciliacionService(facturaRepository, conciliacionRepository, descargaService)
  const profileManager = new ProfileManager(db)
  new PerfilHandler(profileManager).registrar()
  new ConfiguracionHandler(db).registrar()
  new DashboardHandler(db).registrar()
  new CatalogoHandler(db).registrar()
  new FacturaHandler(descargaService, configuracionService, satScraper).registrar()
  new ConciliacionHandler(conciliacionService, configuracionService, satScraper).registrar()
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