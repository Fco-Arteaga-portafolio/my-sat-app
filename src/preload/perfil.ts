import { ipcRenderer } from 'electron'

export const createPerfilApi = () => {
    return {
        obtenerPerfiles: () => ipcRenderer.invoke('obtener-perfiles'),
        crearPerfil: (perfil: any) => ipcRenderer.invoke('crear-perfil', perfil),
        eliminarPerfil: (rfc: string) => ipcRenderer.invoke('eliminar-perfil', rfc),
        seleccionarPerfil: (rfc: string) => ipcRenderer.invoke('seleccionar-perfil', rfc),
        obtenerPerfilActivo: () => ipcRenderer.invoke('obtener-perfil-activo'),
        cerrarPerfil: () => ipcRenderer.invoke('cerrar-perfil'),
    }
}
