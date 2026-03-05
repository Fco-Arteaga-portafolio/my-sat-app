export {}

declare global {
  interface Window {
    api: {
      contarPendientes(): Promise<any>
      leerXml(xml: string): Promise<any>
      seleccionarCarpeta(): Promise<any>
      generarPdf(data: any): Promise<any>
      obtenerConfiguracion(): Promise<any>
      guardarConfiguracion(config: any): Promise<any>
      seleccionarArchivo(filters: any[]): Promise<any>
      onProgresoDescarga(cb: (p: any) => void): void
      obtenerCaptcha(): Promise<any>
      descargarFacturas(data: any): Promise<any>
      obtenerFacturas(): Promise<any>
      eliminarFactura(uuid: string): Promise<any>
      abrirArchivo(path: string): Promise<any>
      obtenerPendientes(): Promise<any>
      reintentarPendientes(data: any): Promise<any>
      limpiarPendientes(): Promise<void>
    }
  }
}