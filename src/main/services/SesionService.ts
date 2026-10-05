import { machineIdSync } from 'node-machine-id'
import { createHash } from 'crypto'
import { hostname } from 'os'
import { SesionRepository } from '../database/repositories/SesionRepository'
import { BackendService } from './BackendService'
import type { CredencialesSesion, ResumenLicencia } from './BackendService'

/**
 * Sesión de cuenta en el escritorio (login directo, igual que la web).
 * Persiste token/refreshToken y guarda en memoria el resumen de licencia,
 * que alimenta los límites de uso (ver LimiteUsoService).
 */
export class SesionService {
  private resumen: ResumenLicencia | null = null

  constructor(
    private readonly repository: SesionRepository,
    private readonly backendService: BackendService
  ) {}

  /**
   * Identificador estable de hardware (hash sha-256 del GUID del sistema).
   * Fallback a hostname hasheado si la lectura del registro fallara.
   */
  obtenerHardwareId(): string {
    try {
      return machineIdSync()
    } catch {
      return createHash('sha256').update(hostname()).digest('hex')
    }
  }

  obtenerSesion(): CredencialesSesion | null {
    const fila = this.repository.obtener()
    if (!fila) return null
    return {
      token: fila.jwt,
      refreshToken: fila.refresh_token,
      nombre: fila.nombre,
      email: fila.email
    }
  }

  obtenerJwt(): string | null {
    return this.obtenerSesion()?.token ?? null
  }

  estaIniciada(): boolean {
    return !!this.obtenerJwt()
  }

  guardarSesion(sesion: CredencialesSesion): void {
    if (!sesion.token.trim()) throw new Error('Token vacío al guardar la sesión')
    this.repository.guardar({
      jwt: sesion.token.trim(),
      refreshToken: sesion.refreshToken.trim(),
      nombre: sesion.nombre.trim(),
      email: sesion.email.trim(),
      hardwareId: this.obtenerHardwareId()
    })
  }

  limpiar(): void {
    this.repository.limpiar()
    this.resumen = null
  }

  /**
   * Descarga (o refresca) el resumen de licencia. Si el backend no responde
   * devuelve null (se mantiene el resumen anterior).
   */
  async sincronizarResumen(): Promise<ResumenLicencia | null> {
    const jwt = this.obtenerJwt()
    if (!jwt) return null
    try {
      this.resumen = await this.backendService.obtenerResumenLicencia(jwt)
    } catch {
      this.resumen = null
    }
    return this.resumen
  }

  /** Resumen en memoria; null cuando la licencia aún no se sincronizó. */
  obtenerResumen(): ResumenLicencia | null {
    return this.resumen
  }
}
