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

  ivaAnual(año: number): any[] {
    return this.db.prepare(`
      SELECT
        strftime('%m', fecha_emision) AS mes,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida'  AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_trasladados ELSE 0 END), 0) AS iva_cobrado,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_trasladados ELSE 0 END), 0) AS iva_acreditable,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida'  AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_retenidos  ELSE 0 END), 0) AS iva_retenido_cobrado,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_retenidos  ELSE 0 END), 0) AS iva_retenido_pagado
      FROM ${this.tabla}
      WHERE strftime('%Y', fecha_emision) = '${año}'
      GROUP BY mes
      ORDER BY mes ASC
    `).all() as any[]
  }

  isrAnual(año: number, rfcActivo: string): { mes: string; ingresos: number; gastos: number; isr_retenido: number }[] {
    return this.db.prepare(`
      SELECT
        strftime('%m', fecha_emision) AS mes,
        COALESCE(SUM(CASE
          WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente'
          THEN subtotal
          WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'N' AND estado = 'vigente'
            AND rfc_receptor = '${rfcActivo}'
          THEN subtotal
          ELSE 0
        END), 0) AS ingresos,
        COALESCE(SUM(CASE
          WHEN tipo_descarga = 'recibida' AND tipo_comprobante IN ('I','E') AND estado = 'vigente'
          THEN subtotal ELSE 0
        END), 0) AS gastos,
        COALESCE(SUM(CASE
          WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente'
            AND rfc_emisor = '${rfcActivo}'
          THEN total_impuestos_retenidos ELSE 0
        END), 0) AS isr_retenido
      FROM ${this.tabla}
      WHERE strftime('%Y', fecha_emision) = '${año}'
      GROUP BY mes
      ORDER BY mes ASC
    `).all() as any[]
  }

  detalleMes(año: number, mes: number): any[] {
    const mesStr = String(mes).padStart(2, '0')
    return this.db.prepare(`
      SELECT
        f.uuid,
        f.tipo_descarga,
        f.tipo_comprobante,
        f.rfc_emisor,
        f.nombre_emisor,
        f.rfc_receptor,
        f.nombre_receptor,
        f.metodo_pago,
        f.subtotal,
        f.descuento,
        f.total_impuestos_retenidos,
        f.total_impuestos_trasladados,
        f.total,
        f.estado,
        COALESCE(p.pagado, CASE WHEN f.metodo_pago = 'PUE' THEN 1 ELSE 0 END) AS pagado
      FROM ${this.tabla} f
      LEFT JOIN cfdi_estado_pago p ON p.uuid = f.uuid
      WHERE f.estado = 'vigente'
        AND f.tipo_comprobante IN ('I', 'E', 'N', 'P', 'T')
        AND strftime('%Y', f.fecha_emision) = '${año}'
        AND strftime('%m', f.fecha_emision) = '${mesStr}'
      ORDER BY f.fecha_emision ASC
    `).all() as any[]
  }

  togglePagado(uuid: string, pagado: boolean): void {
    this.db.prepare(`
      INSERT INTO cfdi_estado_pago (uuid, pagado, fecha_actualizacion)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(uuid) DO UPDATE SET
        pagado = excluded.pagado,
        fecha_actualizacion = excluded.fecha_actualizacion
    `).run(uuid, pagado ? 1 : 0)
  }

  obtenerRutaXmlMuestra(): string | null {
    const row = this.db.prepare(`
      SELECT xml FROM ${this.tabla}
      WHERE tipo_descarga = 'emitida'
        AND xml IS NOT NULL
        AND xml != ''
      LIMIT 1
    `).get() as { xml: string } | undefined
    return row?.xml ?? null
  }
}