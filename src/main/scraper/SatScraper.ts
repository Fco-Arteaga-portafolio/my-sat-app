import { chromium, BrowserContext, Page } from 'playwright'
import { SatAuthService } from './SatAuthService'
import { Configuracion } from '../services/ConfiguracionService'
import { app } from 'electron'
import * as fs from 'fs'
import { join } from 'path'
import axios from 'axios';

export interface FacturaExtraida {
  uuid: string
  rfc_emisor: string
  nombre_emisor: string
  rfc_receptor: string
  nombre_receptor: string
  fecha_emision: string
  total: number
  tipo_comprobante: string
  estado: string
  urlDescarga: string
  tipo_descarga?: string  // ← agregar
}

export interface ParametrosBusqueda {
  tipo: 'emitidas' | 'recibidas'
  buscarPor: 'fecha' | 'folio'
  fechaInicio?: string
  fechaFin?: string
  folioFiscal?: string
  rfcTercero?: string
  estadoComprobante?: string
  tipoComprobante?: string
}

export interface ProgresoDescarga {
  etapa: 'buscando' | 'descargando' | 'completado'
  mesActual?: number
  totalMeses?: number
  descargadas?: number
  totalFacturas?: number
  uuid?: string
}

export interface ErrorDescarga {
  uuid: string
  error: string
  fila: {
    rfc_emisor: string
    nombre_emisor: string
    rfc_receptor: string
    nombre_receptor: string
    fecha_emision: string
    total: number
    tipo_comprobante: string
    estado: string
    urlDescarga: string
  }
}

export class SatScraper {
  private context: BrowserContext | null = null
  private authService: SatAuthService | null = null

  async iniciar(): Promise<void> {
    if (this.context) {
      console.log('Browser ya existe, reutilizando')
      return
    }
    console.log('Creando nuevo browser')
    const browser = await chromium.launch({ headless: false })
    this.context = await browser.newContext()
    this.authService = new SatAuthService(this.context)
  }

  async obtenerCaptcha(): Promise<string> {
    if (!this.authService) await this.iniciar()
    const resultado = await this.authService!.obtenerCaptcha()
    return resultado.imagenBase64
  }

  async descargarFacturas(
    config: Configuracion,
    params: ParametrosBusqueda,
    captcha?: string,
    onProgreso?: (progreso: ProgresoDescarga) => void
  ): Promise<{ facturas: FacturaExtraida[]; errores: ErrorDescarga[] }> {
    if (!this.authService) throw new Error('Debes cargar el captcha primero')

    let page: Page

    if (config.metodoAuth === 'contrasena') {
      page = await this.authService!.loginConContrasena(config.rfc, config.contrasena!, captcha!)
    } else {
      page = await this.authService!.loginConEfirma(config.rutaCer!, config.rutaKey!, config.contrasenaFiel!)
    }

    const carpeta = config.carpetaDescarga || app.getPath('downloads')
    let todasLasFilas: (FacturaExtraida & { urlDescarga: string })[] = []

    if (params.buscarPor === 'folio') {
      // Búsqueda por folio — una sola búsqueda
      const filas = await this.buscarEnPagina(page, params)
      todasLasFilas = filas
    } else if (params.tipo === 'recibidas') {
      // Recibidas — dividir por mes
      const meses = this.dividirEnMeses(params.fechaInicio!, params.fechaFin!)

      // 1. Convertimos las fechas de filtro del usuario a objetos Date para comparar fácil
      // Asumiendo formato DD/MM/YYYY
      const [dI, mI, aI] = params.fechaInicio!.split('/').map(Number);
      const [dF, mF, aF] = params.fechaFin!.split('/').map(Number);
      const fechaMin = new Date(aI, mI - 1, dI, 0, 0, 0);
      const fechaMax = new Date(aF, mF - 1, dF, 23, 59, 59);

      for (let i = 0; i < meses.length; i++) {
        const mes = meses[i]
        onProgreso?.({ etapa: 'buscando', mesActual: i + 1, totalMeses: meses.length })

        const paramsMes: ParametrosBusqueda = { ...params, fechaInicio: mes.inicio, fechaFin: mes.fin }
        const filasMes = await this.buscarEnPagina(page, paramsMes)

        // 2. EL POST-FILTRO: 
        // Solo nos quedamos con las que están REALMENTE en el rango del usuario
        const filasFiltradas = filasMes.filter(f => {
          // El SAT devuelve la fecha como "2026-03-02T10:00:00" o similar
          const fechaFactura = new Date(f.fecha_emision.replace(' ', 'T'));
          return fechaFactura >= fechaMin && fechaFactura <= fechaMax;
        });

        todasLasFilas.push(...filasFiltradas);
        console.log(`Mes ${i + 1}/${meses.length}: ${filasFiltradas.length} facturas`)
      }
    } else {
      // Emitidas — rango exacto directo
      const filas = await this.buscarEnPagina(page, params)
      todasLasFilas = filas
    }

    console.log(`Total facturas a procesar: ${todasLasFilas.length}`)

    // 1. Recibimos el objeto completo (usamos desestructuración)
    const { facturas, errores } = await this.descargarEnParalelo(page, todasLasFilas, carpeta, (progreso) => {
      onProgreso?.({ etapa: 'descargando', ...progreso })
    })

    // 2. Si hubo errores, podemos loguearlos aquí para debug
    if (errores.length > 0) {
      console.warn(`Se terminaron con ${errores.length} errores de descarga.`);
      // Opcional: podrías guardar estos errores en un log físico aquí
    }

    onProgreso?.({ etapa: 'completado', totalFacturas: facturas.length })

    // 3. Devolvemos solo las facturas para no romper el contrato con FacturaService
    return { facturas, errores }
  }

