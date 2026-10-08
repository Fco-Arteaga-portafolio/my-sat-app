import { ipcRenderer } from 'electron'

export function createLoggerApi() {
  return {
    obtenerLogs: async () => ipcRenderer.invoke('obtener-logs'),
    obtenerRutaLogs: async () => ipcRenderer.invoke('obtener-ruta-logs'),
    limpiarLogs: async () => ipcRenderer.invoke('limpiar-logs'),
    exportarLogs: async (opciones?: { contenido?: string }) =>
      ipcRenderer.invoke('exportar-logs', opciones)
  }
}
