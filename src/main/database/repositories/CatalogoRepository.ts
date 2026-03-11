import BetterSqlite3 from 'better-sqlite3'
import { ProfileManager } from '../ProfileManager'

export type TipoCatalogo = 'clientes' | 'proveedores' | 'empleados' | 'patrones'

export interface ContactoCatalogo {
  id?: number
  rfc: string
  nombre?: string
  telefono?: string
  email?: string
  direccion?: string
  contacto?: string
  notas?: string
  limite_credito?: number
  dias_credito?: number
  puesto?: string
  fecha_ingreso?: string
}

export class CatalogoRepository {
  constructor(private readonly db: BetterSqlite3.Database) { }

  private tabla(tipo: TipoCatalogo): string {
    return `${tipo}_${ProfileManager.getRfcActivo()}`
  }

  private tablaFacturas(): string {
    return ProfileManager.getTablaFacturas()
  }

  obtenerTodos(tipo: TipoCatalogo): any[] {
    const tablaF = this.tablaFacturas()
    const rfcActivo = ProfileManager.getRfcActivo()

    const campoRfc = tipo === 'clientes' || tipo === 'empleados' ? 'rfc_receptor' : 'rfc_emisor'
    const filtroTipo = tipo === 'clientes' ? `tipo_descarga = 'emitida' AND tipo_comprobante = 'I'`
      : tipo === 'proveedores' ? `tipo_descarga = 'recibida' AND tipo_comprobante = 'I'`
        : tipo === 'empleados' ? `tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}'`
          : `tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}'`

    const camposExtra = (tipo === 'clientes' || tipo === 'proveedores')
      ? `c.limite_credito, c.dias_credito, c.contacto,`
      : tipo === 'empleados'
        ? `c.puesto, c.fecha_ingreso,`
        : `c.contacto,`

    return this.db.prepare(`
    SELECT
      c.id, c.rfc, c.nombre, c.telefono, c.email,
      c.direccion, c.notas, ${camposExtra}
      c.created_at, c.updated_at,
      COUNT(f.uuid) as total_facturas,
      COALESCE(SUM(f.total), 0) as total_facturado,
      MAX(f.fecha_emision) as ultimo_cfdi
    FROM ${this.tabla(tipo)} c
    LEFT JOIN ${tablaF} f ON f.${campoRfc} = c.rfc AND ${filtroTipo}
    GROUP BY c.id
    ORDER BY total_facturado DESC
  `).all()
  }
  
  obtenerPorRfc(tipo: TipoCatalogo, rfc: string): any {
    const tablaF = this.tablaFacturas()
    const rfcActivo = ProfileManager.getRfcActivo()
    const campoRfc = tipo === 'clientes' || tipo === 'empleados' ? 'rfc_receptor' : 'rfc_emisor'
    const filtroTipo = tipo === 'clientes' ? `tipo_descarga = 'emitida' AND tipo_comprobante = 'I'`
      : tipo === 'proveedores' ? `tipo_descarga = 'recibida' AND tipo_comprobante = 'I'`
        : tipo === 'empleados' ? `tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}'`
          : `tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}'`

    return this.db.prepare(`
      SELECT
        c.*,
        COUNT(f.uuid) as total_facturas,
        COALESCE(SUM(f.total), 0) as total_facturado,
        MAX(f.fecha_emision) as ultimo_cfdi
      FROM ${this.tabla(tipo)} c
      LEFT JOIN ${tablaF} f ON f.${campoRfc} = c.rfc AND ${filtroTipo}
      WHERE c.rfc = ?
      GROUP BY c.id
    `).get(rfc)
  }

  actualizar(tipo: TipoCatalogo, rfc: string, datos: Partial<ContactoCatalogo>): void {
    const campos = Object.keys(datos)
      .filter(k => k !== 'rfc' && k !== 'id')
      .map(k => `${k} = @${k}`)
      .join(', ')

    this.db.prepare(`
      UPDATE ${this.tabla(tipo)}
      SET ${campos}, updated_at = datetime('now')
      WHERE rfc = @rfc
    `).run({ ...datos, rfc })
  }

  sincronizar(tipo: TipoCatalogo): void {
    const tablaF = this.tablaFacturas()
    const rfcActivo = ProfileManager.getRfcActivo()

    const queries: Record<TipoCatalogo, string> = {
      clientes: `
        INSERT OR IGNORE INTO ${this.tabla('clientes')} (rfc, nombre)
        SELECT DISTINCT rfc_receptor, nombre_receptor
        FROM ${tablaF}
        WHERE tipo_descarga = 'emitida' AND tipo_comprobante = 'I'
          AND rfc_receptor IS NOT NULL AND rfc_receptor != ''
      `,
      proveedores: `
        INSERT OR IGNORE INTO ${this.tabla('proveedores')} (rfc, nombre)
        SELECT DISTINCT rfc_emisor, nombre_emisor
        FROM ${tablaF}
        WHERE tipo_descarga = 'recibida' AND tipo_comprobante = 'I'
          AND rfc_emisor IS NOT NULL AND rfc_emisor != ''
      `,
      empleados: `
        INSERT OR IGNORE INTO ${this.tabla('empleados')} (rfc, nombre)
        SELECT DISTINCT rfc_receptor, nombre_receptor
        FROM ${tablaF}
        WHERE tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}'
          AND rfc_receptor IS NOT NULL AND rfc_receptor != ''
      `,
      patrones: `
        INSERT OR IGNORE INTO ${this.tabla('patrones')} (rfc, nombre)
        SELECT DISTINCT rfc_emisor, nombre_emisor
        FROM ${tablaF}
        WHERE tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}'
          AND rfc_emisor IS NOT NULL AND rfc_emisor != ''
      `
    }

    this.db.prepare(queries[tipo]).run()
  }

  sincronizarTodos(): void {
    this.sincronizar('clientes')
    this.sincronizar('proveedores')
    this.sincronizar('empleados')
    this.sincronizar('patrones')
  }
}