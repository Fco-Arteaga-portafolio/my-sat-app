import { Page } from 'playwright'
import { ParametrosBusqueda, FacturaExtraida } from './SatTypes'

export class SatBusquedaService {
    async buscarPorParametros(
        page: Page,
        params: ParametrosBusqueda,
        onProgreso?: (mesActual: number, totalMeses: number) => void
    ): Promise<FacturaExtraida[]> {
        if (params.buscarPor === 'folio') {
            return this.buscarEnPagina(page, params)
        }

        if (params.tipo === 'recibidas') {
            return this.buscarRecibidasPorMes(page, params, onProgreso)
        }

        return this.buscarEnPagina(page, params)
    }

    private async buscarRecibidasPorMes(
        page: Page,
        params: ParametrosBusqueda,
        onProgreso?: (mesActual: number, totalMeses: number) => void
    ): Promise<FacturaExtraida[]> {
        const meses = this.dividirEnMeses(params.fechaInicio!, params.fechaFin!)

        const [dI, mI, aI] = params.fechaInicio!.split('/').map(Number)
        const [dF, mF, aF] = params.fechaFin!.split('/').map(Number)
        const fechaMin = new Date(aI, mI - 1, dI, 0, 0, 0)
        const fechaMax = new Date(aF, mF - 1, dF, 23, 59, 59)

        const todas: FacturaExtraida[] = []

        for (let i = 0; i < meses.length; i++) {
            onProgreso?.(i + 1, meses.length)
            const paramsMes: ParametrosBusqueda = { ...params, fechaInicio: meses[i].inicio, fechaFin: meses[i].fin }
            const filas = await this.buscarEnPagina(page, paramsMes)

            const filtradas = filas.filter(f => {
                const fechaFactura = new Date(f.fecha_emision.replace(' ', 'T'))
                return fechaFactura >= fechaMin && fechaFactura <= fechaMax
            })

            todas.push(...filtradas)
            console.log(`Mes ${i + 1}/${meses.length}: ${filtradas.length} facturas`)
        }

        return todas
    }

