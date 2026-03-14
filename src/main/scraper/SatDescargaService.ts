import { Page } from 'playwright'
import * as fs from 'fs'
import { join } from 'path'
import axios from 'axios'
import { FacturaExtraida, ErrorDescarga, MetaCfdi } from './SatTypes'

export interface ResultadoDescarga {
    exitosas: Array<{ rutaTemp: string; meta: MetaCfdi }>
    errores: ErrorDescarga[]
}

export class SatDescargaService {
    private readonly LOTE_SIZE = 10

    async descargarEnLote(
        page: Page,
        filas: FacturaExtraida[],
        carpetaTemp: string,
        onProgreso?: (descargadas: number, total: number, uuid: string) => void
    ): Promise<ResultadoDescarga> {
        const exitosas: ResultadoDescarga['exitosas'] = []
        const errores: ErrorDescarga[] = []

        const context = page.context()
        const cookies = await context.cookies()
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')
        const userAgent = await page.evaluate(() => navigator.userAgent)
        const referer = page.url()

        let procesadas = 0

        for (let i = 0; i < filas.length; i += this.LOTE_SIZE) {
            const lote = filas.slice(i, i + this.LOTE_SIZE)

            const resultados = await Promise.all(
                lote.map(fila => this.descargarUnoConAxios(fila, carpetaTemp, cookieString, userAgent, referer))
            )

            for (const r of resultados) {
                if (r) exitosas.push(r)
                else if (lote[resultados.indexOf(r)]) {
                    const fila = lote[resultados.indexOf(r)]
                    errores.push({ uuid: fila.uuid, error: 'Descarga fallida', fila })
                }
            }

            procesadas += lote.length
            onProgreso?.(procesadas, filas.length, lote[lote.length - 1]?.uuid || '')
        }

        return { exitosas, errores }
    }

    async descargarUnoConPlaywright(
        page: Page,
        urlRelativa: string,
        uuid: string,
        carpetaTemp: string
    ): Promise<string | null> {
        try {
            const urlCompleta = `https://portalcfdi.facturaelectronica.sat.gob.mx/${urlRelativa}`
            const rutaFinal = join(carpetaTemp, `${uuid}.xml`)

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 20000 }),
                page.evaluate((url) => { window.location.href = url }, urlCompleta)
            ])

            const rutaTemp = await download.path()
            if (!rutaTemp) return null

            fs.renameSync(rutaTemp, rutaFinal)
            return rutaFinal
        } catch {
            return null
        }
    }

    private async descargarUnoConAxios(
        fila: FacturaExtraida,
        carpetaTemp: string,
        cookieString: string,
        userAgent: string,
        referer: string
    ): Promise<ResultadoDescarga['exitosas'][0] | null> {
        if (!fila.urlDescarga) return null

        try {
            const urlCompleta = `https://portalcfdi.facturaelectronica.sat.gob.mx/${fila.urlDescarga}`
            const rutaTemp = join(carpetaTemp, `${fila.uuid}.xml`)

            const response = await axios({
                method: 'get',
                url: urlCompleta,
                headers: {
                    Cookie: cookieString,
                    'User-Agent': userAgent,
                    Referer: referer,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                timeout: 15000,
                responseType: 'text'
            })

            if (!response.data.includes('<?xml')) return null

            fs.writeFileSync(rutaTemp, response.data)

            return {
                rutaTemp,
                meta: {
                    uuid: fila.uuid,
                    rfc_emisor: fila.rfc_emisor,
                    nombre_emisor: fila.nombre_emisor,
                    rfc_receptor: fila.rfc_receptor,
                    nombre_receptor: fila.nombre_receptor,
                    fecha_emision: fila.fecha_emision,
                    total: fila.total,
                    tipo_comprobante: fila.tipo_comprobante,
                    estado: fila.estado,
                    tipo_descarga: fila.tipo_descarga as 'recibida' | 'emitida'
                }
            }
        } catch (err: any) {
            console.error(`Fallo descarga ${fila.uuid}:`, err.message)
            return null
        }
    }
}