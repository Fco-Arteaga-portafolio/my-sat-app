import FacturasListadoBase from '../../components/FacturasListadoBase/FacturasListadoBase'
import { columnasRecibidas } from '../../utils/columnasFacturas'

const FacturasRecibidasPage = () => (
  <FacturasListadoBase
    tipoDescarga="recibida"
    titulo="Facturas Recibidas"
    buildColumnas={columnasRecibidas}
    tiposComprobante={['I', 'E', 'T']}
    mostrarEfecto
  />
)

export default FacturasRecibidasPage
