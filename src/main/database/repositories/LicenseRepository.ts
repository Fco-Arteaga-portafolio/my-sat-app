import BetterSqlite3 from 'better-sqlite3'

interface Licencia {
    id: number
    estado: 'Demo' | 'Vigente' | 'Vencido'
    fecha_inicio: string | null
    fecha_vencimiento: string | null
    rfc_maximo: number
    maquinas_maximo: number
    rfc_usado: number
    maquinas_usado: number
    descargas_cfdi_maximo: number
    descargas_cfdi_usado: number
    importaciones_cfdi_maximo: number
    importaciones_cfdi_usado: number
    consolidaciones_maximo: number
    consolidaciones_usado: number
    fecha_creacion: string
    fecha_actualizacion: string
}

export class LicenseRepository {
    constructor(private readonly db: BetterSqlite3.Database) { }

    /**
     * Obtiene la licencia actual (siempre es la ID 1)
     */
    obtenerLicencia(): Licencia | null {
        const stmt = this.db.prepare('SELECT * FROM licencias WHERE id = 1')
        return (stmt.get() as Licencia) || null
    }

    /**
     * Actualiza el estado de la licencia
     */
    actualizarEstado(estado: 'Demo' | 'Vigente' | 'Vencido'): void {
        const stmt = this.db.prepare(`
      UPDATE licencias 
      SET estado = ?, fecha_actualizacion = datetime('now')
      WHERE id = 1
    `)
        stmt.run(estado)
        this.registrarAuditoria('ACTUALIZAR_ESTADO', `Estado: ${estado}`)
    }

    /**
     * Actualiza los límites de la licencia
     */
    actualizarLimites(
        rfcMaximo: number,
        maquinasMaximo: number,
        fechaInicio?: string,
        fechaVencimiento?: string
    ): void {
        const stmt = this.db.prepare(`
      UPDATE licencias 
      SET 
        rfc_maximo = ?,
        maquinas_maximo = ?,
        fecha_inicio = COALESCE(?, fecha_inicio),
        fecha_vencimiento = COALESCE(?, fecha_vencimiento),
        fecha_actualizacion = datetime('now')
      WHERE id = 1
    `)
        stmt.run(rfcMaximo, maquinasMaximo, fechaInicio, fechaVencimiento)
        this.registrarAuditoria(
            'ACTUALIZAR_LIMITES',
            `RFC máximo: ${rfcMaximo}, Máquinas máximo: ${maquinasMaximo}`
        )
    }

    /**
     * Incrementa el contador de RFCs usados
     */
    incrementarRfcUsado(): void {
        const stmt = this.db.prepare(`
      UPDATE licencias 
      SET rfc_usado = rfc_usado + 1, fecha_actualizacion = datetime('now')
      WHERE id = 1
    `)
        stmt.run()
    }

    /**
     * Decrementa el contador de RFCs usados
     */
    decrementarRfcUsado(): void {
        const stmt = this.db.prepare(`
      UPDATE licencias 
      SET rfc_usado = MAX(0, rfc_usado - 1), fecha_actualizacion = datetime('now')
      WHERE id = 1
    `)
        stmt.run()
    }

