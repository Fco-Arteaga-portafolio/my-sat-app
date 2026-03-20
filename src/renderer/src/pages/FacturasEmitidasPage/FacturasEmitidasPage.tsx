import FacturasListadoBase from '../../components/FacturasListadoBase/FacturasListadoBase'
import { columnasEmitidas } from '../../utils/columnasFacturas'

const FacturasEmitidasPage = () => (
  <FacturasListadoBase
    tipoDescarga="emitida"
    titulo="Facturas Emitidas"
    buildColumnas={columnasEmitidas}
    tiposComprobante={['I', 'E', 'T']}
    mostrarEfecto
  />
)

export default FacturasEmitidasPage
