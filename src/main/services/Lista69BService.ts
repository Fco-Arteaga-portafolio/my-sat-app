import https from 'https'
import { EfoRegistro, EfosRepository, EfosMeta, EfosRiesgo } from '../database/repositories/EfosRepository'

const URL_LISTADO_COMPLETO =
    'https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGAFF/Listado_completo_69-B.csv'

const SITUACION_MAP: Record<string, string> = {
    'definitivo': 'Definitivo',
    'presunto': 'Presunto',
    'desvirtuado': 'Desvirtuado',
    'sentencia favorable': 'SentenciaFavorable',
    'sentenciafavorable': 'SentenciaFavorable',
    'sentencias favorables': 'SentenciaFavorable',
}

export interface ResultadoSincronizacion {
    total: number
}

export interface ResultadoAnalisis {
    definitivos: EfosRiesgo[]
    presuntos: EfosRiesgo[]
    montoDefinitivo: number
    montoPresunto: number
    sinRiesgo: boolean
}

export class Lista69BService {
    constructor(private readonly efosRepository: EfosRepository) { }

    async sincronizar(onProgreso: (msg: string) => void): Promise<ResultadoSincronizacion> {
        onProgreso('Conectando con el SAT...')
        const csv = await this.descargarCsv(URL_LISTADO_COMPLETO)

        onProgreso('Procesando registros...')
        const registros = this.parsearCsv(csv)

        if (registros.length === 0) {
            throw new Error('No se pudieron procesar registros. Verifica tu conexión e intenta de nuevo.')
        }

        onProgreso(`Guardando ${registros.length.toLocaleString('es-MX')} registros...`)
        this.efosRepository.upsertMany(registros)
        this.efosRepository.actualizarMeta(registros.length)

        onProgreso(`Listo. ${registros.length.toLocaleString('es-MX')} contribuyentes cargados.`)
        return { total: registros.length }
    }

    analizarRiesgo(): ResultadoAnalisis {
        const resultados = this.efosRepository.cruzarConCfdis()
        const definitivos = resultados.filter(r => r.situacion === 'Definitivo')
        const presuntos = resultados.filter(r => r.situacion === 'Presunto')

        return {
            definitivos,
            presuntos,
            montoDefinitivo: definitivos.reduce((s, r) => s + r.monto_total, 0),
            montoPresunto: presuntos.reduce((s, r) => s + r.monto_total, 0),
            sinRiesgo: resultados.length === 0,
        }
    }

    obtenerMeta(): EfosMeta {
        return this.efosRepository.obtenerMeta()
    }

    private async descargarCsv(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error('Tiempo de espera agotado al descargar la lista del SAT')),
                60_000
            )

            https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                if (res.statusCode !== 200) {
                    clearTimeout(timeout)
                    reject(new Error(`Error HTTP ${res.statusCode} al descargar lista`))
                    return
                }

                const chunks: Buffer[] = []
                res.on('data', (chunk: Buffer) => chunks.push(chunk))
                res.on('end', () => {
                    clearTimeout(timeout)
                    const buffer = Buffer.concat(chunks)
                    // Remover BOM UTF-8 si existe
                    const contenido =
                        buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
                            ? buffer.subarray(3).toString('utf-8')
                            : buffer.toString('utf-8')
                    resolve(contenido)
                })
                res.on('error', (err: Error) => { clearTimeout(timeout); reject(err) })
            }).on('error', (err: Error) => { clearTimeout(timeout); reject(err) })
        })
    }

    private parsearCsv(contenido: string): EfoRegistro[] {
        // El SAT usa punto y coma en sus archivos de "Datos Abiertos"
        const separador = ';';
        const lineas = contenido.split(/\r?\n/).filter(l => l.trim().length > 10);

        const registros: EfoRegistro[] = [];
        // Regex más flexible para encontrar el RFC dentro de una celda
        const rfcRegex = /[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/i;

        for (const linea of lineas) {
            const cols = linea.split(separador).map(c => c.trim().replace(/^"|"$/g, ''));

            // En el listado completo del SAT:
            // Col 0: Número, Col 1: RFC, Col 2: Nombre, Col 3: Situación
            // Pero a veces el SAT cambia esto, así que buscamos el RFC dinámicamente:
            const indexRFC = cols.findIndex(c => rfcRegex.test(c));

            if (indexRFC !== -1) {
                const rfc = cols[indexRFC].toUpperCase();
                const nombre = cols[indexRFC + 1] || 'SIN NOMBRE';
                const situacionRaw = (cols[indexRFC + 2] || '').toLowerCase().trim();

                // Mapeamos la situación usando tu diccionario SITUACION_MAP
                const situacion = SITUACION_MAP[situacionRaw] || 'Desvirtuado';

                registros.push({ rfc, nombre, situacion });
            }
        }

        return registros;
    }
}