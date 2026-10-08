import { machineIdSync } from 'node-machine-id'
import { createHash } from 'crypto'
import { hostname } from 'os'
import { safeStorage } from 'electron'
import { SesionRepository } from '../database/repositories/SesionRepository'
import { BackendService } from './BackendService'
import type { CredencialesSesion, ResumenLicencia, RfcResumen } from './BackendService'

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
   * Guarda en la BD las credenciales de la cuenta (email + contraseña cifrada)
   * y registra que el login fue exitoso. Con esto el Desktop puede re-loguear
   * en segundo plano si el refresh token expira o se revoca, sin volver a
   * pedirle credenciales al usuario.
   */
  guardarCredencialesLogin(usuario: string, contrasena: string): void {
    this.repository.marcarLoginExitoso(usuario, this.codificarCredencial(contrasena))
  }

  /**
   * Credenciales del último login exitoso, o null si la cuenta nunca logueó
   * correctamente desde este equipo o no se pudieron descifrar.
   */
  obtenerCredenciales(): { usuario: string; contrasena: string } | null {
    const fila = this.repository.obtener()
    if (!fila || !fila.login_exitoso || !fila.usuario || !fila.contrasena) return null
    try {
      return { usuario: fila.usuario, contrasena: this.decodificarCredencial(fila.contrasena) }
    } catch {
      return null
    }
  }

  /** Cifra la contraseña con el almacén seguro del SO (DPAPI en Windows); si no hay, ofusca en base64. */
  private codificarCredencial(valor: string): string {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return `v1:${safeStorage.encryptString(valor).toString('base64')}`
      }
    } catch {
      // Cae al ofuscado de respaldo.
    }
    return `b64:${Buffer.from(valor, 'utf8').toString('base64')}`
  }

  private decodificarCredencial(guardado: string): string {
    const indice = guardado.indexOf(':')
    const prefijo = indice === -1 ? '' : guardado.slice(0, indice)
    const payload = indice === -1 ? guardado : guardado.slice(indice + 1)
    if (prefijo === 'v1') {
      return safeStorage.decryptString(Buffer.from(payload, 'base64'))
    }
    return Buffer.from(payload, 'base64').toString('utf8')
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

  /**
   * Regla del producto RFC (estricta): el alta de contribuyente solo se habilita
   * si la cuenta compró el producto RFC — algún RFC activo con `precioPagado > 0`
   * en el resumen. El RFC gratuito que otorga la demo NO habilita. El backend de
   * Emite es la fuente autoritativa del cupo (ver CONTRATO_RFC.md).
   */
  puedeAgregarRfc(): { valido: boolean; motivo?: string; rfcs: RfcResumen[] } {
    const resumen = this.resumen
    const rfcs = resumen?.rfcs ?? []
    if (!resumen) {
      return {
        valido: false,
        motivo: 'No se pudo sincronizar tu licencia. Revisa tu conexión y reintenta.',
        rfcs: []
      }
    }
    const comproProductoRfc = rfcs.some((r) => r.activo && r.precioPagado > 0)
    if (!comproProductoRfc) {
      return {
        valido: false,
        motivo:
          'Compra el producto RFC en tu cuenta (web Emite) para poder agregar contribuyentes.',
        rfcs
      }
    }
    return { valido: true, rfcs }
  }
}
