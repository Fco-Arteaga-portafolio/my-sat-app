import BetterSqlite3 from 'better-sqlite3'
import { ProfileManager } from '../ProfileManager'

export interface Factura {
  id?: number
  uuid: string
  version?: string
  serie?: string
  folio?: string
  fecha_emision: string
  fecha_timbrado?: string
  rfc_emisor: string
  nombre_emisor: string
  rfc_receptor: string
  nombre_receptor: string
  subtotal: number
  descuento?: number
  total_impuestos_trasladados?: number
  total_impuestos_retenidos?: number
  total: number
  tipo_comprobante: 'I' | 'E' | 'T' | 'N' | 'P'
  forma_pago?: string
  metodo_pago?: string
  moneda?: string
  tipo_cambio?: number
  estado: 'vigente' | 'cancelado'
  estado_cancelacion?: string
  estado_proceso_cancelacion?: string
  fecha_cancelacion?: string
  rfc_pac?: string
  folio_sustitucion?: string
  xml: string
  fecha_descarga?: string
  tipo_descarga?: 'recibida' | 'emitida'
}

export interface FacturaPago extends Factura {
  fecha_pago?: string
  forma_pago_p?: string
  moneda_p?: string
  tipo_cambio_p?: number
  monto?: number
  documentos?: string
}

export interface FacturaNomina extends Factura {
  tipo_nomina?: string
  fecha_pago?: string
  fecha_inicial_pago?: string
  fecha_final_pago?: string
  num_dias_pagados?: number
  total_percepciones?: number
  total_deducciones?: number
  total_otros_pagos?: number
  curp?: string
  num_empleado?: string
  departamento?: string
  puesto?: string
  tipo_regimen?: string
  tipo_contrato?: string
  periodicidad_pago?: string
  salario_diario_integrado?: number
}

export interface FiltrosFacturasRepo {
  tiposComprobante?: string[]
  busqueda?: string
  fechaDesde?: string
  fechaHasta?: string
  rfcContraparte?: string
  tipoComprobante?: string
  formaPago?: string
  metodoPago?: string
  estado?: string
}

export class FacturaRepository {
  constructor(private readonly db: BetterSqlite3.Database) { }

  private get tabla(): string {
    return ProfileManager.getTablaFacturas()
  }

  private get tablaPagos(): string {
    return ProfileManager.getTablaPagosComplemento()
  }

  private get tablaNomina(): string {
    return ProfileManager.getTablaNominaComplemento()
  }

