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

        ipcMain.handle('validar-descarga-cfdi', async () => {
            try {
                const validacion = this.service.validarDescargaCfdi()
                return { success: true, ...validacion }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })

        ipcMain.handle('incrementar-descarga-cfdi', async () => {
            try {
                const repository = new LicenseRepository((this.service as any).repository.db)
                repository.incrementarDescargasCfdi()
                return { success: true }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })

        ipcMain.handle('validar-importacion-cfdi', async () => {
            try {
                const validacion = this.service.validarImportacionCfdi()
                return { success: true, ...validacion }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })

        ipcMain.handle('incrementar-importacion-cfdi', async () => {
            try {
                const repository = new LicenseRepository((this.service as any).repository.db)
                repository.incrementarImportacionesCfdi()
                return { success: true }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })

        ipcMain.handle('validar-consolidacion', async () => {
            try {
                const validacion = this.service.validarConsolidacion()
                return { success: true, ...validacion }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })

        ipcMain.handle('incrementar-consolidacion', async () => {
            try {
                const repository = new LicenseRepository((this.service as any).repository.db)
                repository.incrementarConsolidaciones()
                return { success: true }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        })
    }
}
