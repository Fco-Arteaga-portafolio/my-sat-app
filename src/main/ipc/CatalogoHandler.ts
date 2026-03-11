import { ipcMain } from 'electron'
import { CatalogoRepository, TipoCatalogo } from '../database/repositories/CatalogoRepository'
import BetterSqlite3 from 'better-sqlite3'

export class CatalogoHandler {
  private repository: CatalogoRepository

  constructor(db: BetterSqlite3.Database) {
    this.repository = new CatalogoRepository(db)
  }

  registrar(): void {
    ipcMain.handle('catalogo-obtener', async (_, tipo: TipoCatalogo) => {
      try {
        const data = this.repository.obtenerTodos(tipo)
        return { success: true, data }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('catalogo-obtener-por-rfc', async (_, tipo: TipoCatalogo, rfc: string) => {
      try {
        const data = this.repository.obtenerPorRfc(tipo, rfc)
        return { success: true, data }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('catalogo-actualizar', async (_, tipo: TipoCatalogo, rfc: string, datos: any) => {
      try {
        this.repository.actualizar(tipo, rfc, datos)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('catalogo-sincronizar', async () => {
      try {
        this.repository.sincronizarTodos()
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }
}