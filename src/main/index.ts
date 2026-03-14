import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { Database } from './database/Database'
import { MigrationRunner } from './database/MigrationRunner'
import { FacturaHandler } from './ipc/FacturaHandler'
import { ConfiguracionHandler } from './ipc/ConfiguracionHandler'
import { ConciliacionHandler } from './ipc/ConciliacionHandler'
import { ImportacionHandler } from './ipc/ImportacionHandler'
import { PerfilHandler } from './ipc/PerfilHandler'
import { DashboardHandler } from './ipc/DashboardHandler'
import { CatalogoHandler } from './ipc/CatalogoHandler'
import { FacturaRepository } from './database/repositories/FacturaRepository'
import { DescargaPendienteRepository } from './database/repositories/DescargaPendienteRepository'
import { ConciliacionRepository } from './database/repositories/ConciliacionRepository'
import { ProfileManager } from './database/ProfileManager'
import { BrowserManager } from './scraper/BrowserManager'
import { SatAuthService } from './scraper/SatAuthService'
import { SatBusquedaService } from './scraper/SatBusquedaService'
import { SatDescargaService } from './scraper/SatDescargaService'
import { ConfiguracionService } from './services/ConfiguracionService'
import { CfdiGuardadoService } from './services/CfdiGuardadoService'
import { DescargaService } from './services/DescargaService'
import { PendientesService } from './services/PendientesService'
import { ConciliacionService } from './services/ConciliacionService'

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
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle('IFRAT - Inteligencia Fiscal para la Revisión y Administración Tributaria')
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

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

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDatabase()
  const db = Database.getInstance()

  // Scraper — piezas base
  const browserContext = await BrowserManager.newContext()
  const authService = new SatAuthService(browserContext)
  const busquedaService = new SatBusquedaService()
  const satDescargaService = new SatDescargaService()

  // Repositorios
  const facturaRepository = new FacturaRepository(db)
  const pendienteRepository = new DescargaPendienteRepository(db)
  const conciliacionRepository = new ConciliacionRepository(db)

  // Servicios base
  const configuracionService = new ConfiguracionService(db)
  const guardadoService = new CfdiGuardadoService(facturaRepository, pendienteRepository, db)

  // Flujos
  const descargaService = new DescargaService(authService, busquedaService, satDescargaService, guardadoService, facturaRepository, pendienteRepository)
  const pendientesService = new PendientesService(authService, busquedaService, satDescargaService, guardadoService, pendienteRepository)
  const conciliacionService = new ConciliacionService(authService, busquedaService, satDescargaService, guardadoService, facturaRepository, conciliacionRepository)

  // Handlers
  const profileManager = new ProfileManager(db)
  new PerfilHandler(profileManager).registrar()
  new FacturaHandler(descargaService, pendientesService, configuracionService, authService).registrar()
  new ConciliacionHandler(conciliacionService, configuracionService, authService).registrar()
  new ImportacionHandler(guardadoService).registrar()
  new ConfiguracionHandler(db).registrar()
  new DashboardHandler(db).registrar()
  new CatalogoHandler(db).registrar()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    BrowserManager.cerrar()
    Database.close()
    app.quit()
  }
})