  insertar(factura: Factura): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO ${this.tabla}
        (uuid, version, serie, folio, fecha_emision, fecha_timbrado,
         rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor,
         subtotal, descuento, total_impuestos_trasladados, total_impuestos_retenidos,
         total, tipo_comprobante, forma_pago, metodo_pago, moneda, tipo_cambio,
         estado, estado_cancelacion, estado_proceso_cancelacion, fecha_cancelacion,
         rfc_pac, folio_sustitucion, xml, tipo_descarga)
      VALUES
        (@uuid, @version, @serie, @folio, @fecha_emision, @fecha_timbrado,
         @rfc_emisor, @nombre_emisor, @rfc_receptor, @nombre_receptor,
         @subtotal, @descuento, @total_impuestos_trasladados, @total_impuestos_retenidos,
         @total, @tipo_comprobante, @forma_pago, @metodo_pago, @moneda, @tipo_cambio,
         @estado, @estado_cancelacion, @estado_proceso_cancelacion, @fecha_cancelacion,
         @rfc_pac, @folio_sustitucion, @xml, @tipo_descarga)
    `)
    stmt.run({
      version: null, serie: null, folio: null, fecha_timbrado: null,
      descuento: 0, total_impuestos_trasladados: 0, total_impuestos_retenidos: 0,
      forma_pago: null, metodo_pago: null, moneda: null, tipo_cambio: null,
      estado_cancelacion: null, estado_proceso_cancelacion: null,
      fecha_cancelacion: null, rfc_pac: null, folio_sustitucion: null,
      ...factura
    })
  }

  actualizar(uuid: string, campos: Partial<Factura>): void {
    const keys = Object.keys(campos).filter(k => k !== 'uuid')
    if (keys.length === 0) return
    const sets = keys.map(k => `${k} = @${k}`).join(', ')
    const stmt = this.db.prepare(`UPDATE ${this.tabla} SET ${sets} WHERE uuid = @uuid`)
    stmt.run({ ...campos, uuid })
  }

  obtenerTodas(): Factura[] {
    return this.db
      .prepare(`SELECT * FROM ${this.tabla} ORDER BY fecha_emision DESC`)
      .all() as Factura[]
  }

  obtenerPorRfc(rfc: string): Factura[] {
    return this.db.prepare(`
      SELECT * FROM ${this.tabla}
      WHERE rfc_emisor = ? OR rfc_receptor = ?
      ORDER BY fecha_emision DESC
    `).all(rfc, rfc) as Factura[]
  }

  obtenerPorUuid(uuid: string): Factura | null {
    return this.db
      .prepare(`SELECT * FROM ${this.tabla} WHERE uuid = ?`)
      .get(uuid) as Factura | null
  }

  eliminar(uuid: string): void {
    this.db.prepare(`DELETE FROM ${this.tabla} WHERE uuid = ?`).run(uuid)
  }

  obtenerDrillDown(rfc: string): Factura[] {
    return this.db.prepare(`
      SELECT * FROM ${this.tabla}
      WHERE (rfc_emisor = ? OR rfc_receptor = ?)
        AND tipo_comprobante IN ('I', 'E')
        AND estado = 'vigente'
      ORDER BY fecha_emision DESC
    `).all(rfc, rfc) as Factura[]
  }

  obtenerPorTipoDescarga(
    tipoDescarga: 'recibida' | 'emitida',
    filtros: FiltrosFacturasRepo = {}
  ): Factura[] | FacturaPago[] | FacturaNomina[] {
    const esPago = filtros.tiposComprobante?.length === 1 && filtros.tiposComprobante[0] === 'P'
    const esNomina = filtros.tiposComprobante?.length === 1 && filtros.tiposComprobante[0] === 'N'

    const condiciones: string[] = ['f.tipo_descarga = @tipoDescarga']
    const params: Record<string, string> = { tipoDescarga }

    if (filtros.tiposComprobante?.length) {
      const placeholders = filtros.tiposComprobante.map((_, i) => `@tc${i}`).join(', ')
      filtros.tiposComprobante.forEach((v, i) => { params[`tc${i}`] = v })
      condiciones.push(`f.tipo_comprobante IN (${placeholders})`)
    }
    if (filtros.fechaDesde) {
      condiciones.push('f.fecha_emision >= @fechaDesde')
      params.fechaDesde = filtros.fechaDesde
    }
    if (filtros.fechaHasta) {
      condiciones.push('f.fecha_emision <= @fechaHasta')
      params.fechaHasta = filtros.fechaHasta + 'T23:59:59'
    }
    if (filtros.rfcContraparte) {
      const campo = tipoDescarga === 'recibida' ? 'f.rfc_emisor' : 'f.rfc_receptor'
      condiciones.push(`${campo} LIKE @rfcContraparte`)
      params.rfcContraparte = `%${filtros.rfcContraparte}%`
    }
    if (filtros.tipoComprobante) {
      condiciones.push('f.tipo_comprobante = @tipoComprobante')
      params.tipoComprobante = filtros.tipoComprobante
    }
    if (filtros.formaPago) {
      condiciones.push('f.forma_pago = @formaPago')
      params.formaPago = filtros.formaPago
    }
    if (filtros.metodoPago) {
      condiciones.push('f.metodo_pago = @metodoPago')
      params.metodoPago = filtros.metodoPago
    }
    if (filtros.estado) {
      condiciones.push('f.estado = @estado')
      params.estado = filtros.estado
    }
    if (filtros.busqueda) {
      condiciones.push(`(
        f.uuid LIKE @b OR
        f.rfc_emisor LIKE @b OR f.nombre_emisor LIKE @b OR
        f.rfc_receptor LIKE @b OR f.nombre_receptor LIKE @b OR
        f.serie LIKE @b OR f.folio LIKE @b
      )`)
      params.b = `%${filtros.busqueda}%`
    }

    const where = condiciones.join(' AND ')

    if (esPago) {
      return this.db.prepare(`
        SELECT
          f.*,
          p.fecha_pago,
          p.forma_pago_p,
          p.moneda_p,
          p.tipo_cambio_p,
          p.monto,
          p.documentos
        FROM ${this.tabla} f
        LEFT JOIN ${this.tablaPagos} p ON p.uuid_rep = f.uuid
        WHERE ${where}
        ORDER BY p.fecha_pago DESC, f.fecha_timbrado DESC
      `).all(params) as FacturaPago[]
    }

    if (esNomina) {
      return this.db.prepare(`
        SELECT
          f.*,
          n.tipo_nomina,
          n.fecha_pago,
          n.fecha_inicial_pago,
          n.fecha_final_pago,
          n.num_dias_pagados,
          n.total_percepciones,
          n.total_deducciones,
          n.total_otros_pagos,
          n.curp,
          n.num_empleado,
          n.departamento,
          n.puesto,
          n.tipo_regimen,
          n.tipo_contrato,
          n.periodicidad_pago,
          n.salario_diario_integrado
        FROM ${this.tabla} f
        LEFT JOIN ${this.tablaNomina} n ON n.uuid_cfdi = f.uuid
        WHERE ${where}
        ORDER BY n.fecha_pago DESC, f.fecha_timbrado DESC
      `).all(params) as FacturaNomina[]
    }

    return this.db
      .prepare(`SELECT f.* FROM ${this.tabla} f WHERE ${where} ORDER BY f.fecha_emision DESC`)
      .all(params) as Factura[]
  }

  contarPorTipoDescarga(): { recibidas: number; emitidas: number; nomina: number; pagos: number } {
    const row = this.db.prepare(`
      SELECT
        SUM(CASE WHEN tipo_descarga = 'recibida' THEN 1 ELSE 0 END) AS recibidas,
        SUM(CASE WHEN tipo_descarga = 'emitida'  THEN 1 ELSE 0 END) AS emitidas,
        SUM(CASE WHEN tipo_comprobante = 'N'     THEN 1 ELSE 0 END) AS nomina,
        SUM(CASE WHEN tipo_comprobante = 'P'     THEN 1 ELSE 0 END) AS pagos
      FROM ${this.tabla}
    `).get() as { recibidas: number; emitidas: number; nomina: number; pagos: number }
    return {
      recibidas: row.recibidas || 0,
      emitidas: row.emitidas || 0,
      nomina: row.nomina || 0,
      pagos: row.pagos || 0
    }
  }
}