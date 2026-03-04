"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  descargarFacturas: (datos) => electron.ipcRenderer.invoke("descargar-facturas", datos),
  obtenerFacturas: () => electron.ipcRenderer.invoke("obtener-facturas"),
  eliminarFactura: (uuid) => electron.ipcRenderer.invoke("eliminar-factura", uuid),
  guardarConfiguracion: (config) => electron.ipcRenderer.invoke("guardar-configuracion", config),
  obtenerConfiguracion: () => electron.ipcRenderer.invoke("obtener-configuracion"),
  limpiarConfiguracion: () => electron.ipcRenderer.invoke("limpiar-configuracion"),
  seleccionarArchivo: (filtros) => electron.ipcRenderer.invoke("seleccionar-archivo", filtros),
  obtenerCaptcha: () => electron.ipcRenderer.invoke("obtener-captcha"),
  seleccionarCarpeta: () => electron.ipcRenderer.invoke("seleccionar-carpeta"),
  abrirArchivo: (ruta) => electron.ipcRenderer.invoke("abrir-archivo", ruta),
  leerXml: (ruta) => electron.ipcRenderer.invoke("leer-xml", ruta),
  obtenerPendientes: () => electron.ipcRenderer.invoke("obtener-pendientes"),
  contarPendientes: () => electron.ipcRenderer.invoke("contar-pendientes"),
  limpiarPendientes: () => electron.ipcRenderer.invoke("limpiar-pendientes"),
  reintentarPendientes: (datos) => electron.ipcRenderer.invoke("reintentar-pendientes", datos),
  generarPdf: (datos) => electron.ipcRenderer.invoke("generar-pdf", datos),
  onProgresoDescarga: (callback) => {
    electron.ipcRenderer.on("progreso-descarga", (_, progreso) => callback(progreso));
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
