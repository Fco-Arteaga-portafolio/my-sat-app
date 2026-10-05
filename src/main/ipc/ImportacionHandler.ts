import { dialog } from 'electron'
import { CfdiGuardadoService } from '../services/CfdiGuardadoService'
import { ConfiguracionService } from '../services/ConfiguracionService'
import * as fs from 'fs'
import * as path from 'path'
import { IpcWrapper } from './IpcWrapper'
import { LimiteUsoService } from '../services/LimiteUsoService'

export class ImportacionHandler {
  constructor(
    private readonly guardadoService: CfdiGuardadoService,
    private readonly configuracionService: ConfiguracionService,
    private readonly limiteUsoService: LimiteUsoService
  ) {}

  registrar(): void {
    IpcWrapper.handle('seleccionar-xmls', async () => {
      const result = await dialog.showOpenDialog({
        title: 'Seleccionar archivos XML',
        filters: [{ name: 'XML', extensions: ['xml'] }],
        properties: ['openFile', 'multiSelections']
      })
      return { rutas: result.canceled ? [] : result.filePaths }
    })

    IpcWrapper.handle('seleccionar-carpeta-xml', async () => {
      const result = await dialog.showOpenDialog({
        title: 'Seleccionar carpeta con XMLs',
        properties: ['openDirectory']
      })
      if (result.canceled) return { rutas: [] }

      const carpeta = result.filePaths[0]
      const rutas = fs
        .readdirSync(carpeta)
        .filter((f) => f.toLowerCase().endsWith('.xml'))
        .map((f) => path.join(carpeta, f))
      return { rutas }
    })

    IpcWrapper.handle('importar-xmls', async (_event, rutas: string[]) => {
      const config = this.configuracionService.obtener()
      const validacion = await this.limiteUsoService.validar('importacion_cfdi', config?.rfc)
      if (!validacion.valido) throw new Error(validacion.motivo)

      let importadas = 0
      let omitidas = 0
      const errores: { archivo: string; error: string }[] = []

      for (const ruta of rutas) {
        try {
          const resultado = this.guardadoService.importarDesdeRutaLocal(ruta)
          if (resultado === 'importada') importadas++
          else omitidas++
        } catch (err) {
          errores.push({
            archivo: path.basename(ruta),
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }

      if (importadas > 0 && !errores.length) {
        await this.limiteUsoService.consumir('importacion_cfdi', config?.rfc)
      }

      this.guardadoService.sincronizarCatalogos()
      return { importadas, omitidas, errores }
    })
  }
}
