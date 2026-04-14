import { ipcMain } from 'electron'
import { DashboardRepository } from '../database/repositories/DashboardRepository'
import { ProfileManager } from '../database/ProfileManager'
import BetterSqlite3 from 'better-sqlite3'

export class DashboardHandler {
  private repository: DashboardRepository

  constructor(private readonly db: BetterSqlite3.Database) {
    this.repository = new DashboardRepository(db)
  }

  registrar(): void {
    ipcMain.handle('dashboard-kpis', async (_, año: number, mes: number) => {
      try {
        return { success: true, data: this.repository.kpisDelMes(año, mes) }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('dashboard-flujo-anual', async (_, año: number) => {
      try {
        return { success: true, data: this.repository.flujoAnual(año) }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('dashboard-top-proveedores', async (_, año: number, mes: number) => {
      try {
        return { success: true, data: this.repository.topProveedores(año, mes) }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('dashboard-top-clientes', async (_, año: number, mes: number) => {
      try {
        return { success: true, data: this.repository.topClientes(año, mes) }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('dashboard-obtener-conteos', async () => {
      try {
        const perfil = ProfileManager.getPerfilActivo()
        const data = this.repository.obtenerConteos(perfil?.rfc || '')
        return { success: true, data }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('reportes-iva-anual', async (_, año: number) => {
      try {
        return { success: true, data: this.repository.ivaAnual(año) }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('reportes-isr-anual', async (_, año: number, regimen: string) => {
      try {
        const perfil = ProfileManager.getPerfilActivo()
        if (!perfil) throw new Error('No hay perfil activo')

        const { IsrCalculadorService } = await import('../services/IsrCalculadorService')
        const calculador = new IsrCalculadorService(this.db)
        const tabla = ProfileManager.getTablaFacturas()

        const data = calculador.calcularAnual(tabla, año, regimen as any, perfil.rfc)
        return { success: true, data }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('reportes-detalle-mes', async (_, año: number, mes: number) => {
      try {
        return { success: true, data: this.repository.detalleMes(año, mes) }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('cfdi-toggle-pagado', async (_, uuid: string, pagado: boolean) => {
      try {
        this.repository.togglePagado(uuid, pagado)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('reportes-detectar-regimen', async () => {
      try {
        const rutaXml = this.repository.obtenerRutaXmlMuestra()
        if (!rutaXml) return { success: true, data: null }

        const { XmlParserService } = await import('../services/XmlParserService')
        const parser = new XmlParserService()
        const campos = parser.extraerCampos(rutaXml)

        const regimen = campos.regimen_fiscal_emisor ?? null
        return { success: true, data: regimen }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }
}