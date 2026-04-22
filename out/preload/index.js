"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const createCatalogoApi = () => {
  return {
    catalogoObtener: (tipo) => electron.ipcRenderer.invoke("catalogo-obtener", tipo),
    catalogoObtenerPorRfc: (tipo, rfc) => electron.ipcRenderer.invoke("catalogo-obtener-por-rfc", tipo, rfc),
    catalogoActualizar: (tipo, rfc, datos) => electron.ipcRenderer.invoke("catalogo-actualizar", tipo, rfc, datos),
    catalogoSincronizar: () => electron.ipcRenderer.invoke("catalogo-sincronizar")
  };
};
const createConciliacionApi = () => {
  return {
    iniciarConciliacion: (params) => electron.ipcRenderer.invoke("iniciar-conciliacion", params),
    obtenerUltimaConciliacion: (params) => electron.ipcRenderer.invoke("obtener-ultima-conciliacion", params),
    obtenerHistorialConciliaciones: () => electron.ipcRenderer.invoke("obtener-historial-conciliaciones"),
    onProgresoConciliacion: (callback) => {
      electron.ipcRenderer.on("progreso-conciliacion", (_, progreso) => callback(progreso));
    }
  };
};
const createConfiguracionApi = () => {
  return {
    guardarConfiguracion: (config) => electron.ipcRenderer.invoke("guardar-configuracion", config),
    obtenerConfiguracion: () => electron.ipcRenderer.invoke("obtener-configuracion"),
    limpiarConfiguracion: () => electron.ipcRenderer.invoke("limpiar-configuracion"),
    seleccionarArchivo: (filtros) => electron.ipcRenderer.invoke("seleccionar-archivo", filtros),
    seleccionarCarpeta: () => electron.ipcRenderer.invoke("seleccionar-carpeta")
  };
};
const createDashboardApi = () => {
  return {
    dashboardKpis: (año, mes) => electron.ipcRenderer.invoke("dashboard-kpis", año, mes),
    dashboardFlujoAnual: (año) => electron.ipcRenderer.invoke("dashboard-flujo-anual", año),
    dashboardTopProveedores: (año, mes) => electron.ipcRenderer.invoke("dashboard-top-proveedores", año, mes),
    dashboardTopClientes: (año, mes) => electron.ipcRenderer.invoke("dashboard-top-clientes", año, mes),
    obtenerConteos: () => electron.ipcRenderer.invoke("dashboard-obtener-conteos"),
    reportesIvaAnual: (año) => electron.ipcRenderer.invoke("reportes-iva-anual", año),
    reportesIsrAnual: (año, regimen) => electron.ipcRenderer.invoke("reportes-isr-anual", año, regimen),
    reportesDetalleMes: (año, mes) => electron.ipcRenderer.invoke("reportes-detalle-mes", año, mes),
    cfdiTogglePagado: (uuid, pagado) => electron.ipcRenderer.invoke("cfdi-toggle-pagado", uuid, pagado),
    reportesDetectarRegimen: () => electron.ipcRenderer.invoke("reportes-detectar-regimen")
  };
};
const createFacturaApi = () => {
  return {
    descargarFacturas: (datos) => electron.ipcRenderer.invoke("descargar-facturas", datos),
    obtenerFacturas: () => electron.ipcRenderer.invoke("obtener-facturas"),
    obtenerFacturasPorTipo: (datos) => electron.ipcRenderer.invoke("obtener-facturas-por-tipo", datos),
    eliminarFactura: (uuid) => electron.ipcRenderer.invoke("eliminar-factura", uuid),
    obtenerCaptcha: () => electron.ipcRenderer.invoke("obtener-captcha"),
    reintentarPendientes: (datos) => electron.ipcRenderer.invoke("reintentar-pendientes", datos),
    obtenerPendientes: () => electron.ipcRenderer.invoke("obtener-pendientes"),
    contarPendientes: () => electron.ipcRenderer.invoke("contar-pendientes"),
    limpiarPendientes: () => electron.ipcRenderer.invoke("limpiar-pendientes"),
    leerXml: (ruta) => electron.ipcRenderer.invoke("leer-xml", ruta),
    obtenerPdfFactura: (datos) => electron.ipcRenderer.invoke("obtener-pdf-factura", datos),
    generarPdf: (datos) => electron.ipcRenderer.invoke("generar-pdf", datos),
    imprimirPdf: () => electron.ipcRenderer.invoke("imprimir-pdf"),
    facturasDrillDown: (rfc) => electron.ipcRenderer.invoke("facturas-drill-down", rfc),
    obtenerPagoComplemento: (uuid_rep) => electron.ipcRenderer.invoke("obtener-pago-complemento", uuid_rep),
    onProgresoDescarga: (callback) => {
      electron.ipcRenderer.on("progreso-descarga", (_, progreso) => callback(progreso));
    }
  };
};
const createImportacionApi = () => {
  return {
    seleccionarXmls: () => electron.ipcRenderer.invoke("seleccionar-xmls"),
    seleccionarCarpetaXml: () => electron.ipcRenderer.invoke("seleccionar-carpeta-xml"),
    importarXmls: (rutas) => electron.ipcRenderer.invoke("importar-xmls", rutas)
  };
};
const createPerfilApi = () => {
  return {
    obtenerPerfiles: () => electron.ipcRenderer.invoke("obtener-perfiles"),
    crearPerfil: (perfil) => electron.ipcRenderer.invoke("crear-perfil", perfil),
    eliminarPerfil: (rfc) => electron.ipcRenderer.invoke("eliminar-perfil", rfc),
    seleccionarPerfil: (rfc) => electron.ipcRenderer.invoke("seleccionar-perfil", rfc),
    obtenerPerfilActivo: () => electron.ipcRenderer.invoke("obtener-perfil-activo"),
    cerrarPerfil: () => electron.ipcRenderer.invoke("cerrar-perfil")
  };
};
const createLicenseApi = () => {
  return {
    obtenerLicencia: () => electron.ipcRenderer.invoke("obtener-licencia"),
    obtenerEstadoLicencia: () => electron.ipcRenderer.invoke("obtener-estado-licencia"),
    validarAgregarRfc: () => electron.ipcRenderer.invoke("validar-agregar-rfc"),
    validarRegistrarMaquina: () => electron.ipcRenderer.invoke("validar-registrar-maquina")
  };
};
const createMiscApi = () => {
  return {
    abrirArchivo: (ruta) => electron.ipcRenderer.invoke("abrir-archivo", ruta)
  };
};
const createElectronUpdater = () => {
  return {
    onStatus: (callback) => {
      electron.ipcRenderer.on("update-status", (_, status) => callback(status));
    },
    onProgress: (callback) => {
      electron.ipcRenderer.on("update-progress", (_, percent) => callback(percent));
    },
    install: () => {
      electron.ipcRenderer.send("install-update");
    },
    postpone: () => {
      electron.ipcRenderer.send("postpone-update");
    },
    download: () => electron.ipcRenderer.send("download-update")
  };
};
const createAppInfo = () => {
  return {
    getVersion: () => electron.ipcRenderer.invoke("app-version")
  };
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", {
      ...createCatalogoApi(),
      ...createConciliacionApi(),
      ...createConfiguracionApi(),
      ...createDashboardApi(),
      ...createFacturaApi(),
      ...createImportacionApi(),
      ...createPerfilApi(),
      ...createLicenseApi(),
      ...createMiscApi()
    });
    electron.contextBridge.exposeInMainWorld("electronUpdater", createElectronUpdater());
    electron.contextBridge.exposeInMainWorld("appInfo", createAppInfo());
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = {
    ...createCatalogoApi(),
    ...createConciliacionApi(),
    ...createConfiguracionApi(),
    ...createDashboardApi(),
    ...createFacturaApi(),
    ...createImportacionApi(),
    ...createPerfilApi(),
    ...createLicenseApi(),
    ...createMiscApi()
  };
  window.electronUpdater = createElectronUpdater();
  window.appInfo = createAppInfo();
}
