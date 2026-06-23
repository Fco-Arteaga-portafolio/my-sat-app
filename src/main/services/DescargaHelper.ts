import * as fs from 'fs'
import { CfdiGuardadoService } from './CfdiGuardadoService'

export class DescargaHelper {
  constructor(private guardadoService: CfdiGuardadoService) { }

  async procesarDescargas(exitosas: Array<{ rutaTemp: string; meta: any }>) {
    let guardadas = 0
    const errores: { uuid: string; error: string }[] = []

    for (const { rutaTemp, meta } of exitosas) {
      try {
        this.guardadoService.guardarDesdeRuta(rutaTemp, meta)
        guardadas++
      } catch (err: any) {
        errores.push({ uuid: meta.uuid, error: err.message })
      }
      finally {
        fs.unlink(rutaTemp, () => null)
      }
    }

    return { guardadas, errores }
  }
}
