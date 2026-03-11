import BetterSqlite3 from 'better-sqlite3'
import { ProfileManager } from '../ProfileManager'

export class DashboardRepository {
  constructor(private readonly db: BetterSqlite3.Database) { }

  private get tabla(): string {
    return ProfileManager.getTablaFacturas()
  }

  kpisDelMes(año: number, mes: number): any {
    const mesStr = String(mes).padStart(2, '0')
    const mesAnterior = mes === 1 ? 12 : mes - 1
    const añoAnterior = mes === 1 ? año - 1 : año
    const mesAnteriorStr = String(mesAnterior).padStart(2, '0')

    const query = (a: number, m: string) => this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as ingresos,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as egresos,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_trasladados ELSE 0 END), 0) as iva_cobrado,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_trasladados ELSE 0 END), 0) as iva_pagado
      FROM ${this.tabla}
      WHERE strftime('%Y', fecha_emision) = '${a}' AND strftime('%m', fecha_emision) = '${m}'
    `).get() as any

    const actual = query(año, mesStr)
    const anterior = query(añoAnterior, mesAnteriorStr)

    const variacion = (a: number, b: number) =>
      b === 0 ? 0 : Math.round(((a - b) / b) * 100)

    return {
      ingresos: actual.ingresos,
      egresos: actual.egresos,
      balance: actual.ingresos - actual.egresos,
      iva_estimado: actual.iva_cobrado - actual.iva_pagado,
      variacion_ingresos: variacion(actual.ingresos, anterior.ingresos),
      variacion_egresos: variacion(actual.egresos, anterior.egresos),
      variacion_balance: variacion(actual.ingresos - actual.egresos, anterior.ingresos - anterior.egresos)
    }
  }

  flujoAnual(año: number): any[] {
    return this.db.prepare(`
      SELECT
        strftime('%m', fecha_emision) as mes,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as ingresos,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as egresos
      FROM ${this.tabla}
      WHERE strftime('%Y', fecha_emision) = '${año}'
      GROUP BY mes
      ORDER BY mes ASC
    `).all() as any[]
  }

  topProveedores(año: number, mes: number): any[] {
    const mesStr = String(mes).padStart(2, '0')
    return this.db.prepare(`
      SELECT
        rfc_emisor as rfc,
        nombre_emisor as nombre,
        COUNT(*) as facturas,
        SUM(total) as total
      FROM ${this.tabla}
      WHERE tipo_descarga = 'recibida'
        AND tipo_comprobante = 'I'
        AND estado = 'vigente'
        AND strftime('%Y', fecha_emision) = '${año}'
        AND strftime('%m', fecha_emision) = '${mesStr}'
      GROUP BY rfc_emisor
      ORDER BY total DESC
      LIMIT 5
    `).all() as any[]
  }

  topClientes(año: number, mes: number): any[] {
    const mesStr = String(mes).padStart(2, '0')
    return this.db.prepare(`
      SELECT
        rfc_receptor as rfc,
        nombre_receptor as nombre,
        COUNT(*) as facturas,
        SUM(total) as total
      FROM ${this.tabla}
      WHERE tipo_descarga = 'emitida'
        AND tipo_comprobante = 'I'
        AND estado = 'vigente'
        AND strftime('%Y', fecha_emision) = '${año}'
        AND strftime('%m', fecha_emision) = '${mesStr}'
      GROUP BY rfc_receptor
      ORDER BY total DESC
      LIMIT 5
    `).all() as any[]
  }

  obtenerConteos(rfcActivo: string): any {
    return this.db.prepare(`
    SELECT
      SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' THEN 1 ELSE 0 END) as recibidas,
      SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' THEN 1 ELSE 0 END) as emitidas,
      SUM(CASE WHEN tipo_comprobante = 'N' THEN 1 ELSE 0 END) as nomina,
      SUM(CASE WHEN tipo_comprobante = 'P' THEN 1 ELSE 0 END) as pagos,
      COUNT(DISTINCT CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' THEN rfc_receptor END) as clientes,
      COUNT(DISTINCT CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' THEN rfc_emisor END) as proveedores,
      SUM(CASE WHEN tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}' THEN 1 ELSE 0 END) as empleados,
      SUM(CASE WHEN tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}' THEN 1 ELSE 0 END) as patrones
    FROM ${this.tabla}
  `).get()
  }
}