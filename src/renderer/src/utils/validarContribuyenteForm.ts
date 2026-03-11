// src/renderer/utils/validarContribuyenteForm.ts
import { ContribuyenteFormData } from '../components/ContribuyenteForm/ContribuyenteForm'

export const validarContribuyenteForm = (data: ContribuyenteFormData): string | null => {
  if (!data.rfc?.trim())              return 'El RFC es obligatorio'
  if (data.metodoAuth === 'contrasena' && !data.contrasena?.trim())
                                      return 'La contraseña es obligatoria'
  if (data.metodoAuth === 'efirma') {
    if (!data.rutaCer?.trim())        return 'El archivo .cer es obligatorio'
    if (!data.rutaKey?.trim())        return 'El archivo .key es obligatorio'
    if (!data.contrasenaFiel?.trim()) return 'La contraseña de la e.firma es obligatoria'
  }
  if (!data.carpetaEmitidos?.trim())  return 'La carpeta de emitidos es obligatoria'
  if (!data.carpetaRecibidos?.trim()) return 'La carpeta de recibidos es obligatoria'
  return null
}