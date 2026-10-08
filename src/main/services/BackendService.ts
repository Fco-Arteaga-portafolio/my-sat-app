import axios, { AxiosError } from 'axios'

/**
 * Cliente HTTP del backend de IFRAT (Emite, ifrat.ar-sa.com.mx).
 *
 * CONTRATO (según el modelo del backend, Oct 2026):
 * - Envelope de respuestas: Result<T> -> { succeeded, data, message, statusCode }
 *   (camelCase). http() lo desenrolla: devuelve `data` cuando succeeded, y lanza
 *   Error(message) si no.
 * - Identificador de máquina: campo `macAddress`. El escritorio envía el hash
 *   estable de node-machine-id (el backend lo normaliza a mayúsculas y no
 *   valida formato MAC).
 * - El Desktop usa el MISMO login que la web (email/password). Al iniciar sesión
 *   se persisten token + refreshToken; luego se declara la máquina con
 *   POST /vinculacion/maquina (idempotente, `yaExistia` en la respuesta).
 * - Autenticación: `Authorization: Bearer <jwt>`. Un 401/403 en una llamada con
 *   credencial de sesión lanza TokenRechazadoError -> el Desktop vuelve al login.
 * - Límites de uso: la fuente autoritativa es POST /uso/validar y POST
 *   /uso/consumir (por módulo+RFC; `rfc` es obligatorio porque el backend no
 *   encuentra el contador sin él). GET /licencia/resumen se sigue leyendo para
 *   saber si la membresía es de pago (`usoIlimitado`) y para refrescar la vista.
 *   Si el servidor no responde, LimiteUsoService cae al contador local.
 *
 * En desarrollo se puede apuntar a otro servidor con la variable de entorno IFRAT_API_URL.
 */
const BASE_URL = process.env['IFRAT_API_URL'] || 'https://ifrat.ar-sa.com.mx/api'

/**
 * Ids internos de módulo del escritorio. Se usan para casar los contadores que
 * devuelve /licencia/resumen (los nombres del enum ModuloEmite, ver MODULO_BACKEND).
 */
export type ModuloUso =
  | 'descarga_cfdi'
  | 'importacion_cfdi'
  | 'consolidacion'
  | 'pendientes'
  | 'cumplimiento'
  | 'constancia'

/**
 * Traducción id interno -> nombre del módulo en el resumen del backend.
 *
 * PENDIENTE: el backend hoy solo tiene 5 módulos (ModuloEmite) y no existe
 * Constancia; el contador de constancia se lleva solo localmente.
 */
export const MODULO_BACKEND: Record<ModuloUso, string> = {
  descarga_cfdi: 'DescargarCfdi',
  importacion_cfdi: 'ImportarCfdi',
  consolidacion: 'Conciliacion',
  pendientes: 'Pendientes',
  cumplimiento: 'Cumplimiento',
  constancia: 'Constancia'
}

export class TokenRechazadoError extends Error {
  constructor() {
    super('El token de la sesión fue rechazado (expirado o revocado)')
    this.name = 'TokenRechazadoError'
  }
}

/** Sesión de cuenta en el escritorio (devuelta por login y refresh-token). */
export interface CredencialesSesion {
  token: string
  refreshToken: string
  nombre: string
  email: string
}

/** Respuesta de POST /vinculacion/maquina. */
export interface MaquinaVinculada {
  id: string
  macAddress: string
  alias: string
  fechaVinculacion: string
  activo: boolean
  yaExistia: boolean
  precioPagado: number
}

/** Un contador de módulo del resumen de licencia (por RFC). */
export interface ContadorModuloResumen {
  modulo: string
  rfc: string
  usos: number
  limite: number
  restantes: number
}

/**
 * Un RFC de la cuenta (ProductoRfc) tal como viene en GET /licencia/resumen.
 * `precioPagado` es 0 para el RFC que otorga la demo y >0 cuando se compró el
 * producto RFC aparte (en Emite). Contrato en CONTRATO_RFC.md.
 */
export interface RfcResumen {
  id: string
  rfc: string
  alias: string
  fechaAlta: string
  activo: boolean
  precioPagado: number
}

/** Cuerpo de POST /rfcs — registra el RFC en la cuenta desde el Desktop. */
export interface RfcRegistroRequest {
  rfc: string
  alias: string
}

/** Respuesta de POST /rfcs. `yaExistia` = el RFC ya estaba en la cuenta. */
export interface RfcRegistrado {
  id: string
  rfc: string
  alias: string
  activo: boolean
  precioPagado: number
  yaExistia: boolean
}

