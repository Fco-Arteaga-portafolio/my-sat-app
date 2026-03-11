import { ipcMain } from 'electron'
import { DashboardRepository } from '../database/repositories/DashboardRepository'
import { ProfileManager } from '../database/ProfileManager'
import BetterSqlite3 from 'better-sqlite3'

export class DashboardHandler {
  private repository: DashboardRepository

  constructor(db: BetterSqlite3.Database) {
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
  }
}