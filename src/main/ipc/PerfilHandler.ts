import { ipcMain } from 'electron'
import { ProfileManager } from '../database/ProfileManager'

export class PerfilHandler {
  constructor(private readonly profileManager: ProfileManager) { }

  registrar(): void {
    ipcMain.handle('obtener-perfiles', async () => {
      try {
        const perfiles = this.profileManager.obtenerTodos()
        return { success: true, perfiles }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('crear-perfil', async (_, perfil) => {
      try {
        this.profileManager.insertar(perfil)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('eliminar-perfil', async (_, rfc: string) => {
      try {
        this.profileManager.eliminar(rfc)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('seleccionar-perfil', async (_, rfc: string) => {
      try {
        const perfil = this.profileManager.obtenerPorRfc(rfc)
        if (!perfil) return { success: false, error: 'Perfil no encontrado' }
        ProfileManager.setPerfilActivo(perfil)
        this.profileManager.crearTablasPerfil(rfc)  // ← asegura que existen las tablas
        return { success: true, perfil }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('obtener-perfil-activo', async () => {
      try {
        const perfil = ProfileManager.getPerfilActivo()
        return { success: true, perfil }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('cerrar-perfil', async () => {
      try {
        ProfileManager.limpiarPerfil()
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }
}