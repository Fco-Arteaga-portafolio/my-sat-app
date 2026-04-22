import { ipcMain } from 'electron'
import { LicenseService } from '../services/LicenseService'
import { LicenseRepository } from '../database/repositories/LicenseRepository'
import BetterSqlite3 from 'better-sqlite3'

export class LicenseHandler {
    private service: LicenseService

    constructor(db: BetterSqlite3.Database) {
        const repository = new LicenseRepository(db)
        this.service = new LicenseService(repository)
    }

    registrar(): void {
        ipcMain.handle('obtener-licencia', async () => {
            try {
                const licencia = this.service.obtenerLicencia()
                return { success: true, licencia }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })

        ipcMain.handle('obtener-estado-licencia', async () => {
            try {
                const estado = this.service.obtenerEstado()
                return { success: true, estado }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })

        ipcMain.handle('validar-agregar-rfc', async () => {
            try {
                const validacion = this.service.validarAgregarRfc()
                return { success: true, ...validacion }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })

        ipcMain.handle('validar-registrar-maquina', async () => {
            try {
                const validacion = this.service.validarRegistrarMaquina()
                return { success: true, ...validacion }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })
    }
}
