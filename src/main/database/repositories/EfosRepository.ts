import BetterSqlite3 from 'better-sqlite3'
import { ProfileManager } from '../ProfileManager' // Asegúrate de que la ruta sea correcta

export interface EfoRegistro {
    rfc: string
    nombre: string
    situacion: string
}

export interface EfosMeta {
    ultima_sync: string | null
    total_registros: number
}

export interface EfosRiesgo {
    rfc: string
    nombre: string
    situacion: string
    total_facturas: number
    monto_total: number
}

export class EfosRepository {
    constructor(private readonly db: BetterSqlite3.Database) { }

    // Propiedad auxiliar para obtener el nombre de la tabla de facturas actual
    private get tablaFacturas(): string {
        return ProfileManager.getTablaFacturas()
    }

    upsertMany(registros: EfoRegistro[]): void {
        const insertar = this.db.prepare(`
            INSERT INTO efos (rfc, nombre, situacion)
            VALUES (@rfc, @nombre, @situacion)
            ON CONFLICT(rfc) DO UPDATE SET
                nombre    = excluded.nombre,
                situacion = excluded.situacion
        `)

        const transaccion = this.db.transaction((items: EfoRegistro[]) => {
            this.db.exec('DELETE FROM efos')
            for (const item of items) insertar.run(item)
        })

        transaccion(registros)
    }

    actualizarMeta(total: number): void {
        this.db.prepare(`
            UPDATE efos_meta
            SET ultima_sync = datetime('now', 'localtime'),
                total_registros = ?
            WHERE id = 1
        `).run(total)
    }

    obtenerMeta(): EfosMeta {
        return this.db.prepare(`
            SELECT ultima_sync, total_registros FROM efos_meta WHERE id = 1
        `).get() as EfosMeta
    }

    cruzarConCfdis(): EfosRiesgo[] {
        try {
            // Usamos la tabla dinámica del perfil actual
            const query = `
                SELECT
                    e.rfc,
                    e.nombre,
                    e.situacion,
                    COUNT(f.uuid)                           AS total_facturas,
                    COALESCE(SUM(CAST(f.total AS REAL)), 0) AS monto_total
                FROM efos e
                INNER JOIN ${this.tablaFacturas} f ON UPPER(f.rfc_emisor) = UPPER(e.rfc)
                WHERE f.tipo_descarga = 'recibida'
                  AND f.estado = 'vigente'
                  AND e.situacion IN ('Definitivo', 'Presunto')
                GROUP BY e.rfc, e.nombre, e.situacion
                ORDER BY
                    CASE e.situacion WHEN 'Definitivo' THEN 1 ELSE 2 END,
                    monto_total DESC
            `
            return this.db.prepare(query).all() as EfosRiesgo[]
        } catch (error: any) {
            // Si la tabla de facturas del perfil aún no existe, retornamos vacío
            if (error.message.includes('no such table')) {
                console.warn(`[EfosRepository] La tabla ${this.tablaFacturas} no existe aún.`)
                return []
            }
            throw error
        }
    }
}