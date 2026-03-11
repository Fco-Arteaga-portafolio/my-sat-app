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
  obtenerPerfiles: () => ipcRenderer.invoke('obtener-perfiles'),
  crearPerfil: (perfil: any) => ipcRenderer.invoke('crear-perfil', perfil),
  eliminarPerfil: (rfc: string) => ipcRenderer.invoke('eliminar-perfil', rfc),
  seleccionarPerfil: (rfc: string) => ipcRenderer.invoke('seleccionar-perfil', rfc),
  obtenerPerfilActivo: () => ipcRenderer.invoke('obtener-perfil-activo'),
  cerrarPerfil: () => ipcRenderer.invoke('cerrar-perfil'),
  seleccionarXmls: () => ipcRenderer.invoke('seleccionar-xmls'),
  obtenerPdfFactura: (datos: any) => ipcRenderer.invoke('obtener-pdf-factura', datos),
  seleccionarCarpetaXml: () => ipcRenderer.invoke('seleccionar-carpeta-xml'),
  importarXmls: (rutas: string[]) => ipcRenderer.invoke('importar-xmls', rutas),
  dashboardKpis: (año: number, mes: number) => ipcRenderer.invoke('dashboard-kpis', año, mes),
  dashboardFlujoAnual: (año: number) => ipcRenderer.invoke('dashboard-flujo-anual', año),
  dashboardTopProveedores: (año: number, mes: number) => ipcRenderer.invoke('dashboard-top-proveedores', año, mes),
  dashboardTopClientes: (año: number, mes: number) => ipcRenderer.invoke('dashboard-top-clientes', año, mes),
  reintentarPendientes: (datos: { captcha?: string }) => ipcRenderer.invoke('reintentar-pendientes', datos),
  obtenerConteos: () => ipcRenderer.invoke('dashboard-obtener-conteos'),
  generarPdf: (datos: { xmlContenido: string; parseada: any; uuid: string; plantilla: string; rutaDestino: string }) =>
    ipcRenderer.invoke('generar-pdf', datos),
  catalogoObtener: (tipo: string) => ipcRenderer.invoke('catalogo-obtener', tipo),
  catalogoObtenerPorRfc: (tipo: string, rfc: string) => ipcRenderer.invoke('catalogo-obtener-por-rfc', tipo, rfc),
  catalogoActualizar: (tipo: string, rfc: string, datos: any) => ipcRenderer.invoke('catalogo-actualizar', tipo, rfc, datos),
  catalogoSincronizar: () => ipcRenderer.invoke('catalogo-sincronizar'),
  facturasDrillDown: (rfc: string) => ipcRenderer.invoke('facturas-drill-down', rfc),
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