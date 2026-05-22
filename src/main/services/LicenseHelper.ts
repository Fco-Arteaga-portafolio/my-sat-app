import { LicenseService } from '../services/LicenseService'
import { LicenseRepository } from '../database/repositories/LicenseRepository'
import BetterSqlite3 from 'better-sqlite3'

export class LicenseHelper {
  constructor(private licenseService: LicenseService, private db: BetterSqlite3.Database) { }

  validateFeature(feature: 'descarga' | 'importacion' | 'consolidacion' | 'agregarRfc' | 'registrarMaquina') {
    const validations: { [key: string]: () => { valido: boolean; motivo?: string } } = {
      descarga: () => this.licenseService.validarDescargaCfdi(),
      importacion: () => this.licenseService.validarImportacionCfdi(),
      consolidacion: () => this.licenseService.validarConsolidacion(),
      agregarRfc: () => this.licenseService.validarAgregarRfc(),
      registrarMaquina: () => this.licenseService.validarRegistrarMaquina()
    }
    return validations[feature]()
  }

  incrementCounter(counter: 'descargas' | 'importaciones' | 'consolidaciones') {
    const repo = new LicenseRepository(this.db)
    const increments: { [key: string]: () => void } = {
      descargas: () => repo.incrementarDescargasCfdi(),
      importaciones: () => repo.incrementarImportacionesCfdi(),
      consolidaciones: () => repo.incrementarConsolidaciones()
    }
    increments[counter]()
  }
}
