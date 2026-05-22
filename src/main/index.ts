import { app, shell, BrowserWindow, ipcMain } from 'electron'
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
import { ExportacionHandler } from './ipc/ExportacionHandler'
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
import { UpdaterService } from './window/UpdaterService'
import { LicenseHandler } from './ipc/LicenseHandler'
import { EfosRepository } from './database/repositories/EfosRepository'
import { Lista69BService } from './services/Lista69BService'
import { Lista69BHandler } from './ipc/Lista69BHandler'
import { LoggerHandler } from './ipc/LoggerHandler'

// Nuevos servicios unificados
import { UnifiedSatHandler } from './ipc/UnifiedSatHandler'
import { PortalConfigProvider } from './scraper/PortalConfigProvider'
import { SatUnifiedAuthService } from './scraper/SatUnifiedAuthService'
import { SatConstanciaOperationService } from './scraper/SatConstanciaOperationService'
import { SatCumplimientoOperationService } from './scraper/SatCumplimientoOperationService'

let mainWindow: BrowserWindow;

/**
 * Implementar single instance lock
 * Solo permite una instancia del programa al mismo tiempo
 */
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  // No pudimos obtener el lock, significa que ya hay otra instancia corriendo
  app.quit()
} else {
  // Escuchar cuando otra instancia intenta iniciar
  app.on('second-instance', () => {
    // Si ya existe una ventana, enfocarla
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
    }
  })
}

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
  mainWindow = new BrowserWindow({
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
  const authService = new SatAuthService()
  const busquedaService = new SatBusquedaService()
  const satDescargaService = new SatDescargaService()

  // Repositorios
  const facturaRepository = new FacturaRepository(db)
  const pendienteRepository = new DescargaPendienteRepository(db)
  const conciliacionRepository = new ConciliacionRepository(db)

  // Servicios base
  const configuracionService = new ConfiguracionService(db)
  const guardadoService = new CfdiGuardadoService(facturaRepository, pendienteRepository, db)
  const efosRepository = new EfosRepository(db)

  // Flujos
  const descargaService = new DescargaService(authService, busquedaService, satDescargaService, guardadoService, facturaRepository, pendienteRepository)
  const pendientesService = new PendientesService(authService, busquedaService, satDescargaService, guardadoService, pendienteRepository)
  const conciliacionService = new ConciliacionService(authService, busquedaService, satDescargaService, guardadoService, facturaRepository, conciliacionRepository)
  const lista69BService = new Lista69BService(efosRepository)

  // Handlers
  const profileManager = new ProfileManager(db)
  new PerfilHandler(profileManager, db).registrar()
  new FacturaHandler(descargaService, pendientesService, configuracionService, authService, db).registrar()
  new ConciliacionHandler(conciliacionService, configuracionService, authService, db).registrar()
  new ImportacionHandler(guardadoService, db).registrar()
  new ConfiguracionHandler(db).registrar()
  new DashboardHandler(db).registrar()
  new CatalogoHandler(db).registrar()
  new LicenseHandler(db).registrar()
  new ExportacionHandler(db).registrar()
  new Lista69BHandler(lista69BService).registrar()
  new LoggerHandler().registrar()

  // Servicios unificados para SAT
  const configProvider = new PortalConfigProvider()

  // Crear instancia ÚNICA de authService que será compartida por todos
  const sharedAuthService = new SatUnifiedAuthService(configProvider)

  // Pasar la MISMA instancia de authService a los servicios de operación
  const constanciaService = new SatConstanciaOperationService(configProvider, sharedAuthService)
  const cumplimientoService = new SatCumplimientoOperationService(configProvider, sharedAuthService)

  // Handler unificado con compatibilidad hacia atrás
  const unifiedHandler = new UnifiedSatHandler(
    configuracionService,
    {
      constancia: {
        obtenerCaptcha: () => constanciaService.obtenerCaptcha(),
        ejecutar: (page, cred, opts) => constanciaService.ejecutar(page, cred, opts), // ← page primero
        cerrarSesion: () => constanciaService.cerrarSesion()
      },
      cumplimiento: {
        obtenerCaptcha: () => cumplimientoService.obtenerCaptcha(),
        ejecutar: (page, cred, opts) => cumplimientoService.ejecutar(page, cred, opts), // ← page primero
        cerrarSesion: () => cumplimientoService.cerrarSesion()
      }
    },
    sharedAuthService,
    configProvider   // ← cuarto argumento, antes faltaba
  )
  unifiedHandler.registrar()
  // ✅ Handlers legacy ya están registrados dentro de unifiedHandler.registrar()

  createWindow()
  if (!is.dev) {
    new UpdaterService(mainWindow).iniciar()
  }

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


ipcMain.handle('app-version', () => {
  return app.getVersion()
})