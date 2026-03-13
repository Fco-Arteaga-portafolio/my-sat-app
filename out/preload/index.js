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
  obtenerPerfiles: () => electron.ipcRenderer.invoke("obtener-perfiles"),
  crearPerfil: (perfil) => electron.ipcRenderer.invoke("crear-perfil", perfil),
  eliminarPerfil: (rfc) => electron.ipcRenderer.invoke("eliminar-perfil", rfc),
  seleccionarPerfil: (rfc) => electron.ipcRenderer.invoke("seleccionar-perfil", rfc),
  obtenerPerfilActivo: () => electron.ipcRenderer.invoke("obtener-perfil-activo"),
  cerrarPerfil: () => electron.ipcRenderer.invoke("cerrar-perfil"),
  seleccionarXmls: () => electron.ipcRenderer.invoke("seleccionar-xmls"),
  obtenerPdfFactura: (datos) => electron.ipcRenderer.invoke("obtener-pdf-factura", datos),
  seleccionarCarpetaXml: () => electron.ipcRenderer.invoke("seleccionar-carpeta-xml"),
  importarXmls: (rutas) => electron.ipcRenderer.invoke("importar-xmls", rutas),
  dashboardKpis: (año, mes) => electron.ipcRenderer.invoke("dashboard-kpis", año, mes),
  dashboardFlujoAnual: (año) => electron.ipcRenderer.invoke("dashboard-flujo-anual", año),
  dashboardTopProveedores: (año, mes) => electron.ipcRenderer.invoke("dashboard-top-proveedores", año, mes),
  dashboardTopClientes: (año, mes) => electron.ipcRenderer.invoke("dashboard-top-clientes", año, mes),
  reintentarPendientes: (datos) => electron.ipcRenderer.invoke("reintentar-pendientes", datos),
  obtenerConteos: () => electron.ipcRenderer.invoke("dashboard-obtener-conteos"),
  generarPdf: (datos) => electron.ipcRenderer.invoke("generar-pdf", datos),
  catalogoObtener: (tipo) => electron.ipcRenderer.invoke("catalogo-obtener", tipo),
  catalogoObtenerPorRfc: (tipo, rfc) => electron.ipcRenderer.invoke("catalogo-obtener-por-rfc", tipo, rfc),
  catalogoActualizar: (tipo, rfc, datos) => electron.ipcRenderer.invoke("catalogo-actualizar", tipo, rfc, datos),
  catalogoSincronizar: () => electron.ipcRenderer.invoke("catalogo-sincronizar"),
  facturasDrillDown: (rfc) => electron.ipcRenderer.invoke("facturas-drill-down", rfc),
  iniciarConciliacion: (params) => electron.ipcRenderer.invoke("iniciar-conciliacion", params),
  obtenerUltimaConciliacion: (params) => electron.ipcRenderer.invoke("obtener-ultima-conciliacion", params),
  obtenerHistorialConciliaciones: () => electron.ipcRenderer.invoke("obtener-historial-conciliaciones"),
  onProgresoConciliacion: (callback) => {
    electron.ipcRenderer.on("progreso-conciliacion", (_, progreso) => callback(progreso));
  },
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
