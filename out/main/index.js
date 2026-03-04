"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const BetterSqlite3 = require("better-sqlite3");
const playwright = require("playwright");
const fs = require("fs");
const axios = require("axios");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const icon = path.join(__dirname, "../../resources/icon.png");
class Database {
  static instance = null;
  static getInstance() {
    if (!Database.instance) {
      const dbPath = path.join(electron.app.getPath("userData"), "facturas.db");
      Database.instance = new BetterSqlite3(dbPath);
      Database.instance.pragma("journal_mode = WAL");
      Database.instance.pragma("foreign_keys = ON");
    }
    return Database.instance;
  }
  static close() {
    if (Database.instance) {
      Database.instance.close();
      Database.instance = null;
    }
  }
}
function runMigration001(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS facturas (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid                  TEXT    UNIQUE NOT NULL,
      fecha_emision         TEXT,
      rfc_emisor            TEXT,
      nombre_emisor         TEXT,
      rfc_receptor          TEXT,
      nombre_receptor       TEXT,
      subtotal              REAL,
      total                 REAL,
      tipo_comprobante      TEXT CHECK(tipo_comprobante IN ('I','E','T','N','P')),
      estado                TEXT CHECK(estado IN ('vigente','cancelado')),
      xml                   TEXT,
      fecha_descarga        TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_facturas_rfc_emisor   ON facturas(rfc_emisor);
    CREATE INDEX IF NOT EXISTS idx_facturas_rfc_receptor ON facturas(rfc_receptor);
    CREATE INDEX IF NOT EXISTS idx_facturas_fecha        ON facturas(fecha_emision);
  `);
}
function migration002(db) {
  db.exec(`
    ALTER TABLE facturas ADD COLUMN tipo_descarga TEXT CHECK(tipo_descarga IN ('recibida', 'emitida')) DEFAULT 'recibida'
  `);
}
function migration003(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS descargas_pendientes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid        TEXT UNIQUE NOT NULL,
      rfc_emisor  TEXT,
      nombre_emisor TEXT,
      rfc_receptor TEXT,
      nombre_receptor TEXT,
      fecha_emision TEXT,
      total       REAL,
      tipo_comprobante TEXT,
      estado      TEXT,
      url_descarga TEXT,
      tipo_descarga TEXT CHECK(tipo_descarga IN ('recibida', 'emitida')),
      error       TEXT,
      intentos    INTEGER DEFAULT 1,
      fecha_fallo TEXT DEFAULT (datetime('now'))
    )
  `);
}
class MigrationRunner {
  constructor(db) {
    this.db = db;
  }
  run() {
    this.createMigrationsTable();
    this.executePending();
  }
  createMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre    TEXT UNIQUE NOT NULL,
        ejecutada TEXT DEFAULT (datetime('now'))
      )
    `);
  }
  executePending() {
    const migrations = [
      { nombre: "001_initial", fn: runMigration001 },
      { nombre: "002_tipo_descarga", fn: migration002 },
      { nombre: "003_descargas_pendientes", fn: migration003 }
    ];
    for (const migration of migrations) {
      const yaEjecutada = this.db.prepare(
        "SELECT id FROM migrations WHERE nombre = ?"
      ).get(migration.nombre);
      if (!yaEjecutada) {
        migration.fn(this.db);
        this.db.prepare(
          "INSERT INTO migrations (nombre) VALUES (?)"
        ).run(migration.nombre);
        console.log(`Migración ejecutada: ${migration.nombre}`);
      }
    }
  }
}
const regimenFiscal = {
  "601": "General de Ley Personas Morales",
  "603": "Personas Morales con Fines no Lucrativos",
  "605": "Sueldos y Salarios e Ingresos Asimilados a Salarios",
  "606": "Arrendamiento",
  "607": "Régimen de Enajenación o Adquisición de Bienes",
  "608": "Demás ingresos",
  "610": "Residentes en el Extranjero sin Establecimiento Permanente en México",
  "611": "Ingresos por Dividendos (socios y accionistas)",
  "612": "Personas Físicas con Actividades Empresariales y Profesionales",
  "614": "Ingresos por intereses",
  "615": "Régimen de los ingresos por obtención de premios",
  "616": "Sin obligaciones fiscales",
  "620": "Sociedades Cooperativas de Producción que optan por diferir sus ingresos",
  "621": "Incorporación Fiscal",
  "622": "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras",
  "623": "Opcional para Grupos de Sociedades",
  "624": "Coordinados",
  "625": "Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas",
  "626": "Régimen Simplificado de Confianza"
};
const usoCFDI = {
  "G01": "Adquisición de mercancias",
  "G02": "Devoluciones, descuentos o bonificaciones",
  "G03": "Gastos en general",
  "I01": "Construcciones",
  "I02": "Mobilario y equipo de oficina por inversiones",
  "I03": "Equipo de transporte",
  "I04": "Equipo de computo y accesorios",
  "I05": "Dados, troqueles, moldes, matrices y herramental",
  "I06": "Comunicaciones telefónicas",
  "I07": "Comunicaciones satelitales",
  "I08": "Otra maquinaria y equipo",
  "D01": "Honorarios médicos, dentales y gastos hospitalarios",
  "D02": "Gastos médicos por incapacidad o discapacidad",
  "D03": "Gastos funerales",
  "D04": "Donativos",
  "D05": "Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)",
  "D06": "Aportaciones voluntarias al SAR",
  "D07": "Primas por seguros de gastos médicos",
  "D08": "Gastos de transportación escolar obligatoria",
  "D09": "Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones",
  "D10": "Pagos por servicios educativos (colegiaturas)",
  "P01": "Por definir",
  "S01": "Sin efectos fiscales",
  "CP01": "Pagos",
  "CN01": "Nómina"
};
const formaPago = {
  "01": "Efectivo",
  "02": "Cheque nominativo",
  "03": "Transferencia electrónica de fondos",
  "04": "Tarjeta de crédito",
  "05": "Monedero electrónico",
  "06": "Dinero electrónico",
  "08": "Vales de despensa",
  "12": "Dación en pago",
  "13": "Pago por subrogación",
  "14": "Pago por consignación",
  "15": "Condonación",
  "17": "Compensación",
  "23": "Novación",
  "24": "Confusión",
  "25": "Remisión de deuda",
  "26": "Prescripción o caducidad",
  "27": "A satisfacción del acreedor",
  "28": "Tarjeta de débito",
  "29": "Tarjeta de servicios",
  "30": "Aplicación de anticipos",
  "31": "Intermediario pagos",
  "99": "Por definir"
};
const metodoPago = {
  "PUE": "Pago en una sola exhibición",
  "PPD": "Pago en parcialidades o diferido"
};
const impuesto = {
  "001": "ISR",
  "002": "IVA",
  "003": "IEPS"
};
const tipoPercepcion = {
  "001": "Sueldos, Salarios Rayas y Jornales",
  "002": "Gratificación Anual (Aguinaldo)",
  "003": "Participación de los Trabajadores en las Utilidades PTU",
  "004": "Reembolso de Gastos Médicos Dentales y Hospitalarios",
  "005": "Fondo de Ahorro",
  "006": "Caja de ahorro",
  "009": "Contribuciones a Cargo del Trabajador Pagadas por el Patrón",
  "010": "Premios por Puntualidad",
  "011": "Prima de Seguro de vida",
  "012": "Seguro de Gastos Médicos Mayores",
  "013": "Cuotas Sindicales Pagadas por el Patrón",
  "014": "Subsidios por incapacidad",
  "015": "Becas para trabajadores y/o hijos",
  "019": "Horas extra",
  "020": "Prima dominical",
  "021": "Prima Vacacional",
  "022": "Prima por antigüedad",
  "023": "Pagos por separación",
  "024": "Seguro de retiro",
  "025": "Indemnizaciones",
  "026": "Reembolso por funeral",
  "027": "Cuotas de seguridad social pagadas por el patrón",
  "028": "Comisiones",
  "029": "Vales de despensa",
  "030": "Vales de restaurante",
  "031": "Vales de gasolina",
  "032": "Vales de ropa",
  "033": "Ayuda para renta",
  "034": "Ayuda para artículos escolares",
  "035": "Ayuda para anteojos",
  "036": "Ayuda para transporte",
  "037": "Ayuda para gastos de funeral",
  "038": "Otros ingresos por salarios",
  "039": "Jubilaciones, pensiones o haberes de retiro",
  "044": "Jubilaciones, pensiones o haberes de retiro en parcialidades",
  "045": "Ingresos en acciones o títulos valor que representan bienes",
  "046": "Ingresos asimilados a salarios",
  "047": "Alimentación diferentes a los establecidos en el Art 94 último párrafo LISR",
  "048": "Habitación",
  "049": "Premios por asistencia",
  "050": "Viáticos",
  "051": "Pagos por gratificaciones, primas, compensaciones, recompensas u otros a extrabajadores derivados de jubilación en parcialidades"
};
const tipoDeduccion = {
  "001": "Seguridad social",
  "002": "ISR",
  "003": "Aportaciones a retiro, cesantía en edad avanzada y vejez",
  "004": "Otros",
  "005": "Aportaciones a Fondo de vivienda",
  "006": "Descuento por incapacidad",
  "007": "Pensión alimenticia",
  "008": "Renta",
  "009": "Préstamos provenientes del Fondo Nacional de la Vivienda para los Trabajadores",
  "010": "Pago por crédito de vivienda",
  "011": "Pago de abonos INFONACOT",
  "012": "Anticipo de salarios",
  "013": "Pagos hechos con exceso al trabajador",
  "014": "Errores",
  "015": "Pérdidas",
  "016": "Averías",
  "017": "Adquisición de artículos producidos por la empresa o establecimiento",
  "018": "Cuotas para la constitución y fomento de sociedades cooperativas y de cajas de ahorro",
  "019": "Cuotas sindicales",
  "020": "Ausencias (Ausentismo)",
  "021": "Cuotas obrero patronales"
};
const cat = (catalogo, clave) => catalogo[clave] ? `${clave} - ${catalogo[clave]}` : clave;
class PdfService {
  async generarPdf(xmlContenido, parseada, uuid, plantilla, rutaDestino) {
    const html = this.construirHtml(parseada, uuid, plantilla);
    await this.htmlAPdf(html, rutaDestino);
  }
  construirHtml(parseada, uuid, plantilla) {
    const templatePath = path.join(electron.app.getAppPath(), "src", "main", "templates", `${plantilla}.html`);
    let html = fs__namespace.readFileSync(templatePath, "utf-8");
    const fmt = (n) => (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
    html = this.reemplazar(html, "UUID", uuid);
    html = this.reemplazar(html, "NOMBRE_EMISOR", parseada.nombreEmisor);
    html = this.reemplazar(html, "RFC_EMISOR", parseada.rfcEmisor);
    html = this.reemplazar(html, "REGIMEN_FISCAL", cat(regimenFiscal, parseada.regimenFiscal));
    html = this.reemplazar(html, "LUGAR_EXPEDICION", parseada.lugarExpedicion);
    html = this.reemplazar(html, "FECHA", parseada.fecha?.replace("T", " "));
    html = this.reemplazar(html, "NO_CERTIFICADO", parseada.noCertificado || "");
    html = this.reemplazar(html, "EXPORTACION", parseada.exportacion === "01" ? "No aplica" : parseada.exportacion || "");
    html = this.reemplazar(html, "RFC_RECEPTOR", parseada.rfcReceptor);
    html = this.reemplazar(html, "NOMBRE_RECEPTOR", parseada.nombreReceptor);
    html = this.reemplazar(html, "CP_RECEPTOR", parseada.cpReceptor || "");
    html = this.reemplazar(html, "REGIMEN_FISCAL_RECEPTOR", cat(regimenFiscal, parseada.regimenFiscalReceptor || ""));
    html = this.reemplazar(html, "USO_CFDI", cat(usoCFDI, parseada.usoCFDI));
    html = this.reemplazar(html, "MONEDA", parseada.moneda);
    const tipoLabel = { I: "Ingreso", E: "Egreso", T: "Traslado", N: "Nómina", P: "Pago" };
    html = this.reemplazar(html, "TIPO_COMPROBANTE_LABEL", tipoLabel[parseada.tipoDeComprobante] || parseada.tipoDeComprobante);
    const serieFolio = [parseada.serie, parseada.folio].filter(Boolean).join("-");
    html = this.bloque(html, "SERIE_FOLIO", !!serieFolio, serieFolio);
    html = this.bloque(html, "FORMA_PAGO", !!parseada.formaPago, cat(formaPago, parseada.formaPago || ""));
    html = this.bloque(html, "METODO_PAGO", !!parseada.metodoPago, cat(metodoPago, parseada.metodoPago || ""));
    const conceptosRows = parseada.conceptos.map((c) => {
      const impuestosHtml = c.impuestos && c.impuestos.length > 0 ? `<tr class="impuesto-concepto">
                    <td colspan="2"></td>
                    <td colspan="6" style="padding: 2px 6px; font-size: 9px; color: #666;">
          ${c.impuestos.map((imp) => `${imp.tipo === "traslado" ? "Traslado" : "Retención"} 
                    ${cat(impuesto, imp.impuesto)} 
                    ${(imp.tasa * 100).toFixed(0)}% = 
                    ${fmt(imp.importe)}`).join(" | ")}
                    </td> </tr>` : "";
      return `
            <tr>
            <td>${c.claveProdServ}</td>
            <td>${c.noIdentificacion || "-"}</td>
            <td>${c.descripcion}</td>
            <td class="text-right">${c.cantidad}</td>
            <td>${c.claveUnidad}</td>
            <td class="text-right">${fmt(c.valorUnitario)}</td>
            <td class="text-right">${fmt(c.importe)}</td>
            <td>${c.objetoImp === "02" ? "Sí objeto" : c.objetoImp === "01" ? "No objeto" : c.objetoImp || ""}</td>
            </tr>
            ${impuestosHtml}`;
    }).join("");
    html = this.reemplazar(html, "CONCEPTOS_ROWS", conceptosRows);
    const tieneImpuestos = parseada.impuestos.length > 0;
    const impuestosRows = parseada.impuestos.map((i) => `
      <tr>
        <td>${i.tipo === "traslado" ? "Traslado" : "Retención"}</td>
        <td>${cat(impuesto, i.impuesto)}</td>
        <td class="text-right">${i.tasa ? (i.tasa * 100).toFixed(0) + "%" : "-"}</td>
        <td class="text-right">${fmt(i.importe)}</td>
      </tr>`).join("");
    html = this.bloqueContenido(html, "TIENE_IMPUESTOS", tieneImpuestos);
    html = this.reemplazar(html, "IMPUESTOS_ROWS", impuestosRows);
    html = this.reemplazar(html, "SUBTOTAL", fmt(parseada.subtotal));
    html = this.reemplazar(html, "TOTAL", fmt(parseada.total));
    html = this.bloque(html, "DESCUENTO", !!parseada.descuento, fmt(parseada.descuento || 0));
    html = this.bloque(html, "IVA", !!parseada.totalImpuestosTrasladados, fmt(parseada.totalImpuestosTrasladados || 0));
    html = this.bloque(html, "RETENCION", !!parseada.totalImpuestosRetenidos, fmt(parseada.totalImpuestosRetenidos || 0));
    const esNomina = !!parseada.complementoNomina;
    html = this.bloqueContenido(html, "ES_NOMINA", esNomina);
    if (esNomina && parseada.complementoNomina) {
      const n = parseada.complementoNomina;
      html = this.reemplazar(html, "TIPO_NOMINA", n.tipoNomina === "O" ? "Ordinaria" : "Extraordinaria");
      html = this.reemplazar(html, "FECHA_PAGO_NOMINA", n.fechaPago);
      html = this.reemplazar(html, "PERIODO_NOMINA", `${n.fechaInicialPago} - ${n.fechaFinalPago}`);
      html = this.reemplazar(html, "DIAS_PAGADOS", String(n.numDiasPagados));
      html = this.reemplazar(html, "TOTAL_PERCEPCIONES", fmt(n.totalPercepciones));
      html = this.reemplazar(html, "TOTAL_DEDUCCIONES", fmt(n.totalDeducciones));
      const percRows = n.percepciones.map((p) => `
        <tr>
          <td>${p.clave}</td>
          <td>${cat(tipoPercepcion, p.clave)}</td>
          <td class="text-right">${fmt(p.importeGravado)}</td>
          <td class="text-right">${fmt(p.importeExento)}</td>
        </tr>`).join("");
      html = this.reemplazar(html, "PERCEPCIONES_ROWS", percRows);
      const dedRows = n.deducciones.map((d) => `
        <tr>
          <td>${d.clave}</td>
          <td>${cat(tipoDeduccion, d.clave)}</td>
          <td class="text-right">${fmt(d.importe)}</td>
        </tr>`).join("");
      html = this.reemplazar(html, "DEDUCCIONES_ROWS", dedRows);
    }
    const esPago = !!parseada.complementoPago;
    html = this.bloqueContenido(html, "ES_PAGO", esPago);
    if (esPago && parseada.complementoPago) {
      const pagosHtml = parseada.complementoPago.pagos.map((p) => `
        <div style="margin-bottom:8px;padding:8px;border:1px solid #ddd;">
          <div><strong>Fecha:</strong> ${p.fechaPago} &nbsp;
               <strong>Forma:</strong> ${cat(formaPago, p.formaDePago)} &nbsp;
               <strong>Monto:</strong> ${fmt(p.monto)}</div>
          <table style="margin-top:6px">
            <thead><tr><th>UUID Relacionado</th><th class="text-right">Saldo Anterior</th><th class="text-right">Importe Pagado</th></tr></thead>
            <tbody>${p.doctoRelacionados.map((d) => `
              <tr>
                <td style="font-size:8px">${d.uuid}</td>
                <td class="text-right">${fmt(d.impSaldoAnt)}</td>
                <td class="text-right">${fmt(d.impPagado)}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>`).join("");
      html = this.reemplazar(html, "PAGOS_ROWS", pagosHtml);
    }
    const t = parseada.timbre;
    html = this.reemplazar(html, "FECHA_TIMBRADO", t?.fechaTimbrado || "");
    html = this.reemplazar(html, "RFC_PAC", t?.rfcProvCertif || "");
    html = this.reemplazar(html, "NO_CERT_SAT", t?.noCertificadoSAT || "");
    html = this.reemplazar(html, "SELLO_CFD", t?.selloCFD || "");
    html = this.reemplazar(html, "SELLO_SAT", t?.selloSAT || "");
    const qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${parseada.rfcEmisor}&rr=${parseada.rfcReceptor}&tt=${parseada.total}&fe=${(t?.selloCFD || "").slice(-8)}`;
    const qrDataUrl = this.generarQrSvg(qrUrl);
    html = this.reemplazar(html, "QR_DATA_URL", qrDataUrl);
    return html;
  }
  async htmlAPdf(html, rutaDestino) {
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({
      path: rutaDestino,
      format: "Letter",
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      printBackground: true
    });
    await browser.close();
  }
  reemplazar(html, clave, valor) {
    return html.replace(new RegExp(`{{${clave}}}`, "g"), valor || "");
  }
  bloque(html, clave, mostrar, valor) {
    if (mostrar) {
      html = html.replace(new RegExp(`{{#${clave}}}`, "g"), "");
      html = html.replace(new RegExp(`{{/${clave}}}`, "g"), "");
      html = this.reemplazar(html, clave, valor);
    } else {
      html = html.replace(new RegExp(`{{#${clave}}}[\\s\\S]*?{{/${clave}}}`, "g"), "");
    }
    return html;
  }
  bloqueContenido(html, clave, mostrar) {
    if (mostrar) {
      html = html.replace(new RegExp(`{{#${clave}}}`, "g"), "");
      html = html.replace(new RegExp(`{{/${clave}}}`, "g"), "");
    } else {
      html = html.replace(new RegExp(`{{#${clave}}}[\\s\\S]*?{{/${clave}}}`, "g"), "");
    }
    return html;
  }
  // QR simple en SVG (sin dependencias externas)
  generarQrSvg(url) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(url)}`;
  }
}
class FacturaHandler {
  constructor(facturaService, configuracionService) {
    this.facturaService = facturaService;
    this.configuracionService = configuracionService;
  }
  registrar() {
    electron.ipcMain.handle("obtener-captcha", async () => {
      try {
        console.log("SCRAPER ID:", this.facturaService.scraper === null ? "null" : "existe");
        const imagenBase64 = await this.facturaService.obtenerCaptcha();
        console.log("SCRAPER DESPUÉS:", this.facturaService.scraper.context === null ? "null" : "tiene contexto");
        return { success: true, imagenBase64 };
      } catch (error) {
        console.error("ERROR CAPTCHA:", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("descargar-facturas", async (event, datos) => {
      try {
        const config = this.configuracionService.obtener();
        if (!config) return { success: false, error: "No hay configuración guardada" };
        const resultado = await this.facturaService.descargarFacturas(
          config,
          datos.params,
          datos.captcha,
          (progreso) => {
            event.sender.send("progreso-descarga", progreso);
          }
        );
        return { success: true, total: resultado.total, errores: resultado.errores };
      } catch (error) {
        const mensaje = String(error);
        if (mensaje.includes("SAT_SATURADO")) {
          return { success: false, error: "El SAT se encuentra saturado en este momento. Intenta de nuevo en 20 minutos." };
        }
        if (mensaje.includes("CAPTCHA_INVALIDO")) {
          return { success: false, error: "El captcha es incorrecto. Recarga el captcha e intenta de nuevo." };
        }
        return { success: false, error: mensaje };
      }
    });
    electron.ipcMain.handle("obtener-facturas", async () => {
      try {
        const facturas = this.facturaService.obtenerTodas();
        return { success: true, facturas };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("eliminar-factura", async (_, uuid) => {
      try {
        this.facturaService.eliminar(uuid);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("abrir-archivo", async (_, ruta) => {
      const { shell } = require("electron");
      const { platform } = require("os");
      if (platform() === "win32") {
        await shell.openExternal(`file:///${ruta.replace(/\\/g, "/")}`);
      } else {
        await shell.openExternal(`file://${ruta}`);
      }
    });
    electron.ipcMain.handle("leer-xml", async (_, ruta) => {
      try {
        const fs2 = require("fs");
        const contenido = fs2.readFileSync(ruta, "utf-8");
        return { success: true, contenido };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("generar-pdf", async (_, datos) => {
      try {
        const pdfService = new PdfService();
        await pdfService.generarPdf(
          datos.xmlContenido,
          datos.parseada,
          datos.uuid,
          datos.plantilla,
          datos.rutaDestino
        );
        return { success: true };
      } catch (error) {
        console.error("ERROR PDF:", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("obtener-pendientes", async () => {
      try {
        const pendientes = this.facturaService.obtenerPendientes();
        return { success: true, pendientes };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("contar-pendientes", async () => {
      try {
        const total = this.facturaService.contarPendientes();
        return { success: true, total };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("limpiar-pendientes", async () => {
      try {
        this.facturaService.limpiarPendientes();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("reintentar-pendientes", async (event, datos) => {
      try {
        const config = this.configuracionService.obtener();
        if (!config) return { success: false, error: "No hay configuración guardada" };
        const resultado = await this.facturaService.reintentarPendientes(
          config,
          datos.captcha,
          (progreso) => {
            event.sender.send("progreso-descarga", progreso);
          }
        );
        return { success: true, total: resultado.total, errores: resultado.errores };
      } catch (error) {
        const mensaje = String(error);
        if (mensaje.includes("SAT_SATURADO")) {
          return { success: false, error: "El SAT se encuentra saturado. Intenta en 20 minutos." };
        }
        if (mensaje.includes("CAPTCHA_INVALIDO")) {
          return { success: false, error: "El captcha es incorrecto. Intenta de nuevo." };
        }
        return { success: false, error: mensaje };
      }
    });
  }
}
class ConfiguracionService {
  configPath;
  constructor() {
    this.configPath = path.join(electron.app.getPath("userData"), "configuracion.json");
  }
  guardar(config) {
    if (config.metodoAuth === "efirma") {
      if (config.rutaCer) {
        config.rutaCer = this.copiarArchivoEfirma(config.rutaCer, "cer");
      }
      if (config.rutaKey) {
        config.rutaKey = this.copiarArchivoEfirma(config.rutaKey, "key");
      }
    }
    fs__namespace.writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }
  obtener() {
    try {
      if (!fs__namespace.existsSync(this.configPath)) return null;
      const data = fs__namespace.readFileSync(this.configPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  limpiar() {
    if (fs__namespace.existsSync(this.configPath)) {
      fs__namespace.unlinkSync(this.configPath);
    }
  }
  copiarArchivoEfirma(rutaOrigen, tipo) {
    const nombreArchivo = `efirma.${tipo}`;
    const rutaDestino = path.join(electron.app.getPath("userData"), nombreArchivo);
    fs__namespace.copyFileSync(rutaOrigen, rutaDestino);
    return rutaDestino;
  }
}
class ConfiguracionHandler {
  configuracionService;
  constructor() {
    this.configuracionService = new ConfiguracionService();
  }
  registrar() {
    this.handleGuardar();
    this.handleObtener();
    this.handleLimpiar();
    this.handleSeleccionarArchivo();
    this.handleSeleccionarCarpeta();
  }
  handleGuardar() {
    electron.ipcMain.handle("guardar-configuracion", async (_, config) => {
      try {
        this.configuracionService.guardar(config);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
  handleObtener() {
    electron.ipcMain.handle("obtener-configuracion", async () => {
      try {
        const config = this.configuracionService.obtener();
        return { success: true, config };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
  handleLimpiar() {
    electron.ipcMain.handle("limpiar-configuracion", async () => {
      try {
        this.configuracionService.limpiar();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
  handleSeleccionarArchivo() {
    electron.ipcMain.handle("seleccionar-archivo", async (_, filtros) => {
      const resultado = await electron.dialog.showOpenDialog({
        properties: ["openFile"],
        filters: filtros
      });
      if (resultado.canceled) return { success: false };
      return { success: true, ruta: resultado.filePaths[0] };
    });
  }
  handleSeleccionarCarpeta() {
    electron.ipcMain.handle("seleccionar-carpeta", async () => {
      const resultado = await electron.dialog.showOpenDialog({
        properties: ["openDirectory"]
      });
      if (resultado.canceled) return { success: false };
      return { success: true, ruta: resultado.filePaths[0] };
    });
  }
}
class FacturaRepository {
  constructor(db) {
    this.db = db;
  }
  insertar(factura) {
    const stmt = this.db.prepare(`
    INSERT OR IGNORE INTO facturas 
      (uuid, fecha_emision, rfc_emisor, nombre_emisor, rfc_receptor, 
       nombre_receptor, subtotal, total, tipo_comprobante, estado, xml, tipo_descarga)
    VALUES
      (@uuid, @fecha_emision, @rfc_emisor, @nombre_emisor, @rfc_receptor,
       @nombre_receptor, @subtotal, @total, @tipo_comprobante, @estado, @xml, @tipo_descarga)
  `);
    stmt.run(factura);
  }
  obtenerTodas() {
    return this.db.prepare(`
      SELECT * FROM facturas ORDER BY fecha_emision DESC
    `).all();
  }
  obtenerPorRfc(rfc) {
    return this.db.prepare(`
      SELECT * FROM facturas 
      WHERE rfc_emisor = ? OR rfc_receptor = ?
      ORDER BY fecha_emision DESC
    `).all(rfc, rfc);
  }
  obtenerPorUuid(uuid) {
    return this.db.prepare(`
      SELECT * FROM facturas WHERE uuid = ?
    `).get(uuid);
  }
  eliminar(uuid) {
    this.db.prepare(`DELETE FROM facturas WHERE uuid = ?`).run(uuid);
  }
}
class DescargaPendienteRepository {
  constructor(db) {
    this.db = db;
  }
  insertar(pendiente) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO descargas_pendientes
        (uuid, rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor,
         fecha_emision, total, tipo_comprobante, estado, url_descarga,
         tipo_descarga, error, intentos, fecha_fallo)
      VALUES
        (@uuid, @rfc_emisor, @nombre_emisor, @rfc_receptor, @nombre_receptor,
         @fecha_emision, @total, @tipo_comprobante, @estado, @url_descarga,
         @tipo_descarga, @error,
         COALESCE((SELECT intentos + 1 FROM descargas_pendientes WHERE uuid = @uuid), 1),
         datetime('now'))
    `);
    stmt.run(pendiente);
  }
  obtenerTodas() {
    return this.db.prepare("SELECT * FROM descargas_pendientes ORDER BY fecha_fallo DESC").all();
  }
  eliminar(uuid) {
    this.db.prepare("DELETE FROM descargas_pendientes WHERE uuid = ?").run(uuid);
  }
  limpiar() {
    this.db.prepare("DELETE FROM descargas_pendientes").run();
  }
  contar() {
    const row = this.db.prepare("SELECT COUNT(*) as total FROM descargas_pendientes").get();
    return row.total;
  }
}
class SatAuthService {
  constructor(context) {
    this.context = context;
  }
  paginaLogin = null;
  async obtenerCaptcha() {
    if (this.paginaLogin) {
      await this.paginaLogin.close();
      this.paginaLogin = null;
    }
    this.paginaLogin = await this.context.newPage();
    await this.paginaLogin.goto("https://portalcfdi.facturaelectronica.sat.gob.mx/");
    await this.paginaLogin.waitForSelector("#divCaptcha", { timeout: 15e3 });
    const imagenBase64 = await this.paginaLogin.$eval(
      "#divCaptcha img",
      (img) => img.src
    );
    return { imagenBase64 };
  }
  async loginConContrasena(rfc, password, captcha) {
    if (!this.paginaLogin) {
      throw new Error("Primero debes cargar el captcha");
    }
    const page = this.paginaLogin;
    this.paginaLogin = null;
    await page.fill("#rfc", rfc);
    await page.fill("#password", password);
    await page.fill("#userCaptcha", captcha.toUpperCase());
    await this.esperarLoginExitoso(page, () => page.click("#submit"));
    return page;
  }
  async loginConEfirma(rutaCer, rutaKey, contrasenaFiel) {
    const page = this.paginaLogin ?? await this.context.newPage();
    this.paginaLogin = null;
    if (!page.url().includes("portalcfdi")) {
      await page.goto("https://portalcfdi.facturaelectronica.sat.gob.mx/");
    }
    await page.waitForSelector("#buttonFiel", { timeout: 15e3 });
    await page.click("#buttonFiel");
    await page.waitForSelector("#fileCertificate", { timeout: 1e4 });
    await page.setInputFiles("#fileCertificate", rutaCer);
    await page.setInputFiles("#filePrivateKey", rutaKey);
    await page.fill("#privateKeyPassword", contrasenaFiel);
    await this.esperarLoginExitoso(page, () => page.click("#submit"));
    return page;
  }
  async esperarLoginExitoso(page, accion) {
    await Promise.all([
      page.waitForNavigation({ timeout: 3e4 }).catch(() => null),
      accion()
    ]);
    await page.waitForTimeout(2e3);
    const url = page.url();
    console.log("URL después de login:", url);
    const esPaginaError = await page.$("text=Ha ocurrido un error al procesar").catch(() => null);
    if (esPaginaError) {
      throw new Error("SAT_SATURADO");
    }
    const errorCaptcha = await page.$("#divCapError, .alert-danger, .mensaje-error").catch(() => null);
    if (errorCaptcha) {
      const textoError = await errorCaptcha.textContent().catch(() => "");
      throw new Error(`CAPTCHA_INVALIDO: ${textoError?.trim()}`);
    }
    const llegamosAlPortal = url.includes("portalcfdi.facturaelectronica.sat.gob.mx") && !url.includes("login") && !url.includes("Login");
    if (!llegamosAlPortal) {
      const mensajeError = await page.$eval(
        '.alert, .error, [class*="error"], [class*="Error"]',
        (el) => el.textContent?.trim()
      ).catch(() => null);
      throw new Error(mensajeError || "Login fallido: no se pudo acceder al portal");
    }
    console.log("Login exitoso");
  }
  async logout(page) {
    try {
      await page.click("#salir");
    } finally {
      await page.close();
    }
  }
}
class SatScraper {
  context = null;
  authService = null;
  async iniciar() {
    if (this.context) {
      console.log("Browser ya existe, reutilizando");
      return;
    }
    console.log("Creando nuevo browser");
    const browser = await playwright.chromium.launch({ headless: false });
    this.context = await browser.newContext();
    this.authService = new SatAuthService(this.context);
  }
  async obtenerCaptcha() {
    if (!this.authService) await this.iniciar();
    const resultado = await this.authService.obtenerCaptcha();
    return resultado.imagenBase64;
  }
  async descargarFacturas(config, params, captcha, onProgreso) {
    if (!this.authService) throw new Error("Debes cargar el captcha primero");
    let page;
    if (config.metodoAuth === "contrasena") {
      page = await this.authService.loginConContrasena(config.rfc, config.contrasena, captcha);
    } else {
      page = await this.authService.loginConEfirma(config.rutaCer, config.rutaKey, config.contrasenaFiel);
    }
    const carpeta = config.carpetaDescarga || electron.app.getPath("downloads");
    let todasLasFilas = [];
    if (params.buscarPor === "folio") {
      const filas = await this.buscarEnPagina(page, params);
      todasLasFilas = filas;
    } else if (params.tipo === "recibidas") {
      const meses = this.dividirEnMeses(params.fechaInicio, params.fechaFin);
      const [dI, mI, aI] = params.fechaInicio.split("/").map(Number);
      const [dF, mF, aF] = params.fechaFin.split("/").map(Number);
      const fechaMin = new Date(aI, mI - 1, dI, 0, 0, 0);
      const fechaMax = new Date(aF, mF - 1, dF, 23, 59, 59);
      for (let i = 0; i < meses.length; i++) {
        const mes = meses[i];
        onProgreso?.({ etapa: "buscando", mesActual: i + 1, totalMeses: meses.length });
        const paramsMes = { ...params, fechaInicio: mes.inicio, fechaFin: mes.fin };
        const filasMes = await this.buscarEnPagina(page, paramsMes);
        const filasFiltradas = filasMes.filter((f) => {
          const fechaFactura = new Date(f.fecha_emision.replace(" ", "T"));
          return fechaFactura >= fechaMin && fechaFactura <= fechaMax;
        });
        todasLasFilas.push(...filasFiltradas);
        console.log(`Mes ${i + 1}/${meses.length}: ${filasFiltradas.length} facturas`);
      }
    } else {
      const filas = await this.buscarEnPagina(page, params);
      todasLasFilas = filas;
    }
    console.log(`Total facturas a procesar: ${todasLasFilas.length}`);
    const { facturas, errores } = await this.descargarEnParalelo(page, todasLasFilas, carpeta, (progreso) => {
      onProgreso?.({ etapa: "descargando", ...progreso });
    });
    if (errores.length > 0) {
      console.warn(`Se terminaron con ${errores.length} errores de descarga.`);
    }
    onProgreso?.({ etapa: "completado", totalFacturas: facturas.length });
    return { facturas, errores };
  }
  dividirEnMeses(fechaInicio, fechaFin) {
    const [diaI, mesI, anioI] = fechaInicio.split("/").map(Number);
    const [diaF, mesF, anioF] = fechaFin.split("/").map(Number);
    const meses = [];
    let anio = anioI;
    let mes = mesI;
    while (anio < anioF || anio === anioF && mes <= mesF) {
      const ultimoDia = new Date(anio, mes, 0).getDate();
      const inicio = anio === anioI && mes === mesI ? fechaInicio : `01/${String(mes).padStart(2, "0")}/${anio}`;
      const fin = anio === anioF && mes === mesF ? fechaFin : `${ultimoDia}/${String(mes).padStart(2, "0")}/${anio}`;
      meses.push({ inicio, fin });
      mes++;
      if (mes > 12) {
        mes = 1;
        anio++;
      }
    }
    return meses;
  }
  async buscarEnPagina(page, params) {
    const urlConsulta = params.tipo === "recibidas" ? "https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaReceptor.aspx" : "https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaEmisor.aspx";
    await page.goto(urlConsulta);
    await page.waitForSelector("#ctl00_MainContent_BtnBusqueda", { timeout: 15e3 });
    if (params.buscarPor === "folio") {
      await page.click("#ctl00_MainContent_RdoFolioFiscal");
      await page.waitForTimeout(1e3);
      await page.fill("#ctl00_MainContent_TxtUUID", params.folioFiscal);
    } else {
      await page.click("#ctl00_MainContent_RdoFechas");
      await page.waitForTimeout(1500);
      const [diaI, mesI, anioI] = params.fechaInicio.split("/");
      if (params.tipo === "recibidas") {
        await page.selectOption("#DdlAnio", anioI);
        await page.waitForTimeout(500);
        await page.selectOption("#ctl00_MainContent_CldFecha_DdlMes", String(parseInt(mesI)));
        await page.waitForTimeout(300);
        await page.selectOption("#ctl00_MainContent_CldFecha_DdlDia", String(parseInt(diaI)));
      } else {
        const [diaF, mesF, anioF] = params.fechaFin.split("/");
        await page.fill("#ctl00_MainContent_CldFecha_FechaInicial", `${diaI}/${mesI}/${anioI}`);
        await page.waitForTimeout(300);
        await page.fill("#ctl00_MainContent_CldFecha_FechaFinal", `${diaF}/${mesF}/${anioF}`);
      }
    }
    if (params.rfcTercero) {
      await page.fill("#ctl00_MainContent_TxtRfcReceptor", params.rfcTercero);
    }
    if (params.estadoComprobante) {
      const valorEstado = params.estadoComprobante === "cancelado" ? "0" : "1";
      await page.selectOption("#ctl00_MainContent_DdlEstadoComprobante", valorEstado);
    }
    await page.click("#ctl00_MainContent_BtnBusqueda");
    await page.waitForTimeout(3e3);
    const sinResultados = await page.$("#ctl00_MainContent_PnlNoResultados");
    if (sinResultados && await sinResultados.isVisible()) return [];
    return await page.$$eval(
      "#ctl00_MainContent_tblResult tbody tr:not(:first-child)",
      (filas) => {
        return filas.map((fila) => {
          const celdas = fila.querySelectorAll("td");
          if (celdas.length < 17) return null;
          const checkbox = fila.querySelector("input.ListaFolios");
          const btnDescarga = fila.querySelector("#BtnDescarga");
          const getText = (idx) => celdas[idx]?.textContent?.trim() || "";
          const onclick = btnDescarga?.getAttribute("onclick") || "";
          const match = onclick.match(/RecuperaCfdi\.aspx\?Datos=[^']+/);
          const urlDescarga = match ? match[0] : "";
          const totalStr = getText(16).replace("$", "").replace(/,/g, "").trim();
          const tipoTexto = getText(17).toLowerCase();
          let tipo = "I";
          if (tipoTexto.includes("egreso")) tipo = "E";
          else if (tipoTexto.includes("traslado")) tipo = "T";
          else if (tipoTexto.includes("nómina") || tipoTexto.includes("nomina")) tipo = "N";
          else if (tipoTexto.includes("pago")) tipo = "P";
          return {
            uuid: checkbox?.value || getText(8),
            rfc_emisor: getText(9),
            nombre_emisor: getText(10),
            rfc_receptor: getText(11),
            nombre_receptor: getText(12),
            fecha_emision: getText(13),
            total: parseFloat(totalStr) || 0,
            tipo_comprobante: tipo,
            estado: getText(19).toLowerCase().includes("vigente") ? "vigente" : "cancelado",
            urlDescarga
          };
        }).filter(Boolean);
      }
    );
  }
  async descargarEnParalelo(page, filas, carpeta, onProgreso) {
    const facturas = [];
    const errores = [];
    let descargadas = 0;
    const context = page.context();
    const cookies = await context.cookies();
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const currentUrl = page.url();
    const LOTE_SIZE = 10;
    for (let i = 0; i < filas.length; i += LOTE_SIZE) {
      const lote = filas.slice(i, i + LOTE_SIZE);
      const resultadosLote = await Promise.all(
        lote.map(async (fila) => {
          if (!fila.urlDescarga) return null;
          try {
            const urlCompleta = `https://portalcfdi.facturaelectronica.sat.gob.mx/${fila.urlDescarga}`;
            const rutaFinal = path.join(carpeta, `${fila.uuid}.xml`);
            const response = await axios({
              method: "get",
              url: urlCompleta,
              headers: {
                "Cookie": cookieString,
                "User-Agent": userAgent,
                "Referer": currentUrl,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
              },
              timeout: 15e3,
              responseType: "text"
            });
            if (response.data.includes("<?xml")) {
              fs__namespace.writeFileSync(rutaFinal, response.data);
              return { ...fila, urlDescarga: rutaFinal };
            } else {
              errores.push({ uuid: fila.uuid, error: "El SAT no devolvió un XML válido", fila });
              return null;
            }
          } catch (err) {
            console.error(`Fallo en descarga de ${fila.uuid}:`, err.message);
            errores.push({ uuid: fila.uuid, error: err.message, fila });
            return null;
          }
        })
      );
      const exitosos = resultadosLote.filter((f) => f !== null);
      facturas.push(...exitosos);
      descargadas += lote.length;
      onProgreso?.({
        descargadas,
        totalFacturas: filas.length,
        uuid: lote[lote.length - 1]?.uuid || ""
      });
    }
    return { facturas, errores };
  }
  async cerrar() {
    if (this.context) {
      await this.context.browser()?.close();
      this.context = null;
      this.authService = null;
    }
  }
  async reintentarDescargas(config, captcha, pendientes, onProgreso) {
    let page;
    if (config.metodoAuth === "contrasena") {
      page = await this.authService.loginConContrasena(config.rfc, config.contrasena, captcha);
    } else {
      page = await this.authService.loginConEfirma(config.rutaCer, config.rutaKey, config.contrasenaFiel);
    }
    const carpeta = config.carpetaDescarga || electron.app.getPath("downloads");
    const facturas = [];
    const errores = [];
    let procesadas = 0;
    for (const pendiente of pendientes) {
      try {
        onProgreso?.({
          etapa: "descargando",
          descargadas: procesadas,
          totalFacturas: pendientes.length,
          uuid: pendiente.uuid
        });
        const urlConsulta = pendiente.tipo_descarga === "recibida" ? "https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaReceptor.aspx" : "https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaEmisor.aspx";
        await page.goto(urlConsulta);
        await page.waitForSelector("#ctl00_MainContent_BtnBusqueda", { timeout: 15e3 });
        await page.click("#ctl00_MainContent_RdoFolioFiscal");
        await page.waitForTimeout(1e3);
        await page.fill("#ctl00_MainContent_TxtUUID", pendiente.uuid);
        await page.click("#ctl00_MainContent_BtnBusqueda");
        await page.waitForTimeout(3e3);
        const sinResultados = await page.$("#ctl00_MainContent_PnlNoResultados");
        if (sinResultados && await sinResultados.isVisible()) {
          errores.push({ uuid: pendiente.uuid, error: "No encontrado en el portal", fila: pendiente });
          procesadas++;
          continue;
        }
        const filas = await page.$$eval(
          "#ctl00_MainContent_tblResult tbody tr:not(:first-child)",
          (filas2) => filas2.map((fila) => {
            const btnDescarga = fila.querySelector("#BtnDescarga");
            const onclick = btnDescarga?.getAttribute("onclick") || "";
            const match = onclick.match(/RecuperaCfdi\.aspx\?Datos=[^']+/);
            return match ? match[0] : "";
          }).filter(Boolean)
        );
        if (!filas.length) {
          errores.push({ uuid: pendiente.uuid, error: "No se encontró botón de descarga", fila: pendiente });
          procesadas++;
          continue;
        }
        const urlCompleta = `https://portalcfdi.facturaelectronica.sat.gob.mx/${filas[0]}`;
        const rutaFinal = path.join(carpeta, `${pendiente.uuid}.xml`);
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 2e4 }),
          page.evaluate((url) => {
            window.location.href = url;
          }, urlCompleta)
        ]);
        const rutaTemp = await download.path();
        if (rutaTemp) {
          fs__namespace.renameSync(rutaTemp, rutaFinal);
          facturas.push({
            uuid: pendiente.uuid,
            rfc_emisor: pendiente.rfc_emisor,
            nombre_emisor: pendiente.nombre_emisor,
            rfc_receptor: pendiente.rfc_receptor,
            nombre_receptor: pendiente.nombre_receptor,
            fecha_emision: pendiente.fecha_emision,
            total: pendiente.total,
            tipo_comprobante: pendiente.tipo_comprobante,
            estado: pendiente.estado,
            urlDescarga: rutaFinal,
            tipo_descarga: pendiente.tipo_descarga
          });
        } else {
          errores.push({ uuid: pendiente.uuid, error: "No se pudo guardar el archivo", fila: pendiente });
        }
      } catch (err) {
        console.error(`Error reintentando ${pendiente.uuid}:`, err.message);
        errores.push({ uuid: pendiente.uuid, error: err.message, fila: pendiente });
      }
      procesadas++;
    }
    onProgreso?.({ etapa: "completado", totalFacturas: facturas.length });
    return { facturas, errores };
  }
}
class FacturaService {
  constructor(repository, pendienteRepository) {
    this.repository = repository;
    this.pendienteRepository = pendienteRepository;
  }
  scraper = new SatScraper();
  async obtenerCaptcha() {
    await this.scraper.iniciar();
    return await this.scraper.obtenerCaptcha();
  }
  async descargarFacturas(config, params, captcha, onProgreso) {
    try {
      const { facturas, errores } = await this.scraper.descargarFacturas(config, params, captcha, onProgreso);
      let guardadas = 0;
      for (const f of facturas) {
        if (!f.urlDescarga) continue;
        const yaExiste = this.repository.obtenerPorUuid(f.uuid);
        if (!yaExiste) {
          this.repository.insertar({
            uuid: f.uuid,
            fecha_emision: f.fecha_emision,
            rfc_emisor: f.rfc_emisor,
            nombre_emisor: f.nombre_emisor,
            rfc_receptor: f.rfc_receptor,
            nombre_receptor: f.nombre_receptor,
            subtotal: f.total,
            total: f.total,
            tipo_comprobante: f.tipo_comprobante,
            estado: f.estado,
            xml: f.urlDescarga,
            tipo_descarga: params.tipo === "recibidas" ? "recibida" : "emitida",
            fecha_descarga: (/* @__PURE__ */ new Date()).toISOString()
          });
          this.pendienteRepository.eliminar(f.uuid);
          guardadas++;
        }
      }
      for (const e of errores) {
        this.pendienteRepository.insertar({
          uuid: e.uuid,
          rfc_emisor: e.fila.rfc_emisor,
          nombre_emisor: e.fila.nombre_emisor,
          rfc_receptor: e.fila.rfc_receptor,
          nombre_receptor: e.fila.nombre_receptor,
          fecha_emision: e.fila.fecha_emision,
          total: e.fila.total,
          tipo_comprobante: e.fila.tipo_comprobante,
          estado: e.fila.estado,
          url_descarga: e.fila.urlDescarga,
          tipo_descarga: params.tipo === "recibidas" ? "recibida" : "emitida",
          error: e.error
        });
      }
      return { total: guardadas, errores };
    } finally {
      await this.scraper.cerrar();
    }
  }
  obtenerTodas() {
    return this.repository.obtenerTodas();
  }
  eliminar(uuid) {
    return this.repository.eliminar(uuid);
  }
  obtenerPendientes() {
    return this.pendienteRepository.obtenerTodas();
  }
  contarPendientes() {
    return this.pendienteRepository.contar();
  }
  limpiarPendientes() {
    return this.pendienteRepository.limpiar();
  }
  async reintentarPendientes(config, captcha, onProgreso) {
    try {
      const pendientes = this.pendienteRepository.obtenerTodas();
      if (pendientes.length === 0) return { total: 0, errores: [] };
      await this.scraper.iniciar();
      const { facturas, errores } = await this.scraper.reintentarDescargas(
        config,
        captcha,
        pendientes,
        onProgreso
      );
      let guardadas = 0;
      for (const f of facturas) {
        if (!f.urlDescarga) continue;
        const yaExiste = this.repository.obtenerPorUuid(f.uuid);
        if (!yaExiste) {
          this.repository.insertar({
            uuid: f.uuid,
            fecha_emision: f.fecha_emision,
            rfc_emisor: f.rfc_emisor,
            nombre_emisor: f.nombre_emisor,
            rfc_receptor: f.rfc_receptor,
            nombre_receptor: f.nombre_receptor,
            subtotal: f.total,
            total: f.total,
            tipo_comprobante: f.tipo_comprobante,
            estado: f.estado,
            xml: f.urlDescarga,
            tipo_descarga: f.tipo_descarga,
            fecha_descarga: (/* @__PURE__ */ new Date()).toISOString()
          });
          this.pendienteRepository.eliminar(f.uuid);
          guardadas++;
        }
      }
      for (const e of errores) {
        const pendiente = pendientes.find((p) => p.uuid === e.uuid);
        if (pendiente) {
          this.pendienteRepository.insertar({ ...pendiente, error: e.error });
        }
      }
      return { total: guardadas, errores };
    } finally {
      await this.scraper.cerrar();
    }
  }
}
function initDatabase() {
  const db = Database.getInstance();
  const migrationRunner = new MigrationRunner(db);
  migrationRunner.run();
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window2) => {
    utils.optimizer.watchWindowShortcuts(window2);
  });
  initDatabase();
  const db = Database.getInstance();
  const facturaRepository = new FacturaRepository(db);
  const descargaPendienteRepository = new DescargaPendienteRepository(db);
  const configuracionService = new ConfiguracionService();
  const facturaService = new FacturaService(facturaRepository, descargaPendienteRepository);
  new FacturaHandler(facturaService, configuracionService).registrar();
  new ConfiguracionHandler().registrar();
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    Database.close();
    electron.app.quit();
  }
});