/** Lo que el escritorio consume de GET /licencia/resumen. */
export interface ResumenLicencia {
  usoIlimitado: boolean
  contadores: ContadorModuloResumen[]
  /** RFCs de la cuenta (demo gratuita + comprados). Fuente del gate "compró producto RFC". */
  rfcs: RfcResumen[]
}

/** Respuesta de POST /uso/validar (fuente autoritativa del límite). */
export interface ValidacionUsoBackend {
  permitido: boolean
  usoIlimitado: boolean
  usosRestantes: number
  usosMaximos: number
  usosConsumidos: number
  mensaje?: string | null
}

/** Respuesta de POST /uso/consumir. */
export interface ConsumoUsoBackend {
  exitoso: boolean
  usoIlimitado: boolean
  usosRestantes: number
  usosConsumidos: number
  mensaje?: string | null
}

/**
 * Datos para POST /soporte/tickets (contrato implementado en Emite — ver
 * CONTRATO_SOPORTE.md). `macAddress` y `contenidoLog` son obligatorios en el
 * backend; el UsuarioId sale del JWT.
 */
export interface TicketSoporteRequest {
  macAddress: string
  versionIfrat: string
  asunto: string
  descripcion: string
  contenidoLog: string
}

/** Respuesta de POST /soporte/tickets. */
export interface TicketSoporteRespuesta {
  id: string
  estado: string
  fechaEnvio: string
}

/**
 * Un ticket tal como lo devuelve GET /soporte/tickets (DTO del backend,
 * serializado en camelCase).
 */
export interface TicketSoporte {
  id: string
  macAddress: string
  versionIfrat: string
  asunto: string
  descripcion: string
  contenidoLog: string
  estado: 'Enviado' | 'Visto' | 'ConSeguimiento' | string
  fechaEnvio: string
  fechaVistoPorSoporte?: string | null
  respuestaSoporte?: string | null
  fechaRespuesta?: string | null
}

/** Sobre Result<T> que devuelve el backend (propiedades en camelCase). */
interface EnvelopeResultado<T> {
  succeeded?: boolean
  data?: T
  message?: string
  statusCode?: number
}

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'DELETE'
  jwt?: string
  data?: unknown
  /** Llamada con credencial de sesión: ante 401/403 lanza TokenRechazadoError. */
  sesion?: boolean
}

export class BackendService {
  private url(ruta: string): string {
    return `${BASE_URL}${ruta}`
  }

  private async http<T>({ url, method, jwt, data, sesion }: RequestOptions): Promise<T> {
    try {
      const respuesta = await axios({
        url,
        method: method ?? 'GET',
        data,
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
        timeout: 15000
      })

      // El backend envuelve todo en Result<T>. Si la respuesta no trae el
      // sobre (endpoint que aún devuelve el objeto crudo), se pasa tal cual.
      const body = respuesta.data as unknown
      if (body !== null && typeof body === 'object' && 'succeeded' in body) {
        const sobre = body as EnvelopeResultado<T>
        if (sobre.succeeded) return sobre.data as T
        throw new Error(sobre.message || 'El servidor respondió con un error')
      }

      return body as T
    } catch (error) {
      const axiosError = error as AxiosError
      const body = axiosError.response?.data
      let mensaje = axiosError.message || 'Error de conexión con el servidor de IFRAT'
      if (body !== null && typeof body === 'object') {
        const sobre = body as EnvelopeResultado<unknown>
        if (typeof sobre.message === 'string' && sobre.message.trim()) {
          mensaje = sobre.message
        } else if ('error' in body) {
          const detalle = (body as { error: unknown }).error
          if (typeof detalle === 'string' && detalle.trim()) mensaje = detalle
        }
      }

      const status = axiosError.response?.status
      if (sesion && (status === 401 || status === 403)) {
        throw new TokenRechazadoError()
      }
      throw new Error(mensaje)
    }
  }

  /** Inicia sesión con las mismas credenciales que el sitio web. */
  async login(email: string, password: string): Promise<CredencialesSesion> {
    return this.http<CredencialesSesion>({
      url: this.url('/auth/login'),
      method: 'POST',
      data: { email, password }
    })
  }

  /** Renueva el par token/refreshToken con el refresh token persistido. */
  async renovarSesion(refreshToken: string): Promise<CredencialesSesion> {
    return this.http<CredencialesSesion>({
      url: this.url('/auth/refresh-token'),
      method: 'POST',
      data: { refreshToken },
      sesion: true
    })
  }

