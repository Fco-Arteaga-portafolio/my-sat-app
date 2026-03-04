import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ParametrosBusqueda } from '../main/scraper/SatScraper'
import { Configuracion } from '../main/services/ConfiguracionService'

const api = {
  descargarFacturas: (datos: { captcha?: string; params: ParametrosBusqueda }) => ipcRenderer.invoke('descargar-facturas', datos),
  obtenerFacturas: () => ipcRenderer.invoke('obtener-facturas'),
  eliminarFactura: (uuid: string) => ipcRenderer.invoke('eliminar-factura', uuid),
  guardarConfiguracion: (config: Configuracion) => ipcRenderer.invoke('guardar-configuracion', config),
  obtenerConfiguracion: () => ipcRenderer.invoke('obtener-configuracion'),
  limpiarConfiguracion: () => ipcRenderer.invoke('limpiar-configuracion'),
  seleccionarArchivo: (filtros: Electron.FileFilter[]) => ipcRenderer.invoke('seleccionar-archivo', filtros),
  obtenerCaptcha: () => ipcRenderer.invoke('obtener-captcha'),
  seleccionarCarpeta: () => ipcRenderer.invoke('seleccionar-carpeta'),
  abrirArchivo: (ruta: string) => ipcRenderer.invoke('abrir-archivo', ruta),
  leerXml: (ruta: string) => ipcRenderer.invoke('leer-xml', ruta),
  obtenerPendientes: () => ipcRenderer.invoke('obtener-pendientes'),
  contarPendientes: () => ipcRenderer.invoke('contar-pendientes'),
  limpiarPendientes: () => ipcRenderer.invoke('limpiar-pendientes'),
  reintentarPendientes: (datos: { captcha?: string }) => ipcRenderer.invoke('reintentar-pendientes', datos),
  generarPdf: (datos: { xmlContenido: string; parseada: any; uuid: string; plantilla: string; rutaDestino: string }) =>
    ipcRenderer.invoke('generar-pdf', datos),
  onProgresoDescarga: (callback: (progreso: any) => void) => {
    ipcRenderer.on('progreso-descarga', (_, progreso) => callback(progreso))

  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}