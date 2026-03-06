import { useState } from 'react'

interface ResultadoImportacion {
  importadas: number
  omitidas: number
  errores: { archivo: string; error: string }[]
}

export const useImportacionPage = () => {
  const [rutasSeleccionadas, setRutasSeleccionadas] = useState<string[]>([])
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const seleccionarArchivos = async () => {
    const res = await window.api.seleccionarXmls()
    if (res.success && res.rutas.length > 0) {
      setRutasSeleccionadas(prev => {
        const nuevas = res.rutas.filter(r => !prev.includes(r))
        return [...prev, ...nuevas]
      })
    }
  }

  const seleccionarCarpeta = async () => {
    const res = await window.api.seleccionarCarpetaXml()
    if (res.success && res.rutas.length > 0) {
      setRutasSeleccionadas(prev => {
        const nuevas = res.rutas.filter(r => !prev.includes(r))
        return [...prev, ...nuevas]
      })
    }
  }

  const eliminarRuta = (ruta: string) => {
    setRutasSeleccionadas(prev => prev.filter(r => r !== ruta))
  }

  const limpiar = () => {
    setRutasSeleccionadas([])
    setResultado(null)
    setError(null)
  }

  const importar = async () => {
    if (rutasSeleccionadas.length === 0) {
      setError('Selecciona al menos un archivo XML')
      return
    }
    setImportando(true)
    setError(null)
    setResultado(null)

    const res = await window.api.importarXmls(rutasSeleccionadas)
    if (res.success) {
      setResultado({ importadas: res.importadas, omitidas: res.omitidas, errores: res.errores })
      setRutasSeleccionadas([])
    } else {
      setError('Error al importar los XMLs')
    }
    setImportando(false)
  }

  return {
    rutasSeleccionadas, importando, resultado, error,
    seleccionarArchivos, seleccionarCarpeta, eliminarRuta, limpiar, importar
  }
}