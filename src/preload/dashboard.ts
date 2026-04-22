import { ipcRenderer } from 'electron'

export const createDashboardApi = () => {
    return {
        dashboardKpis: (año: number, mes: number) => ipcRenderer.invoke('dashboard-kpis', año, mes),
        dashboardFlujoAnual: (año: number) => ipcRenderer.invoke('dashboard-flujo-anual', año),
        dashboardTopProveedores: (año: number, mes: number) => ipcRenderer.invoke('dashboard-top-proveedores', año, mes),
        dashboardTopClientes: (año: number, mes: number) => ipcRenderer.invoke('dashboard-top-clientes', año, mes),
        obtenerConteos: () => ipcRenderer.invoke('dashboard-obtener-conteos'),
        reportesIvaAnual: (año: number) => ipcRenderer.invoke('reportes-iva-anual', año),
        reportesIsrAnual: (año: number, regimen: string) => ipcRenderer.invoke('reportes-isr-anual', año, regimen),
        reportesDetalleMes: (año: number, mes: number) => ipcRenderer.invoke('reportes-detalle-mes', año, mes),
        cfdiTogglePagado: (uuid: string, pagado: boolean) => ipcRenderer.invoke('cfdi-toggle-pagado', uuid, pagado),
        reportesDetectarRegimen: () => ipcRenderer.invoke('reportes-detectar-regimen'),
    }
}
