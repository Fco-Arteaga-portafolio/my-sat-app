import { ipcRenderer } from 'electron'

interface FiltersExportacion {
    tipoDescarga: 'emitida' | 'recibida'
    tiposComprobante: string[]
    fechaDesde: string
    fechaHasta: string
}

export const createExportacionApi = () => {
    return {
        obtenerPreview: (filtros: FiltersExportacion) =>
            ipcRenderer.invoke('exportacion-obtener-preview', filtros),

        generarExcel: (filtros: FiltersExportacion, rutaDestino: string) =>
            ipcRenderer.invoke('exportacion-generar-excel', { filtros, rutaDestino }),

        obtenerTiposCfdi: () =>
            ipcRenderer.invoke('exportacion-obtener-tipos-cfdi')
    }
}
