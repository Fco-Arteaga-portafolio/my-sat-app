import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
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
import { SatBusquedaService } from './scraper/SatBusquedaService'
import { SatDescargaService } from './scraper/SatDescargaService'
import { ConfiguracionService } from './services/ConfiguracionService'
import { CfdiGuardadoService } from './services/CfdiGuardadoService'
import { CfdiService } from './services/CfdiService'
import { UpdaterService } from './window/UpdaterService'
import { LicenseHandler } from './ipc/LicenseHandler'
import { EfosRepository } from './database/repositories/EfosRepository'
import { Lista69BService } from './services/Lista69BService'
import { Lista69BHandler } from './ipc/Lista69BHandler'
import { LoggerHandler } from './ipc/LoggerHandler'
import { UnifiedSatHandler } from './ipc/UnifiedSatHandler'
import { PortalConfigProvider } from './scraper/PortalConfigProvider'
import { SatUnifiedAuthService } from './scraper/SatUnifiedAuthService'
import { SatConstanciaOperationService } from './scraper/SatConstanciaOperationService'
import { SatCumplimientoOperationService } from './scraper/SatCumplimientoOperationService'

let mainWindow: BrowserWindow

process.on('uncaughtException', (err) => {
  dialog.showErrorBox('Error fatal', err.stack ?? err.message)
})

process.on('unhandledRejection', (reason: any) => {
  dialog.showErrorBox('Error async', reason?.stack ?? String(reason))
})

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function initDatabase(): void {
  const db = Database.getInstance()
  try {
    new MigrationRunner(db).run()
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
  try {
    electronApp.setAppUserModelId('com.electron')
    app.on('browser-window-created', (_, window) => { optimizer.watchWindowShortcuts(window) })

    initDatabase()
    const db = Database.getInstance()

    // ── Auth unificado ─────────────────────────────────────────────────────
    const configProvider = new PortalConfigProvider()
    const sharedAuthService = new SatUnifiedAuthService(configProvider)

    // ── Scraper ────────────────────────────────────────────────────────────
    const busquedaService = new SatBusquedaService()
    const satDescargaService = new SatDescargaService()

    // ── Repositorios ───────────────────────────────────────────────────────
    const facturaRepository = new FacturaRepository(db)
    const pendienteRepository = new DescargaPendienteRepository(db)
    const conciliacionRepository = new ConciliacionRepository(db)
    const efosRepository = new EfosRepository(db)

    // ── Servicios base ─────────────────────────────────────────────────────
    const configuracionService = new ConfiguracionService(db)
    const guardadoService = new CfdiGuardadoService(facturaRepository, pendienteRepository, db)
    const lista69BService = new Lista69BService(efosRepository)

    // ── Servicio unificado CFDI ────────────────────────────────────────────
    const cfdiService = new CfdiService(
      sharedAuthService,
      busquedaService,
      satDescargaService,
      guardadoService,
      facturaRepository,
      pendienteRepository,
      conciliacionRepository
    )

    // ── Handlers CFDI ──────────────────────────────────────────────────────
    const profileManager = new ProfileManager(db)
    new PerfilHandler(profileManager, db).registrar()
    new FacturaHandler(cfdiService, sharedAuthService, configuracionService, db).registrar()
    new ConciliacionHandler(cfdiService, configuracionService, db).registrar()
    new ImportacionHandler(guardadoService, db).registrar()
    new ConfiguracionHandler(db).registrar()
    new DashboardHandler(db).registrar()
    new CatalogoHandler(db).registrar()
    new LicenseHandler(db).registrar()
    new ExportacionHandler(db).registrar()
    new Lista69BHandler(lista69BService).registrar()
    new LoggerHandler().registrar()

    // ── Handlers Cumplimiento / Constancia ─────────────────────────────────
    const constanciaService = new SatConstanciaOperationService(configProvider, sharedAuthService)
    const cumplimientoService = new SatCumplimientoOperationService(configProvider, sharedAuthService)

    new UnifiedSatHandler(
      configuracionService,
      {
        constancia: {
          obtenerCaptcha: () => constanciaService.obtenerCaptcha(),
          ejecutar: (page, cred, opts) => constanciaService.ejecutar(page, cred, opts),
          cerrarSesion: () => constanciaService.cerrarSesion()
        },
        cumplimiento: {
          obtenerCaptcha: () => cumplimientoService.obtenerCaptcha(),
          ejecutar: (page, cred, opts) => cumplimientoService.ejecutar(page, cred, opts),
          cerrarSesion: () => cumplimientoService.cerrarSesion()
        }
      },
      sharedAuthService,
      configProvider
    ).registrar()

    createWindow()
    if (!is.dev) new UpdaterService(mainWindow).iniciar()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

  } catch (err: any) {
    dialog.showErrorBox('Error en arranque', err.stack ?? err.message)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    BrowserManager.cerrar()
    Database.close()
    app.quit()
  }
})

ipcMain.handle('app-version', () => app.getVersion())