import { LicenseService } from '../services/LicenseService'
import { LicenseRepository } from '../database/repositories/LicenseRepository'
import BetterSqlite3 from 'better-sqlite3'

export type FeatureLicencia =
  | 'descarga'
  | 'importacion'
  | 'consolidacion'
  | 'pendientes'
  | 'cumplimiento'
  | 'constancia'
  | 'agregarRfc'
  | 'registrarMaquina'

export type ContadorLicencia =
  | 'descargas'
  | 'importaciones'
  | 'consolidaciones'
  | 'pendientes'
  | 'cumplimientos'
  | 'constancias'

export class LicenseHelper {
  constructor(
    private licenseService: LicenseService,
    private db: BetterSqlite3.Database
  ) {}

  validateFeature(feature: FeatureLicencia): {
    valido: boolean
    motivo?: string
    usos_restantes?: number
  } {
    const validations: {
      [key: string]: () => { valido: boolean; motivo?: string; usos_restantes?: number }
    } = {
      descarga: () => this.licenseService.validarDescargaCfdi(),
      importacion: () => this.licenseService.validarImportacionCfdi(),
      consolidacion: () => this.licenseService.validarConsolidacion(),
      pendientes: () => this.licenseService.validarPendientesCfdi(),
      cumplimiento: () => this.licenseService.validarCumplimiento(),
      constancia: () => this.licenseService.validarConstancia(),
      agregarRfc: () => this.licenseService.validarAgregarRfc(),
      registrarMaquina: () => this.licenseService.validarRegistrarMaquina()
    }
    return validations[feature]()
  }

  incrementCounter(counter: ContadorLicencia): void {
    const repo = new LicenseRepository(this.db)
    const increments: { [key: string]: () => void } = {
      descargas: () => repo.incrementarDescargasCfdi(),
      importaciones: () => repo.incrementarImportacionesCfdi(),
      consolidaciones: () => repo.incrementarConsolidaciones(),
      pendientes: () => repo.incrementarPendientes(),
      cumplimientos: () => repo.incrementarCumplimiento(),
      constancias: () => repo.incrementarConstancia()
    }
    increments[counter]()
  }
}