  private dividirEnMeses(fechaInicio: string, fechaFin: string): { inicio: string; fin: string }[] {
    // Formato entrada: DD/MM/YYYY
    const [diaI, mesI, anioI] = fechaInicio.split('/').map(Number)
    const [diaF, mesF, anioF] = fechaFin.split('/').map(Number)

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

  private async buscarEnPagina(page: Page, params: ParametrosBusqueda): Promise<any[]> {
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
        // Emitidas — rango de fechas
        const [diaF, mesF, anioF] = params.fechaFin!.split('/')
        await page.fill('#ctl00_MainContent_CldFecha_FechaInicial', `${diaI}/${mesI}/${anioI}`)
        await page.waitForTimeout(300)
        await page.fill('#ctl00_MainContent_CldFecha_FechaFinal', `${diaF}/${mesF}/${anioF}`)
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
    await page.waitForTimeout(3000)

    const sinResultados = await page.$('#ctl00_MainContent_PnlNoResultados')
    if (sinResultados && await sinResultados.isVisible()) return []

    return await page.$$eval(
      '#ctl00_MainContent_tblResult tbody tr:not(:first-child)',
      (filas) => {
        return filas.map((fila) => {
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
        }).filter(Boolean)
      }
    )
  }

  private async descargarEnParalelo(
    page: Page,
    filas: any[],
    carpeta: string,
    onProgreso?: (p: { descargadas: number; totalFacturas: number; uuid: string }) => void
  ): Promise<{ facturas: FacturaExtraida[]; errores: ErrorDescarga[] }> { // <-- FIX: Uso de llaves para el objeto
    const facturas: FacturaExtraida[] = [];
    const errores: ErrorDescarga[] = [];
    let descargadas = 0;

    const context = page.context();
    const cookies = await context.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const currentUrl = page.url();

    const LOTE_SIZE = 10;

    for (let i = 0; i < filas.length; i += LOTE_SIZE) {
      const lote = filas.slice(i, i + LOTE_SIZE);

      const resultadosLote = await Promise.all(
        lote.map(async (fila) => {
          if (!fila.urlDescarga) return null;

          try {
            const urlCompleta = `https://portalcfdi.facturaelectronica.sat.gob.mx/${fila.urlDescarga}`;
            const rutaFinal = join(carpeta, `${fila.uuid}.xml`);

            const response = await axios({
              method: 'get',
              url: urlCompleta,
              headers: {
                'Cookie': cookieString,
                'User-Agent': userAgent,
                'Referer': currentUrl,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              },
              timeout: 15000,
              responseType: 'text'
            });

            if (response.data.includes('<?xml')) {
              fs.writeFileSync(rutaFinal, response.data);
              return { ...fila, urlDescarga: rutaFinal };
            } else {
              errores.push({ uuid: fila.uuid, error: 'El SAT no devolvió un XML válido', fila });
              return null;
            }
          } catch (err: any) {
            console.error(`Fallo en descarga de ${fila.uuid}:`, err.message);
            errores.push({ uuid: fila.uuid, error: err.message, fila });
            return null;
          }
        })
      );

      // Filtramos los nulos (los que fallaron) y agregamos los exitosos
      const exitosos = resultadosLote.filter((f): f is FacturaExtraida => f !== null);
      facturas.push(...exitosos);

      descargadas += lote.length;

      onProgreso?.({
        descargadas,
        totalFacturas: filas.length,
        uuid: lote[lote.length - 1]?.uuid || ''
      });
    }

    return { facturas, errores };
  }

  async cerrar(): Promise<void> {
    if (this.context) {
      await this.context.browser()?.close()
      this.context = null
      this.authService = null
    }
  }

  async reintentarDescargas(
    config: Configuracion,
    captcha?: string,
    pendientes?: any[],
    onProgreso?: (progreso: ProgresoDescarga) => void
  ): Promise<{ facturas: FacturaExtraida[]; errores: ErrorDescarga[] }> {
    let page: Page

    if (config.metodoAuth === 'contrasena') {
      page = await this.authService!.loginConContrasena(config.rfc, config.contrasena!, captcha!)
    } else {
      page = await this.authService!.loginConEfirma(config.rutaCer!, config.rutaKey!, config.contrasenaFiel!)
    }

    const carpeta = config.carpetaDescarga || app.getPath('downloads')
    const facturas: FacturaExtraida[] = []
    const errores: ErrorDescarga[] = []
    let procesadas = 0

    for (const pendiente of pendientes!) {
      try {
        onProgreso?.({
          etapa: 'descargando',
          descargadas: procesadas,
          totalFacturas: pendientes!.length,
          uuid: pendiente.uuid
        })

        // Buscar por UUID en el portal para obtener URL fresca
        const urlConsulta = pendiente.tipo_descarga === 'recibida'
          ? 'https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaReceptor.aspx'
          : 'https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaEmisor.aspx'

        await page.goto(urlConsulta)
        await page.waitForSelector('#ctl00_MainContent_BtnBusqueda', { timeout: 15000 })
        await page.click('#ctl00_MainContent_RdoFolioFiscal')
        await page.waitForTimeout(1000)
        await page.fill('#ctl00_MainContent_TxtUUID', pendiente.uuid)
        await page.click('#ctl00_MainContent_BtnBusqueda')
        await page.waitForTimeout(3000)

        const sinResultados = await page.$('#ctl00_MainContent_PnlNoResultados')
        if (sinResultados && await sinResultados.isVisible()) {
          errores.push({ uuid: pendiente.uuid, error: 'No encontrado en el portal', fila: pendiente })
          procesadas++
          continue
        }

        // Obtener URL fresca de descarga
        const filas = await page.$$eval(
          '#ctl00_MainContent_tblResult tbody tr:not(:first-child)',
          (filas) => filas.map((fila) => {
            const btnDescarga = fila.querySelector('#BtnDescarga') as HTMLElement
            const onclick = btnDescarga?.getAttribute('onclick') || ''
            const match = onclick.match(/RecuperaCfdi\.aspx\?Datos=[^']+/)
            return match ? match[0] : ''
          }).filter(Boolean)
        )

        if (!filas.length) {
          errores.push({ uuid: pendiente.uuid, error: 'No se encontró botón de descarga', fila: pendiente })
          procesadas++
          continue
        }

        // Descargar con Playwright
        const urlCompleta = `https://portalcfdi.facturaelectronica.sat.gob.mx/${filas[0]}`
        const rutaFinal = join(carpeta, `${pendiente.uuid}.xml`)

        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 20000 }),
          page.evaluate((url) => { window.location.href = url }, urlCompleta)
        ])

        const rutaTemp = await download.path()
        if (rutaTemp) {
          fs.renameSync(rutaTemp, rutaFinal)
          facturas.push({
            uuid: pendiente.uuid,
            rfc_emisor: pendiente.rfc_emisor,
            nombre_emisor: pendiente.nombre_emisor,
            rfc_receptor: pendiente.rfc_receptor,
            nombre_receptor: pendiente.nombre_receptor,
            fecha_emision: pendiente.fecha_emision,
            total: pendiente.total,
            tipo_comprobante: pendiente.tipo_comprobante,
            estado: pendiente.estado,
            urlDescarga: rutaFinal,
            tipo_descarga: pendiente.tipo_descarga
          })
        } else {
          errores.push({ uuid: pendiente.uuid, error: 'No se pudo guardar el archivo', fila: pendiente })
        }
      } catch (err: any) {
        console.error(`Error reintentando ${pendiente.uuid}:`, err.message)
        errores.push({ uuid: pendiente.uuid, error: err.message, fila: pendiente })
      }

      procesadas++
    }

    onProgreso?.({ etapa: 'completado', totalFacturas: facturas.length })
    return { facturas, errores }
  }
}