    /**
     * Registra una nueva máquina
     */
    registrarMaquina(identificador: string, nombre: string, so: string): void {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO maquinas_registradas (identificador_maquina, nombre_maquina, so)
        VALUES (?, ?, ?)
      `)
            stmt.run(identificador, nombre, so)

            // Incrementar contador de máquinas usadas
            const updateStmt = this.db.prepare(`
        UPDATE licencias 
        SET maquinas_usado = maquinas_usado + 1, fecha_actualizacion = datetime('now')
        WHERE id = 1
      `)
            updateStmt.run()

            this.registrarAuditoria('REGISTRAR_MAQUINA', `${nombre} (${so})`)
        } catch (error) {
            if ((error as any).message.includes('UNIQUE constraint failed')) {
                // Máquina ya registrada, solo actualizar acceso
                this.actualizarUltimoAcceso(identificador)
            }
        }
    }

    /**
     * Obtiene todas las máquinas registradas
     */
    obtenerMaquinas(): any[] {
        const stmt = this.db.prepare(`
      SELECT * FROM maquinas_registradas WHERE activa = 1
      ORDER BY fecha_registro DESC
    `)
        return stmt.all()
    }

    /**
     * Actualiza el último acceso de una máquina
     */
    private actualizarUltimoAcceso(identificador: string): void {
        const stmt = this.db.prepare(`
      UPDATE maquinas_registradas 
      SET fecha_ultimo_acceso = datetime('now')
      WHERE identificador_maquina = ?
    `)
        stmt.run(identificador)
    }

    /**
     * Desactiva una máquina
     */
    desactivarMaquina(identificador: string): void {
        const stmt = this.db.prepare(`
      UPDATE maquinas_registradas 
      SET activa = 0
      WHERE identificador_maquina = ?
    `)
        stmt.run(identificador)

        // Decrementar contador
        const updateStmt = this.db.prepare(`
      UPDATE licencias 
      SET maquinas_usado = MAX(0, maquinas_usado - 1), fecha_actualizacion = datetime('now')
      WHERE id = 1
    `)
        updateStmt.run()

        this.registrarAuditoria('DESACTIVAR_MAQUINA', `Identificador: ${identificador}`)
    }

    /**
   * Valida si puede agregar un nuevo RFC
   */
    validarRfcDisponible(): boolean {
        const licencia = this.obtenerLicencia()
        if (!licencia) return false
        return licencia.rfc_usado < licencia.rfc_maximo
    }

    /**
     * Valida si puede registrar una nueva máquina
     */
    validarMaquinaDisponible(): boolean {
        const licencia = this.obtenerLicencia()
        if (!licencia) return false
        return licencia.maquinas_usado < licencia.maquinas_maximo
    }

    /**
     * Valida si hay descargas CFDI disponibles
     */
    validarDescargasCfdiDisponibles(): boolean {
        const licencia = this.obtenerLicencia()
        if (!licencia) return false
        if (licencia.estado === 'Vigente' || licencia.estado === 'Vencido') return licencia.estado === 'Vigente'
        // Demo
        return licencia.descargas_cfdi_usado < licencia.descargas_cfdi_maximo
    }

    /**
     * Incrementa contador de descargas CFDI
     */
    incrementarDescargasCfdi(): void {
        const stmt = this.db.prepare(`
      UPDATE licencias 
      SET descargas_cfdi_usado = descargas_cfdi_usado + 1, fecha_actualizacion = datetime('now')
      WHERE id = 1
    `)
        stmt.run()
        this.registrarAuditoria('DESCARGA_CFDI', 'Descarga realizada')
    }

    /**
     * Valida si hay importaciones CFDI disponibles
     */
    validarImportacionesCfdiDisponibles(): boolean {
        const licencia = this.obtenerLicencia()
        if (!licencia) return false
        if (licencia.estado === 'Vigente' || licencia.estado === 'Vencido') return licencia.estado === 'Vigente'
        // Demo
        return licencia.importaciones_cfdi_usado < licencia.importaciones_cfdi_maximo
    }

    /**
     * Incrementa contador de importaciones CFDI
     */
    incrementarImportacionesCfdi(): void {
        const stmt = this.db.prepare(`
      UPDATE licencias 
      SET importaciones_cfdi_usado = importaciones_cfdi_usado + 1, fecha_actualizacion = datetime('now')
      WHERE id = 1
    `)
        stmt.run()
        this.registrarAuditoria('IMPORTACION_CFDI', 'Importación realizada')
    }

    /**
     * Valida si hay consolidaciones (conciliaciones) disponibles
     */
    validarConsolidacionesDisponibles(): boolean {
        const licencia = this.obtenerLicencia()
        if (!licencia) return false
        if (licencia.estado === 'Vigente' || licencia.estado === 'Vencido') return licencia.estado === 'Vigente'
        // Demo
        return licencia.consolidaciones_usado < licencia.consolidaciones_maximo
    }

    /**
     * Incrementa contador de consolidaciones
     */
    incrementarConsolidaciones(): void {
        const stmt = this.db.prepare(`
      UPDATE licencias 
      SET consolidaciones_usado = consolidaciones_usado + 1, fecha_actualizacion = datetime('now')
      WHERE id = 1
    `)
        stmt.run()
        this.registrarAuditoria('CONSOLIDACION', 'Consolidación realizada')
    }

    /**
     * Obtiene información de usos disponibles
     */
    obtenerUsosDemoBloqueados() {
        const licencia = this.obtenerLicencia()
        if (!licencia || licencia.estado !== 'Demo') return null

        return {
            descargas_disponibles: Math.max(0, licencia.descargas_cfdi_maximo - licencia.descargas_cfdi_usado),
            importaciones_disponibles: Math.max(0, licencia.importaciones_cfdi_maximo - licencia.importaciones_cfdi_usado),
            consolidaciones_disponibles: Math.max(0, licencia.consolidaciones_maximo - licencia.consolidaciones_usado),
            descargas_bloqueadas: licencia.descargas_cfdi_usado >= licencia.descargas_cfdi_maximo,
            importaciones_bloqueadas: licencia.importaciones_cfdi_usado >= licencia.importaciones_cfdi_maximo,
            consolidaciones_bloqueadas: licencia.consolidaciones_usado >= licencia.consolidaciones_maximo
        }
    }

    /**
     * Valida si la licencia está vigente
     */
    validarVigencia(): boolean {
        const licencia = this.obtenerLicencia()
        if (!licencia) return false

        if (licencia.estado === 'Demo') return true
        if (licencia.estado === 'Vencido') return false

        if (licencia.fecha_vencimiento) {
            return new Date(licencia.fecha_vencimiento) > new Date()
        }

        return true
    }

    /**
     * Registra un evento en auditoría
     */
    private registrarAuditoria(evento: string, descripcion: string): void {
        const stmt = this.db.prepare(`
      INSERT INTO licencia_auditoria (evento, descripcion)
      VALUES (?, ?)
    `)
        stmt.run(evento, descripcion)
    }

    /**
     * Obtiene el historial de auditoría
     */
    obtenerAuditoria(limite: number = 50): any[] {
        const stmt = this.db.prepare(`
      SELECT * FROM licencia_auditoria
      ORDER BY fecha_evento DESC
      LIMIT ?
    `)
        return stmt.all(limite)
    }
}
