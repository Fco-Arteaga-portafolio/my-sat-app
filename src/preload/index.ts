import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { createCatalogoApi } from './catalogo'
import { createConciliacionApi } from './conciliacion'
import { createConfiguracionApi } from './configuracion'
import { createDashboardApi } from './dashboard'
import { createFacturaApi } from './factura'
import { createImportacionApi } from './importacion'
import { createPerfilApi } from './perfil'
import { createLicenseApi } from './license'
import { createExportacionApi } from './exportacion'
import { createCumplimientoApi } from './cumplimiento'
import { createMiscApi, createElectronUpdater, createAppInfo } from './misc'
import { createConstanciaApi } from './constancia'
import { createLista69BApi } from './lista69b'
import { createLoggerApi } from './logger'

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', {
      ...createCatalogoApi(),
      ...createConciliacionApi(),
      ...createConfiguracionApi(),
      ...createDashboardApi(),
      ...createFacturaApi(),
      ...createImportacionApi(),
      ...createPerfilApi(),
      ...createLicenseApi(),
      ...createExportacionApi(),
      ...createCumplimientoApi(),
      ...createConstanciaApi(),
      ...createLista69BApi(),
      ...createLoggerApi(),
      ...createMiscApi(),
    })
    contextBridge.exposeInMainWorld('electronUpdater', createElectronUpdater())
    contextBridge.exposeInMainWorld('appInfo', createAppInfo())
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = {
    ...createCatalogoApi(),
    ...createConciliacionApi(),
    ...createConfiguracionApi(),
    ...createDashboardApi(),
    ...createFacturaApi(),
    ...createImportacionApi(),
    ...createPerfilApi(),
    ...createLicenseApi(),
    ...createExportacionApi(),
    ...createCumplimientoApi(),
    ...createConstanciaApi(),
    ...createLista69BApi(),
    ...createLoggerApi(),
    ...createMiscApi(),
  }
  // @ts-ignore (define in dts)
  window.electronUpdater = createElectronUpdater()
  // @ts-ignore (define in dts)
  window.appInfo = createAppInfo()
}