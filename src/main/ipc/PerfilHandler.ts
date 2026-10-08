import { ProfileManager } from '../database/ProfileManager'
import { IpcWrapper } from './IpcWrapper'
import { SesionService } from '../services/SesionService'
import { BackendService } from '../services/BackendService'

/**
 * Contribuyentes (perfiles locales) del escritorio.
 *
 * Alta de RFC (contrato en CONTRATO_RFC.md):
 * - El alta de contribuyente solo está habilitado si la cuenta compró el
 *   producto RFC (regla estricta: un RFC del resumen con `precioPagado > 0`).
 * - Al guardar, el Desktop registra el RFC en la cuenta (POST /rfcs) y solo si
 *   el backend lo acepta crea el perfil local. Si el endpoint no existe o
 *   rechaza, se muestra el error y NO se crea el perfil.
 */
export class PerfilHandler {
  constructor(
    private readonly profileManager: ProfileManager,
    private readonly sesionService: SesionService,
    private readonly backendService: BackendService
  ) {}

  registrar(): void {
    IpcWrapper.handle('obtener-perfiles', async () => {
      const perfiles = this.profileManager.obtenerTodos()
      return { perfiles }
    })

    /**
     * Estado del gate "Agregar contribuyente": regla estricta (¿compró el
     * producto RFC?). Devuelve también los RFCs de la cuenta (sync: los RFCs
     * agregados desde Emite se reflejan aquí).
     */
    IpcWrapper.handle('obtener-estado-agregar-rfc', async () => {
      const estado = this.sesionService.puedeAgregarRfc()
      return {
        puedeAgregar: estado.valido,
        motivo: estado.valido ? undefined : estado.motivo,
        rfcs: estado.rfcs
      }
    })

    /**
     * Alta de contribuyente: primero registra el RFC en la cuenta (POST /rfcs,
     * el backend valida el cupo del producto RFC) y solo si lo acepta crea el
     * perfil local. Sin el endpoint no se crea el perfil (regla acordada).
     */
    IpcWrapper.handle('crear-perfil', async (_event, perfil) => {
      const sesion = this.sesionService.obtenerSesion()
      if (!sesion) {
        throw new Error('No hay sesión activa. Vuelve a iniciar sesión en la aplicación.')
      }

      const rfc = String(perfil?.rfc ?? '')
        .trim()
        .toUpperCase()
      if (!rfc) throw new Error('El RFC es requerido.')
      const alias = String(perfil?.nombre ?? '').trim()

      // Regla estricta del producto RFC: sin compra, no se intenta el alta.
      const estado = this.sesionService.puedeAgregarRfc()
      if (!estado.valido) {
        throw new Error(estado.motivo || 'Compra el producto RFC para agregar contribuyentes.')
      }

      // Registro en la cuenta primero; el backend es la fuente del cupo.
      let registrado: Awaited<ReturnType<BackendService['registrarRfc']>>
      try {
        registrado = await this.backendService.registrarRfc(sesion.token, { rfc, alias })
      } catch (error) {
        const mensaje = String(error)
        if (/404|status code 404/i.test(mensaje)) {
          throw new Error(
            'El alta de RFC aún no está disponible en el servidor (POST /rfcs responde 404). No se creó el contribuyente. Detalle en CONTRATO_RFC.md.'
          )
        }
        throw error
      }

      // Solo con el alta aceptada se crea el perfil local (con credenciales SAT).
      this.profileManager.insertar(perfil)

      // Refresca el resumen para que el RFC nuevo aparezca en la cuenta (sync).
      this.sesionService.sincronizarResumen().catch(() => undefined)

      return { id: registrado.id, rfc: registrado.rfc, yaExistia: registrado.yaExistia }
    })

    IpcWrapper.handle('eliminar-perfil', async (_event, rfc: string) => {
      this.profileManager.eliminar(rfc)
      return {}
    })

    IpcWrapper.handle('seleccionar-perfil', async (_event, rfc: string) => {
      const perfil = this.profileManager.obtenerPorRfc(rfc)
      if (!perfil) throw new Error('Perfil no encontrado')
      ProfileManager.setPerfilActivo(perfil)
      this.profileManager.crearTablasPerfil(rfc) // asegura que existan las tablas del perfil
      return { perfil }
    })

    IpcWrapper.handle('obtener-perfil-activo', async () => {
      const perfil = ProfileManager.getPerfilActivo()
      return { perfil }
    })

    IpcWrapper.handle('cerrar-perfil', async () => {
      ProfileManager.limpiarPerfil()
      return {}
    })
  }
}
