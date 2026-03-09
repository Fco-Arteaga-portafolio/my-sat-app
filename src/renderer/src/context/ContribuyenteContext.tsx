import { createContext, useContext, useEffect, useState } from 'react'

interface Perfil {
  id?: number
  rfc: string
  nombre: string
  metodo_auth: 'contrasena' | 'efirma'
  contrasena?: string
  ruta_cer?: string
  ruta_key?: string
  contrasena_fiel?: string
  carpeta_descarga?: string
}

interface ContribuyenteContextType {
  perfil: Perfil | null
  setPerfil: (perfil: Perfil | null) => void
}

const ContribuyenteContext = createContext<ContribuyenteContextType>({
  perfil: null,
  setPerfil: () => {}
})

export const useContribuyente = () => useContext(ContribuyenteContext)

export const ContribuyenteProvider = ({ children }: { children: React.ReactNode }) => {
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  useEffect(() => {
    window.api.obtenerPerfilActivo().then((res) => {
      if (res.success && res.perfil) {
        setPerfil(res.perfil)
      }
    })
  }, [])

  return (
    <ContribuyenteContext.Provider value={{ perfil, setPerfil }}>
      {children}
    </ContribuyenteContext.Provider>
  )
}