    async buscarEnPagina(page: Page, params: ParametrosBusqueda): Promise<FacturaExtraida[]> {
        const urlConsulta = params.tipo === 'recibidas'
            ? 'https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaReceptor.aspx'
            : 'https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaEmisor.aspx'

        await page.goto(urlConsulta)
        await page.waitForSelector('#ctl00_MainContent_BtnBusqueda', { timeout: 15000 })

        if (params.buscarPor === 'folio') {
            await page.click('#ctl00_MainContent_RdoFolioFiscal')
            await page.waitForTimeout(1000)
            await page.fill('#ctl00_MainContent_TxtUUID', params.folioFiscal!)
        } else {
            await page.click('#ctl00_MainContent_RdoFechas')
            await page.waitForTimeout(1500)

            const [diaI, mesI, anioI] = params.fechaInicio!.split('/')

            if (params.tipo === 'recibidas') {
                await page.selectOption('#DdlAnio', anioI)
                await page.waitForTimeout(500)
                await page.selectOption('#ctl00_MainContent_CldFecha_DdlMes', String(parseInt(mesI)))
                await page.waitForTimeout(300)
                await page.selectOption('#ctl00_MainContent_CldFecha_DdlDia', String(parseInt(diaI)))
            } else {
                const [diaF, mesF, anioF] = params.fechaFin!.split('/')

                await page.evaluate((id) => {
                    const el = document.getElementById(id) as HTMLInputElement | null
                    if (el) el.removeAttribute('disabled')
                }, 'ctl00_MainContent_CldFechaInicial2_Calendario_text')
                await page.fill('#ctl00_MainContent_CldFechaInicial2_Calendario_text', `${diaI}/${mesI}/${anioI}`)
                await page.waitForTimeout(300)

                await page.evaluate((id) => {
                    const el = document.getElementById(id) as HTMLInputElement | null
                    if (el) el.removeAttribute('disabled')
                }, 'ctl00_MainContent_CldFechaFinal2_Calendario_text')
                await page.fill('#ctl00_MainContent_CldFechaFinal2_Calendario_text', `${diaF}/${mesF}/${anioF}`)
                await page.waitForTimeout(300)

                await page.selectOption('#ctl00_MainContent_CldFechaFinal2_DdlHora', '23')
                await page.selectOption('#ctl00_MainContent_CldFechaFinal2_DdlMinuto', '59')
                await page.selectOption('#ctl00_MainContent_CldFechaFinal2_DdlSegundo', '59')
            }
        }

        if (params.rfcTercero) {
            await page.fill('#ctl00_MainContent_TxtRfcReceptor', params.rfcTercero)
        }

        if (params.estadoComprobante) {
            const valorEstado = params.estadoComprobante === 'cancelado' ? '0' : '1'
            await page.selectOption('#ctl00_MainContent_DdlEstadoComprobante', valorEstado)
        }

        await page.click('#ctl00_MainContent_BtnBusqueda')
        await page.waitForTimeout(6000)

        const sinResultados = await page.$('#ctl00_MainContent_PnlNoResultados')
        if (sinResultados && await sinResultados.isVisible()) return []

        return page.$$eval(
            '#ctl00_MainContent_tblResult tbody tr:not(:first-child)',
            (filas) => filas.map((fila) => {
                const celdas = fila.querySelectorAll('td')
                if (celdas.length < 17) return null

                const checkbox = fila.querySelector('input.ListaFolios') as HTMLInputElement
                const btnDescarga = fila.querySelector('#BtnDescarga') as HTMLElement
                const getText = (idx: number) => celdas[idx]?.textContent?.trim() || ''
                const onclick = btnDescarga?.getAttribute('onclick') || ''
                const match = onclick.match(/RecuperaCfdi\.aspx\?Datos=[^']+/)
                const urlDescarga = match ? match[0] : ''

                const totalStr = getText(16).replace('$', '').replace(/,/g, '').trim()
                const tipoTexto = getText(17).toLowerCase()
                let tipo = 'I'
                if (tipoTexto.includes('egreso')) tipo = 'E'
                else if (tipoTexto.includes('traslado')) tipo = 'T'
                else if (tipoTexto.includes('nómina') || tipoTexto.includes('nomina')) tipo = 'N'
                else if (tipoTexto.includes('pago')) tipo = 'P'

                return {
                    uuid: checkbox?.value || getText(8),
                    rfc_emisor: getText(9),
                    nombre_emisor: getText(10),
                    rfc_receptor: getText(11),
                    nombre_receptor: getText(12),
                    fecha_emision: getText(13),
                    total: parseFloat(totalStr) || 0,
                    tipo_comprobante: tipo,
                    estado: getText(19).toLowerCase().includes('vigente') ? 'vigente' : 'cancelado',
                    urlDescarga
                }
            }).filter(Boolean) as any[]
        )
    }

    private dividirEnMeses(fechaInicio: string, fechaFin: string): { inicio: string; fin: string }[] {
        const [_diaI, mesI, anioI] = fechaInicio.split('/').map(Number)
        const [_diaF, mesF, anioF] = fechaFin.split('/').map(Number)

        const meses: { inicio: string; fin: string }[] = []
        let anio = anioI
        let mes = mesI

        while (anio < anioF || (anio === anioF && mes <= mesF)) {
            const ultimoDia = new Date(anio, mes, 0).getDate()

            const inicio = anio === anioI && mes === mesI
                ? fechaInicio
                : `01/${String(mes).padStart(2, '0')}/${anio}`

            const fin = anio === anioF && mes === mesF
                ? fechaFin
                : `${ultimoDia}/${String(mes).padStart(2, '0')}/${anio}`

            meses.push({ inicio, fin })
            mes++
            if (mes > 12) { mes = 1; anio++ }
        }

        return meses
    }
}