  /** Cierra la sesión en el backend (mejor esfuerzo). */
  async cerrarSesion(jwt: string): Promise<void> {
    await this.http<{ success: boolean }>({
      url: this.url('/auth/logout'),
      method: 'POST',
      jwt,
      data: { token: jwt },
      sesion: true
    })
  }

  /**
   * Declara esta máquina en la cuenta. Idempotente: si la máquina ya estaba, el
   * backend devuelve `yaExistia: true` en vez de duplicarla.
   */
  async vincularMaquina(jwt: string, macAddress: string): Promise<MaquinaVinculada> {
    return this.http<MaquinaVinculada>({
      url: this.url('/vinculacion/maquina'),
      method: 'POST',
      jwt,
      data: { macAddress },
      sesion: true
    })
  }

  /** Da de baja una máquina de la cuenta. */
  async desvincularMaquina(jwt: string, macAddress: string): Promise<void> {
    await this.http<{ success: boolean }>({
      url: this.url(`/vinculacion/maquina/${encodeURIComponent(macAddress)}`),
      method: 'DELETE',
      jwt,
      sesion: true
    })
  }

  /**
   * Resumen de licencia: es la fuente de los límites. `usoIlimitado` libera los
   * módulos cuando la membresía es pagada.
   */
  async obtenerResumenLicencia(jwt: string): Promise<ResumenLicencia> {
    return this.http<ResumenLicencia>({
      url: this.url('/licencia/resumen'),
      jwt,
      sesion: true
    })
  }

  /**
   * Registra un RFC en la cuenta desde el Desktop (POST /rfcs). El backend
   * valida el cupo del producto RFC; si el RFC ya está activo devuelve
   * `yaExistia: true` (idempotente, sirve para configurar un RFC comprado en
   * Emite). Contrato en CONTRATO_RFC.md.
   */
  async registrarRfc(jwt: string, datos: RfcRegistroRequest): Promise<RfcRegistrado> {
    return this.http<RfcRegistrado>({
      url: this.url('/rfcs'),
      method: 'POST',
      jwt,
      data: datos,
      sesion: true
    })
  }

  /**
   * Valida si el módulo tiene uso disponible (POST /uso/validar). Es la fuente
   * autoritativa del límite cuando el servidor responde; `rfc` es obligatorio en
   * la práctica porque los contadores del backend son por usuario+RFC+módulo
   * (sin RFC el backend no encuentra el contador y lo reporta como ilimitado).
   */
  async validarUso(jwt: string, modulo: ModuloUso, rfc?: string): Promise<ValidacionUsoBackend> {
    return this.http<ValidacionUsoBackend>({
      url: this.url('/uso/validar'),
      method: 'POST',
      jwt,
      data: { modulo: MODULO_BACKEND[modulo], rfc: rfc?.trim() || undefined },
      sesion: true
    })
  }

  /**
   * Consume un uso del módulo (POST /uso/consumir). Con membresía pagada el
   * backend responde `usoIlimitado: true` sin descontar contador.
   */
  async consumirUso(
    jwt: string,
    modulo: ModuloUso,
    rfc?: string,
    cantidad = 1
  ): Promise<ConsumoUsoBackend> {
    return this.http<ConsumoUsoBackend>({
      url: this.url('/uso/consumir'),
      method: 'POST',
      jwt,
      data: { modulo: MODULO_BACKEND[modulo], rfc: rfc?.trim() || undefined, cantidad },
      sesion: true
    })
  }

  /** Datos para crear ticket de soporte técnico */
  async enviarTicketSoporte(
    jwt: string,
    datos: TicketSoporteRequest
  ): Promise<TicketSoporteRespuesta> {
    return this.http<TicketSoporteRespuesta>({
      url: this.url('/soporte/tickets'),
      method: 'POST',
      jwt,
      data: datos,
      sesion: true
    })
  }

  /**
   * Lista los tickets del usuario autenticado (seguimiento: estado, si IFRAT ya
   * lo vio y si hay respuesta). Contrato implementado en Emite — ver CONTRATO_SOPORTE.md.
   */
  async obtenerTicketsSoporte(jwt: string): Promise<TicketSoporte[]> {
    return this.http<TicketSoporte[]>({
      url: this.url('/soporte/tickets'),
      jwt,
      sesion: true
    })
  }
}
