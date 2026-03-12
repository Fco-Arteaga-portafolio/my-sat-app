"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const BetterSqlite3 = require("better-sqlite3");
const fs = require("fs");
const playwright = require("playwright");
const xmldom = require("@xmldom/xmldom");
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
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
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
function migration004(db) {
  const cols = [
    "serie TEXT",
    "folio TEXT",
    "fecha_timbrado TEXT",
    "forma_pago TEXT",
    "metodo_pago TEXT",
    "moneda TEXT",
    "tipo_cambio REAL",
    "descuento REAL DEFAULT 0",
    "total_impuestos_trasladados REAL DEFAULT 0",
    "total_impuestos_retenidos REAL DEFAULT 0",
    "estado_cancelacion TEXT",
    "estado_proceso_cancelacion TEXT",
    "fecha_cancelacion TEXT",
    "version TEXT",
    "rfc_pac TEXT",
    "folio_sustitucion TEXT"
  ];
  for (const col of cols) {
    const nombre = col.split(" ")[0];
    try {
      db.exec(`ALTER TABLE facturas ADD COLUMN ${col}`);
      console.log(`Columna ${nombre} agregada`);
    } catch {
      console.log(`Columna ${nombre} ya existe`);
    }
  }
}
function migration005(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS perfiles (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc               TEXT UNIQUE NOT NULL,
      nombre            TEXT NOT NULL,
      metodo_auth       TEXT CHECK(metodo_auth IN ('contrasena', 'efirma')) NOT NULL,
      contrasena        TEXT,
      ruta_cer          TEXT,
      ruta_key          TEXT,
      contrasena_fiel   TEXT,
      carpeta_descarga  TEXT,
      activo            INTEGER DEFAULT 0,
      fecha_creacion    TEXT DEFAULT (datetime('now'))
    )
  `);
}
const migration006 = (db) => {
  const perfiles = db.prepare("SELECT rfc FROM perfiles").all();
  for (const { rfc } of perfiles) {
    const r = rfc.replace(/[^A-Z0-9]/gi, "");
    db.prepare(`
      CREATE TABLE IF NOT EXISTS clientes_${r} (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        rfc             TEXT UNIQUE NOT NULL,
        nombre          TEXT,
        telefono        TEXT,
        email           TEXT,
        direccion       TEXT,
        contacto        TEXT,
        notas           TEXT,
        limite_credito  REAL,
        dias_credito    INTEGER,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS proveedores_${r} (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        rfc             TEXT UNIQUE NOT NULL,
        nombre          TEXT,
        telefono        TEXT,
        email           TEXT,
        direccion       TEXT,
        contacto        TEXT,
        notas           TEXT,
        limite_credito  REAL,
        dias_credito    INTEGER,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS empleados_${r} (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        rfc             TEXT UNIQUE NOT NULL,
        nombre          TEXT,
        telefono        TEXT,
        email           TEXT,
        direccion       TEXT,
        notas           TEXT,
        puesto          TEXT,
        fecha_ingreso   DATE,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS patrones_${r} (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        rfc             TEXT UNIQUE NOT NULL,
        nombre          TEXT,
        telefono        TEXT,
        email           TEXT,
        direccion       TEXT,
        contacto        TEXT,
        notas           TEXT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  }
};
function migration007(db) {
  db.exec(`
    ALTER TABLE perfiles ADD COLUMN plantilla_default     TEXT NOT NULL DEFAULT 'clasica';
    ALTER TABLE perfiles ADD COLUMN carpeta_emitidos      TEXT;
    ALTER TABLE perfiles ADD COLUMN carpeta_recibidos     TEXT;
    ALTER TABLE perfiles ADD COLUMN estructura_emitidos   TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE perfiles ADD COLUMN estructura_recibidos  TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE perfiles ADD COLUMN config_nombre_archivo TEXT NOT NULL DEFAULT '{}';
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
      { nombre: "003_descargas_pendientes", fn: migration003 },
      { nombre: "004_campos_cfdi", fn: migration004 },
      { nombre: "005_perfiles", fn: migration005 },
      { nombre: "006_catalogos", fn: migration006 },
      { nombre: "007_config_pdf", fn: migration007 }
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
class BrowserManager {
  static browser = null;
  static headless = process.env.NODE_ENV === "production";
  // ← un solo lugar para cambiar
  static setHeadless(value) {
    this.headless = value;
  }
  static async getBrowser() {
    if (!this.browser) {
      this.browser = await playwright.chromium.launch({ headless: this.headless });
    }
    return this.browser;
  }
  static async newContext() {
    const browser = await this.getBrowser();
    return browser.newContext();
  }
  static async cerrar() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
class PdfService {
  async generarPdf(_xmlContenido, parseada, uuid, plantilla, rutaDestino) {
    const html = await this.construirHtml(parseada, uuid, plantilla);
    await this.htmlAPdf(html, rutaDestino);
  }
  async construirHtml(parseada, uuid, plantilla) {
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
    const qrDataUrl = await this.generarQrDataUrl(qrUrl);
    html = this.reemplazar(html, "QR_DATA_URL", qrDataUrl);
    return html;
  }
  async htmlAPdf(html, rutaDestino) {
    const context = await BrowserManager.newContext();
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({
      path: rutaDestino,
      format: "Letter",
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      printBackground: true
    });
    await context.close();
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
  /* QR simple en SVG (sin dependencias externas)
  private generarQrSvg(url: string): string {
      // Usamos una URL de API pública para generar el QR como data URL
      return `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(url)}`
  }*/
  async generarQrDataUrl(url) {
    const QRCode = require("qrcode");
    return await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: "H",
      rendererOpts: {
        quality: 1
        // Asegura la máxima calidad en la generación
      }
    });
  }
}
class FacturaHandler {
  constructor(descargaService, configuracionService) {
    this.descargaService = descargaService;
    this.configuracionService = configuracionService;
  }
  registrar() {
    electron.ipcMain.handle("obtener-captcha", async () => {
      try {
        const imagenBase64 = await this.descargaService.obtenerCaptcha();
        return { success: true, imagenBase64 };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("descargar-facturas", async (event, datos) => {
      try {
        const config = this.configuracionService.obtener();
        if (!config) return { success: false, error: "No hay configuración guardada" };
        const resultado = await this.descargaService.descargar(
          config,
          datos.params,
          datos.captcha,
          (progreso) => event.sender.send("progreso-descarga", progreso)
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
        const facturas = this.descargaService.obtenerFacturas();
        return { success: true, facturas };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("eliminar-factura", async (_, uuid) => {
      try {
        this.descargaService.eliminarFactura(uuid);
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
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("obtener-pendientes", async () => {
      try {
        const pendientes = this.descargaService.obtenerPendientes();
        return { success: true, pendientes };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("contar-pendientes", async () => {
      try {
        const total = this.descargaService.contarPendientes();
        return { success: true, total };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("limpiar-pendientes", async () => {
      try {
        this.descargaService.limpiarPendientes();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("reintentar-pendientes", async (event, datos) => {
      try {
        const config = this.configuracionService.obtener();
        if (!config) return { success: false, error: "No hay configuración guardada" };
        const resultado = await this.descargaService.reintentarPendientes(
          config,
          datos.captcha,
          (progreso) => event.sender.send("progreso-descarga", progreso)
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
    electron.ipcMain.handle("facturas-drill-down", async (_, rfc) => {
      try {
        const data = this.descargaService.obtenerDrillDown(rfc);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("obtener-pdf-factura", async (_, datos) => {
      try {
        const fs2 = require("fs");
        const rutaPdf = datos.rutaXml.replace(/\.xml$/i, ".pdf");
        if (!fs2.existsSync(rutaPdf)) {
          const xmlContenido = fs2.readFileSync(datos.rutaXml, "utf-8");
          const pdfService = new PdfService();
          const plantilla = this.configuracionService.obtener()?.plantillaDefault ?? "clasica";
          await pdfService.generarPdf(xmlContenido, datos.parseada, datos.uuid, plantilla, rutaPdf);
        }
        const buffer = fs2.readFileSync(rutaPdf);
        const base64 = buffer.toString("base64");
        return { success: true, base64, rutaPdf };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
}
class ProfileManager {
  constructor(db) {
    this.db = db;
  }
  static perfilActivo = null;
  // ── Perfiles ──────────────────────────────────────────
  obtenerTodos() {
    return this.db.prepare("SELECT * FROM perfiles ORDER BY nombre ASC").all();
  }
  obtenerPorRfc(rfc) {
    return this.db.prepare("SELECT * FROM perfiles WHERE rfc = ?").get(rfc);
  }
  insertar(perfil) {
    this.db.prepare(`
      INSERT OR REPLACE INTO perfiles
        (rfc, nombre, metodo_auth, contrasena, ruta_cer, ruta_key, contrasena_fiel, carpeta_descarga)
      VALUES
        (@rfc, @nombre, @metodo_auth, @contrasena, @ruta_cer, @ruta_key, @contrasena_fiel, @carpeta_descarga)
    `).run({
      contrasena: null,
      ruta_cer: null,
      ruta_key: null,
      contrasena_fiel: null,
      carpeta_descarga: null,
      ...perfil
    });
    this.crearTablasPerfil(perfil.rfc);
  }
  eliminar(rfc) {
    this.db.prepare("DELETE FROM perfiles WHERE rfc = ?").run(rfc);
  }
  // ── Perfil activo ─────────────────────────────────────
  static getPerfilActivo() {
    return this.perfilActivo;
  }
  static setPerfilActivo(perfil) {
    this.perfilActivo = perfil;
  }
  static limpiarPerfil() {
    this.perfilActivo = null;
  }
  // ── Nombres de tablas dinámicos ───────────────────────
  static getTablaFacturas(rfc) {
    const r = rfc || this.perfilActivo?.rfc;
    if (!r) throw new Error("No hay perfil activo");
    return `facturas_${r.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }
  static getTablaPendientes(rfc) {
    const r = rfc || this.perfilActivo?.rfc;
    if (!r) throw new Error("No hay perfil activo");
    return `descargas_pendientes_${r.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }
  static getRfcActivo() {
    return ProfileManager.perfilActivo?.rfc || "";
  }
  // ── Crear tablas para un RFC nuevo ────────────────────
  crearTablasPerfil(rfc) {
    const r = rfc.replace(/[^A-Z0-9]/gi, "");
    this.db.prepare(`CREATE TABLE IF NOT EXISTS facturas_${r} (
    uuid TEXT PRIMARY KEY,
    version TEXT, serie TEXT, folio TEXT,
    fecha_emision TEXT, fecha_timbrado TEXT,
    rfc_emisor TEXT, nombre_emisor TEXT,
    rfc_receptor TEXT, nombre_receptor TEXT,
    subtotal REAL, descuento REAL,
    total_impuestos_trasladados REAL,
    total_impuestos_retenidos REAL,
    total REAL, tipo_comprobante TEXT,
    forma_pago TEXT, metodo_pago TEXT,
    moneda TEXT, tipo_cambio REAL,
    estado TEXT, estado_cancelacion TEXT,
    estado_proceso_cancelacion TEXT,
    fecha_cancelacion TEXT, rfc_pac TEXT,
    folio_sustitucion TEXT, xml TEXT,
    tipo_descarga TEXT, fecha_descarga TEXT
)`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS descargas_pendientes_${r} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE, rfc_emisor TEXT, nombre_emisor TEXT,
    rfc_receptor TEXT, nombre_receptor TEXT,
    fecha_emision TEXT, total REAL,
    tipo_comprobante TEXT, estado TEXT,
    url_descarga TEXT, tipo_descarga TEXT,
    error TEXT, intentos INTEGER, fecha_fallo TEXT
)`).run();
    this.db.prepare(`
    CREATE TABLE IF NOT EXISTS clientes_${r} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc TEXT UNIQUE NOT NULL, nombre TEXT,
      telefono TEXT, email TEXT, direccion TEXT,
      contacto TEXT, notas TEXT,
      limite_credito REAL, dias_credito INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
    this.db.prepare(`
    CREATE TABLE IF NOT EXISTS proveedores_${r} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc TEXT UNIQUE NOT NULL, nombre TEXT,
      telefono TEXT, email TEXT, direccion TEXT,
      contacto TEXT, notas TEXT,
      limite_credito REAL, dias_credito INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
    this.db.prepare(`
    CREATE TABLE IF NOT EXISTS empleados_${r} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc TEXT UNIQUE NOT NULL, nombre TEXT,
      telefono TEXT, email TEXT, direccion TEXT,
      notas TEXT, puesto TEXT, fecha_ingreso DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
    this.db.prepare(`
    CREATE TABLE IF NOT EXISTS patrones_${r} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc TEXT UNIQUE NOT NULL, nombre TEXT,
      telefono TEXT, email TEXT, direccion TEXT,
      contacto TEXT, notas TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  }
}
const ESTRUCTURA_DEFAULT$1 = [
  { id: "contribuyente", label: "Contribuyente", activo: true },
  { id: "ejercicio", label: "Ejercicio", activo: true },
  { id: "periodo", label: "Periodo", activo: false },
  { id: "emisor", label: "Emisor", activo: false },
  { id: "receptor", label: "Receptor", activo: false }
];
const CONFIG_NOMBRE_DEFAULT$1 = {
  rfcEmisor: true,
  rfcReceptor: false
};
class ConfiguracionService {
  constructor(db) {
    this.db = db;
  }
  guardar(config) {
    if (config.metodoAuth === "efirma") {
      if (config.rutaCer) config.rutaCer = this.copiarArchivoEfirma(config.rutaCer, "cer");
      if (config.rutaKey) config.rutaKey = this.copiarArchivoEfirma(config.rutaKey, "key");
    }
    this.db.prepare(`
      UPDATE perfiles SET
        metodo_auth            = @metodo_auth,
        contrasena             = @contrasena,
        ruta_cer               = @ruta_cer,
        ruta_key               = @ruta_key,
        contrasena_fiel        = @contrasena_fiel,
        carpeta_descarga       = @carpeta_descarga,
        plantilla_default      = @plantilla_default,
        carpeta_emitidos       = @carpeta_emitidos,
        carpeta_recibidos      = @carpeta_recibidos,
        estructura_emitidos    = @estructura_emitidos,
        estructura_recibidos   = @estructura_recibidos,
        config_nombre_archivo  = @config_nombre_archivo
      WHERE rfc = @rfc
    `).run({
      rfc: config.rfc,
      metodo_auth: config.metodoAuth,
      contrasena: config.contrasena || null,
      ruta_cer: config.rutaCer || null,
      ruta_key: config.rutaKey || null,
      contrasena_fiel: config.contrasenaFiel || null,
      carpeta_descarga: config.carpetaDescarga || null,
      plantilla_default: config.plantillaDefault || "clasica",
      carpeta_emitidos: config.carpetaEmitidos || null,
      carpeta_recibidos: config.carpetaRecibidos || null,
      estructura_emitidos: JSON.stringify(config.estructuraEmitidos ?? ESTRUCTURA_DEFAULT$1),
      estructura_recibidos: JSON.stringify(config.estructuraRecibidos ?? ESTRUCTURA_DEFAULT$1),
      config_nombre_archivo: JSON.stringify(config.configNombreArchivo ?? CONFIG_NOMBRE_DEFAULT$1)
    });
    const perfil = ProfileManager.getPerfilActivo();
    if (perfil) {
      ProfileManager.setPerfilActivo({
        ...perfil,
        metodo_auth: config.metodoAuth,
        contrasena: config.contrasena,
        ruta_cer: config.rutaCer,
        ruta_key: config.rutaKey,
        contrasena_fiel: config.contrasenaFiel,
        carpeta_descarga: config.carpetaDescarga,
        plantilla_default: config.plantillaDefault || "clasica",
        carpeta_emitidos: config.carpetaEmitidos,
        carpeta_recibidos: config.carpetaRecibidos,
        estructura_emitidos: JSON.stringify(config.estructuraEmitidos ?? ESTRUCTURA_DEFAULT$1),
        estructura_recibidos: JSON.stringify(config.estructuraRecibidos ?? ESTRUCTURA_DEFAULT$1),
        config_nombre_archivo: JSON.stringify(config.configNombreArchivo ?? CONFIG_NOMBRE_DEFAULT$1)
      });
    }
  }
  obtener() {
    const perfil = ProfileManager.getPerfilActivo();
    if (!perfil) return null;
    return {
      rfc: perfil.rfc,
      metodoAuth: perfil.metodo_auth,
      contrasena: perfil.contrasena,
      rutaCer: perfil.ruta_cer,
      rutaKey: perfil.ruta_key,
      contrasenaFiel: perfil.contrasena_fiel,
      carpetaDescarga: perfil.carpeta_descarga,
      plantillaDefault: perfil.plantilla_default || "clasica",
      carpetaEmitidos: perfil.carpeta_emitidos,
      carpetaRecibidos: perfil.carpeta_recibidos,
      estructuraEmitidos: this.parsearEstructura(perfil.estructura_emitidos),
      estructuraRecibidos: this.parsearEstructura(perfil.estructura_recibidos),
      configNombreArchivo: this.parsearConfigNombre(perfil.config_nombre_archivo)
    };
  }
  parsearEstructura(json) {
    try {
      if (!json || json === "[]") return [...ESTRUCTURA_DEFAULT$1];
      return JSON.parse(json);
    } catch {
      return [...ESTRUCTURA_DEFAULT$1];
    }
  }
  parsearConfigNombre(json) {
    try {
      if (!json || json === "{}") return { ...CONFIG_NOMBRE_DEFAULT$1 };
      return JSON.parse(json);
    } catch {
      return { ...CONFIG_NOMBRE_DEFAULT$1 };
    }
  }
  copiarArchivoEfirma(rutaOrigen, tipo) {
    const rfc = ProfileManager.getPerfilActivo()?.rfc || "default";
    const nombreArchivo = `efirma_${rfc}.${tipo}`;
    const rutaDestino = path.join(electron.app.getPath("userData"), nombreArchivo);
    fs__namespace.copyFileSync(rutaOrigen, rutaDestino);
    return rutaDestino;
  }
}
class ConfiguracionHandler {
  configuracionService;
  constructor(db) {
    this.configuracionService = new ConfiguracionService(db);
  }
  registrar() {
    this.handleGuardar();
    this.handleObtener();
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
  get tabla() {
    return ProfileManager.getTablaFacturas();
  }
  insertar(factura) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO ${this.tabla}
        (uuid, version, serie, folio, fecha_emision, fecha_timbrado,
         rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor,
         subtotal, descuento, total_impuestos_trasladados, total_impuestos_retenidos,
         total, tipo_comprobante, forma_pago, metodo_pago, moneda, tipo_cambio,
         estado, estado_cancelacion, estado_proceso_cancelacion, fecha_cancelacion,
         rfc_pac, folio_sustitucion, xml, tipo_descarga)
      VALUES
        (@uuid, @version, @serie, @folio, @fecha_emision, @fecha_timbrado,
         @rfc_emisor, @nombre_emisor, @rfc_receptor, @nombre_receptor,
         @subtotal, @descuento, @total_impuestos_trasladados, @total_impuestos_retenidos,
         @total, @tipo_comprobante, @forma_pago, @metodo_pago, @moneda, @tipo_cambio,
         @estado, @estado_cancelacion, @estado_proceso_cancelacion, @fecha_cancelacion,
         @rfc_pac, @folio_sustitucion, @xml, @tipo_descarga)
    `);
    stmt.run({
      version: null,
      serie: null,
      folio: null,
      fecha_timbrado: null,
      descuento: 0,
      total_impuestos_trasladados: 0,
      total_impuestos_retenidos: 0,
      forma_pago: null,
      metodo_pago: null,
      moneda: null,
      tipo_cambio: null,
      estado_cancelacion: null,
      estado_proceso_cancelacion: null,
      fecha_cancelacion: null,
      rfc_pac: null,
      folio_sustitucion: null,
      ...factura
    });
  }
  actualizar(uuid, campos) {
    const keys = Object.keys(campos).filter((k) => k !== "uuid");
    if (keys.length === 0) return;
    const sets = keys.map((k) => `${k} = @${k}`).join(", ");
    const stmt = this.db.prepare(`UPDATE ${this.tabla} SET ${sets} WHERE uuid = @uuid`);
    stmt.run({ ...campos, uuid });
  }
  obtenerTodas() {
    return this.db.prepare(`SELECT * FROM ${this.tabla} ORDER BY fecha_emision DESC`).all();
  }
  obtenerPorRfc(rfc) {
    return this.db.prepare(`
      SELECT * FROM ${this.tabla}
      WHERE rfc_emisor = ? OR rfc_receptor = ?
      ORDER BY fecha_emision DESC
    `).all(rfc, rfc);
  }
  obtenerPorUuid(uuid) {
    return this.db.prepare(`SELECT * FROM ${this.tabla} WHERE uuid = ?`).get(uuid);
  }
  eliminar(uuid) {
    this.db.prepare(`DELETE FROM ${this.tabla} WHERE uuid = ?`).run(uuid);
  }
  obtenerDrillDown(rfc) {
    return this.db.prepare(`
    SELECT * FROM ${this.tabla}
    WHERE (rfc_emisor = ? OR rfc_receptor = ?)
      AND tipo_comprobante IN ('I', 'E')
      AND estado = 'vigente'
    ORDER BY fecha_emision DESC
  `).all(rfc, rfc);
  }
}
class DescargaPendienteRepository {
  constructor(db) {
    this.db = db;
  }
  get tabla() {
    return ProfileManager.getTablaPendientes();
  }
  insertar(pendiente) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ${this.tabla}
        (uuid, rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor,
         fecha_emision, total, tipo_comprobante, estado, url_descarga,
         tipo_descarga, error, intentos, fecha_fallo)
      VALUES
        (@uuid, @rfc_emisor, @nombre_emisor, @rfc_receptor, @nombre_receptor,
         @fecha_emision, @total, @tipo_comprobante, @estado, @url_descarga,
         @tipo_descarga, @error,
         COALESCE((SELECT intentos + 1 FROM ${this.tabla} WHERE uuid = @uuid), 1),
         datetime('now'))
    `);
    stmt.run(pendiente);
  }
  obtenerTodas() {
    return this.db.prepare(`SELECT * FROM ${this.tabla} ORDER BY fecha_fallo DESC`).all();
  }
  eliminar(uuid) {
    this.db.prepare(`DELETE FROM ${this.tabla} WHERE uuid = ?`).run(uuid);
  }
  limpiar() {
    this.db.prepare(`DELETE FROM ${this.tabla}`).run();
  }
  contar() {
    const row = this.db.prepare(`SELECT COUNT(*) as total FROM ${this.tabla}`).get();
    return row.total;
  }
}
class XmlParserService {
  extraerCampos(rutaXml) {
    try {
      const contenido = fs__namespace.readFileSync(rutaXml, "utf-8");
      const parser = new xmldom.DOMParser();
      const doc = parser.parseFromString(contenido, "text/xml");
      const ns = "http://www.sat.gob.mx/cfd/4";
      const nsTfd = "http://www.sat.gob.mx/TimbreFiscalDigital";
      const cfdi = doc.getElementsByTagNameNS(ns, "Comprobante")[0] || doc.documentElement;
      const tfd = doc.getElementsByTagNameNS(nsTfd, "TimbreFiscalDigital")[0] || null;
      const cfdiRelacionado = doc.getElementsByTagNameNS(ns, "CfdiRelacionado")[0] || null;
      const impuestosEl = doc.getElementsByTagNameNS(ns, "Impuestos")[0] || null;
      const emisor = doc.getElementsByTagNameNS(ns, "Emisor")[0] || null;
      const receptor = doc.getElementsByTagNameNS(ns, "Receptor")[0] || null;
      const getAttr = (el, attr) => el?.getAttribute(attr) || "";
      const getFloat = (el, attr) => parseFloat(el?.getAttribute(attr) || "0") || 0;
      const tipoTexto = getAttr(cfdi, "TipoDeComprobante");
      return {
        uuid: getAttr(tfd, "UUID"),
        version: getAttr(cfdi, "Version"),
        serie: getAttr(cfdi, "Serie"),
        folio: getAttr(cfdi, "Folio"),
        fecha_emision: getAttr(cfdi, "Fecha"),
        forma_pago: getAttr(cfdi, "FormaPago"),
        metodo_pago: getAttr(cfdi, "MetodoPago"),
        moneda: getAttr(cfdi, "Moneda"),
        tipo_cambio: getFloat(cfdi, "TipoCambio"),
        descuento: getFloat(cfdi, "Descuento"),
        subtotal: getFloat(cfdi, "SubTotal"),
        total: getFloat(cfdi, "Total"),
        tipo_comprobante: tipoTexto,
        rfc_emisor: getAttr(emisor, "Rfc"),
        nombre_emisor: getAttr(emisor, "Nombre"),
        rfc_receptor: getAttr(receptor, "Rfc"),
        nombre_receptor: getAttr(receptor, "Nombre"),
        fecha_timbrado: getAttr(tfd, "FechaTimbrado"),
        rfc_pac: getAttr(tfd, "RfcProvCertif"),
        folio_sustitucion: getAttr(cfdiRelacionado, "UUID"),
        total_impuestos_trasladados: getFloat(impuestosEl, "TotalImpuestosTrasladados"),
        total_impuestos_retenidos: getFloat(impuestosEl, "TotalImpuestosRetenidos")
      };
    } catch (err) {
      console.error("Error extrayendo campos XML:", err);
      return {};
    }
  }
}
const ESTRUCTURA_DEFAULT = [
  { id: "contribuyente", label: "Contribuyente", activo: true },
  { id: "ejercicio", label: "Ejercicio", activo: true },
  { id: "periodo", label: "Periodo", activo: false },
  { id: "emisor", label: "Emisor", activo: false },
  { id: "receptor", label: "Receptor", activo: false }
];
const CONFIG_NOMBRE_DEFAULT = {
  rfcEmisor: true,
  rfcReceptor: false
};
class RutaArchivoService {
  /**
   * Construye la ruta absoluta destino para un XML dado.
   * Crea las carpetas intermedias si no existen.
   * Lanza error descriptivo si faltan carpetas base en el perfil.
   */
  construirRutaXml(params) {
    const perfil = ProfileManager.getPerfilActivo();
    if (!perfil) throw new Error("No hay perfil activo");
    const esEmitida = params.tipo_descarga === "emitida";
    const carpetaBase = esEmitida ? perfil.carpeta_emitidos : perfil.carpeta_recibidos;
    if (!carpetaBase) {
      const tipo = esEmitida ? "emitidos" : "recibidos";
      throw new Error(
        `La carpeta de ${tipo} no está configurada. Ve a Configuración > PDF para establecer la ruta.`
      );
    }
    const estructura = this.parsearEstructura(
      esEmitida ? perfil.estructura_emitidos : perfil.estructura_recibidos
    );
    const configNombre = this.parsearConfigNombre(perfil.config_nombre_archivo);
    const fechaStr = params.fecha_emision?.replace("T", " ").split("+")[0].split("-06")[0] ?? "";
    const fecha = fechaStr ? new Date(fechaStr) : /* @__PURE__ */ new Date();
    const subcarpetas = estructura.filter((s) => s.activo).map((s) => this.resolverSlot(s.id, params, perfil.rfc, fecha));
    const carpetaDestino = path__namespace.join(carpetaBase, ...subcarpetas);
    fs__namespace.mkdirSync(carpetaDestino, { recursive: true });
    const segmentos = [];
    if (configNombre.rfcEmisor) segmentos.push(params.rfc_emisor);
    if (configNombre.rfcReceptor) segmentos.push(params.rfc_receptor);
    segmentos.push(params.uuid);
    const nombreArchivo = segmentos.join("_") + ".xml";
    return path__namespace.join(carpetaDestino, nombreArchivo);
  }
  resolverSlot(id, params, rfcActivo, fecha) {
    switch (id) {
      case "contribuyente":
        return rfcActivo;
      case "ejercicio":
        return isNaN(fecha.getTime()) ? "SIN_FECHA" : String(fecha.getFullYear());
      case "periodo":
        return isNaN(fecha.getTime()) ? "00" : String(fecha.getMonth() + 1).padStart(2, "0");
      case "emisor":
        return params.rfc_emisor;
      case "receptor":
        return params.rfc_receptor;
    }
  }
  parsearEstructura(json) {
    try {
      if (!json || json === "[]") return [...ESTRUCTURA_DEFAULT];
      return JSON.parse(json);
    } catch {
      return [...ESTRUCTURA_DEFAULT];
    }
  }
  parsearConfigNombre(json) {
    try {
      if (!json || json === "{}") return { ...CONFIG_NOMBRE_DEFAULT };
      return JSON.parse(json);
    } catch {
      return { ...CONFIG_NOMBRE_DEFAULT };
    }
  }
}
class FacturaGuardadoService {
  constructor(facturaRepository, pendienteRepository) {
    this.facturaRepository = facturaRepository;
    this.pendienteRepository = pendienteRepository;
  }
  xmlParser = new XmlParserService();
  rutaService = new RutaArchivoService();
  guardar(factura, tipoDes) {
    if (!factura.urlDescarga) return;
    const camposXml = this.xmlParser.extraerCampos(factura.urlDescarga);
    const rutaDestino = this.rutaService.construirRutaXml({
      uuid: factura.uuid,
      fecha_emision: factura.fecha_emision,
      rfc_emisor: factura.rfc_emisor,
      rfc_receptor: factura.rfc_receptor,
      tipo_descarga: tipoDes
    });
    fs__namespace.copyFileSync(factura.urlDescarga, rutaDestino);
    const yaExiste = this.facturaRepository.obtenerPorUuid(factura.uuid);
    if (!yaExiste) {
      this.facturaRepository.insertar({
        uuid: factura.uuid,
        fecha_emision: factura.fecha_emision,
        rfc_emisor: factura.rfc_emisor,
        nombre_emisor: factura.nombre_emisor,
        rfc_receptor: factura.rfc_receptor,
        nombre_receptor: factura.nombre_receptor,
        subtotal: factura.total,
        total: factura.total,
        tipo_comprobante: factura.tipo_comprobante,
        estado: factura.estado,
        xml: rutaDestino,
        tipo_descarga: tipoDes,
        fecha_descarga: (/* @__PURE__ */ new Date()).toISOString(),
        ...camposXml
      });
    } else {
      this.facturaRepository.actualizar(factura.uuid, {
        xml: rutaDestino,
        ...camposXml
      });
    }
    this.pendienteRepository.eliminar(factura.uuid);
  }
  guardarPendiente(factura, tipoDes, error) {
    this.pendienteRepository.insertar({
      uuid: factura.uuid,
      rfc_emisor: factura.rfc_emisor,
      nombre_emisor: factura.nombre_emisor,
      rfc_receptor: factura.rfc_receptor,
      nombre_receptor: factura.nombre_receptor,
      fecha_emision: factura.fecha_emision,
      total: factura.total,
      tipo_comprobante: factura.tipo_comprobante,
      estado: factura.estado,
      url_descarga: factura.urlDescarga ?? "",
      // fix: string | undefined → string
      tipo_descarga: tipoDes,
      error
    });
  }
}
class CatalogoRepository {
  constructor(db) {
    this.db = db;
  }
  tabla(tipo) {
    return `${tipo}_${ProfileManager.getRfcActivo()}`;
  }
  tablaFacturas() {
    return ProfileManager.getTablaFacturas();
  }
  obtenerTodos(tipo) {
    const tablaF = this.tablaFacturas();
    const rfcActivo = ProfileManager.getRfcActivo();
    const campoRfc = tipo === "clientes" || tipo === "empleados" ? "rfc_receptor" : "rfc_emisor";
    const filtroTipo = tipo === "clientes" ? `tipo_descarga = 'emitida' AND tipo_comprobante = 'I'` : tipo === "proveedores" ? `tipo_descarga = 'recibida' AND tipo_comprobante = 'I'` : tipo === "empleados" ? `tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}'` : `tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}'`;
    const camposExtra = tipo === "clientes" || tipo === "proveedores" ? `c.limite_credito, c.dias_credito, c.contacto,` : tipo === "empleados" ? `c.puesto, c.fecha_ingreso,` : `c.contacto,`;
    return this.db.prepare(`
    SELECT
      c.id, c.rfc, c.nombre, c.telefono, c.email,
      c.direccion, c.notas, ${camposExtra}
      c.created_at, c.updated_at,
      COUNT(f.uuid) as total_facturas,
      COALESCE(SUM(f.total), 0) as total_facturado,
      MAX(f.fecha_emision) as ultimo_cfdi
    FROM ${this.tabla(tipo)} c
    LEFT JOIN ${tablaF} f ON f.${campoRfc} = c.rfc AND ${filtroTipo}
    GROUP BY c.id
    ORDER BY total_facturado DESC
  `).all();
  }
  obtenerPorRfc(tipo, rfc) {
    const tablaF = this.tablaFacturas();
    const rfcActivo = ProfileManager.getRfcActivo();
    const campoRfc = tipo === "clientes" || tipo === "empleados" ? "rfc_receptor" : "rfc_emisor";
    const filtroTipo = tipo === "clientes" ? `tipo_descarga = 'emitida' AND tipo_comprobante = 'I'` : tipo === "proveedores" ? `tipo_descarga = 'recibida' AND tipo_comprobante = 'I'` : tipo === "empleados" ? `tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}'` : `tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}'`;
    return this.db.prepare(`
      SELECT
        c.*,
        COUNT(f.uuid) as total_facturas,
        COALESCE(SUM(f.total), 0) as total_facturado,
        MAX(f.fecha_emision) as ultimo_cfdi
      FROM ${this.tabla(tipo)} c
      LEFT JOIN ${tablaF} f ON f.${campoRfc} = c.rfc AND ${filtroTipo}
      WHERE c.rfc = ?
      GROUP BY c.id
    `).get(rfc);
  }
  actualizar(tipo, rfc, datos) {
    const campos = Object.keys(datos).filter((k) => k !== "rfc" && k !== "id").map((k) => `${k} = @${k}`).join(", ");
    this.db.prepare(`
      UPDATE ${this.tabla(tipo)}
      SET ${campos}, updated_at = datetime('now')
      WHERE rfc = @rfc
    `).run({ ...datos, rfc });
  }
  sincronizar(tipo) {
    const tablaF = this.tablaFacturas();
    const rfcActivo = ProfileManager.getRfcActivo();
    const queries = {
      clientes: `
        INSERT OR IGNORE INTO ${this.tabla("clientes")} (rfc, nombre)
        SELECT DISTINCT rfc_receptor, nombre_receptor
        FROM ${tablaF}
        WHERE tipo_descarga = 'emitida' AND tipo_comprobante = 'I'
          AND rfc_receptor IS NOT NULL AND rfc_receptor != ''
      `,
      proveedores: `
        INSERT OR IGNORE INTO ${this.tabla("proveedores")} (rfc, nombre)
        SELECT DISTINCT rfc_emisor, nombre_emisor
        FROM ${tablaF}
        WHERE tipo_descarga = 'recibida' AND tipo_comprobante = 'I'
          AND rfc_emisor IS NOT NULL AND rfc_emisor != ''
      `,
      empleados: `
        INSERT OR IGNORE INTO ${this.tabla("empleados")} (rfc, nombre)
        SELECT DISTINCT rfc_receptor, nombre_receptor
        FROM ${tablaF}
        WHERE tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}'
          AND rfc_receptor IS NOT NULL AND rfc_receptor != ''
      `,
      patrones: `
        INSERT OR IGNORE INTO ${this.tabla("patrones")} (rfc, nombre)
        SELECT DISTINCT rfc_emisor, nombre_emisor
        FROM ${tablaF}
        WHERE tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}'
          AND rfc_emisor IS NOT NULL AND rfc_emisor != ''
      `
    };
    this.db.prepare(queries[tipo]).run();
  }
  sincronizarTodos() {
    this.sincronizar("clientes");
    this.sincronizar("proveedores");
    this.sincronizar("empleados");
    this.sincronizar("patrones");
  }
}
class DescargaService {
  constructor(facturaRepository, pendienteRepository, db, scraper) {
    this.facturaRepository = facturaRepository;
    this.pendienteRepository = pendienteRepository;
    this.scraper = scraper;
    this.guardadoService = new FacturaGuardadoService(facturaRepository, pendienteRepository);
    this.catalogoRepository = new CatalogoRepository(db);
  }
  guardadoService;
  catalogoRepository;
  async obtenerCaptcha() {
    await this.scraper.iniciar();
    return await this.scraper.obtenerCaptcha();
  }
  async descargar(config, params, captcha, onProgreso) {
    try {
      const tipoDes = params.tipo === "recibidas" ? "recibida" : "emitida";
      const { facturas, errores } = await this.scraper.descargarFacturas(config, params, captcha, onProgreso);
      let guardadas = 0;
      for (const f of facturas) {
        if (!f.urlDescarga) continue;
        this.guardadoService.guardar(f, tipoDes);
        guardadas++;
      }
      for (const e of errores) {
        if (e.fila) {
          this.guardadoService.guardarPendiente({ uuid: e.uuid, ...e.fila }, tipoDes, e.error);
        }
      }
      this.catalogoRepository.sincronizarTodos();
      return { total: guardadas, errores };
    } finally {
      await this.scraper.cerrar();
    }
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
        const tipoDes = f.tipo_descarga;
        this.guardadoService.guardar(f, tipoDes);
        guardadas++;
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
  obtenerFacturas() {
    return this.facturaRepository.obtenerTodas();
  }
  obtenerFacturaPorUuid(uuid) {
    return this.facturaRepository.obtenerPorUuid(uuid);
  }
  eliminarFactura(uuid) {
    return this.facturaRepository.eliminar(uuid);
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
  obtenerDrillDown(rfc) {
    return this.facturaRepository.obtenerDrillDown(rfc);
  }
}
class PerfilHandler {
  constructor(profileManager) {
    this.profileManager = profileManager;
  }
  registrar() {
    electron.ipcMain.handle("obtener-perfiles", async () => {
      try {
        const perfiles = this.profileManager.obtenerTodos();
        return { success: true, perfiles };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("crear-perfil", async (_, perfil) => {
      try {
        this.profileManager.insertar(perfil);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("eliminar-perfil", async (_, rfc) => {
      try {
        this.profileManager.eliminar(rfc);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("seleccionar-perfil", async (_, rfc) => {
      try {
        const perfil = this.profileManager.obtenerPorRfc(rfc);
        if (!perfil) return { success: false, error: "Perfil no encontrado" };
        ProfileManager.setPerfilActivo(perfil);
        this.profileManager.crearTablasPerfil(rfc);
        return { success: true, perfil };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("obtener-perfil-activo", async () => {
      try {
        const perfil = ProfileManager.getPerfilActivo();
        return { success: true, perfil };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("cerrar-perfil", async () => {
      try {
        ProfileManager.limpiarPerfil();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
}
class ImportacionHandler {
  constructor(db) {
    this.db = db;
  }
  xmlParser = new XmlParserService();
  rutaService = new RutaArchivoService();
  registrar() {
    electron.ipcMain.handle("seleccionar-xmls", async () => {
      const result = await electron.dialog.showOpenDialog({
        title: "Seleccionar archivos XML",
        filters: [{ name: "XML", extensions: ["xml"] }],
        properties: ["openFile", "multiSelections"]
      });
      return { success: true, rutas: result.canceled ? [] : result.filePaths };
    });
    electron.ipcMain.handle("seleccionar-carpeta-xml", async () => {
      const result = await electron.dialog.showOpenDialog({
        title: "Seleccionar carpeta con XMLs",
        properties: ["openDirectory"]
      });
      if (result.canceled) return { success: true, rutas: [] };
      const carpeta = result.filePaths[0];
      const archivos = fs__namespace.readdirSync(carpeta).filter((f) => f.toLowerCase().endsWith(".xml")).map((f) => path__namespace.join(carpeta, f));
      return { success: true, rutas: archivos };
    });
    electron.ipcMain.handle("importar-xmls", async (_, rutas) => {
      const repository = new FacturaRepository(this.db);
      let importadas = 0;
      let omitidas = 0;
      const errores = [];
      for (const ruta of rutas) {
        try {
          const camposXml = this.xmlParser.extraerCampos(ruta);
          const perfil = ProfileManager.getPerfilActivo();
          const rfcActivo = perfil?.rfc;
          if (!camposXml.uuid) {
            errores.push({ archivo: path__namespace.basename(ruta), error: "No se encontró UUID en el XML" });
            continue;
          }
          if (camposXml.rfc_emisor !== rfcActivo && camposXml.rfc_receptor !== rfcActivo) {
            errores.push({
              archivo: path__namespace.basename(ruta),
              error: `El XML no pertenece al contribuyente activo (${rfcActivo})`
            });
            continue;
          }
          const yaExiste = repository.obtenerPorUuid(camposXml.uuid);
          if (yaExiste) {
            omitidas++;
            continue;
          }
          const tipoDes = camposXml.rfc_receptor === rfcActivo ? "recibida" : "emitida";
          const rutaDestino = this.rutaService.construirRutaXml({
            uuid: camposXml.uuid,
            fecha_emision: camposXml.fecha_emision || "",
            rfc_emisor: camposXml.rfc_emisor || "",
            rfc_receptor: camposXml.rfc_receptor || "",
            tipo_descarga: tipoDes
          });
          fs__namespace.copyFileSync(ruta, rutaDestino);
          repository.insertar({
            uuid: camposXml.uuid,
            fecha_emision: camposXml.fecha_emision || "",
            rfc_emisor: camposXml.rfc_emisor || "",
            nombre_emisor: camposXml.nombre_emisor || "",
            rfc_receptor: camposXml.rfc_receptor || "",
            nombre_receptor: camposXml.nombre_receptor || "",
            subtotal: camposXml.subtotal || 0,
            total: camposXml.total || 0,
            tipo_comprobante: camposXml.tipo_comprobante || "I",
            estado: "vigente",
            xml: rutaDestino,
            tipo_descarga: tipoDes,
            fecha_descarga: (/* @__PURE__ */ new Date()).toISOString(),
            ...camposXml
          });
          importadas++;
        } catch (err) {
          errores.push({ archivo: path__namespace.basename(ruta), error: err.message });
        }
      }
      const catalogoRepo = new CatalogoRepository(this.db);
      catalogoRepo.sincronizarTodos();
      return { success: true, importadas, omitidas, errores };
    });
  }
}
class DashboardRepository {
  constructor(db) {
    this.db = db;
  }
  get tabla() {
    return ProfileManager.getTablaFacturas();
  }
  kpisDelMes(año, mes) {
    const mesStr = String(mes).padStart(2, "0");
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const añoAnterior = mes === 1 ? año - 1 : año;
    const mesAnteriorStr = String(mesAnterior).padStart(2, "0");
    const query = (a, m) => this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as ingresos,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as egresos,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_trasladados ELSE 0 END), 0) as iva_cobrado,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total_impuestos_trasladados ELSE 0 END), 0) as iva_pagado
      FROM ${this.tabla}
      WHERE strftime('%Y', fecha_emision) = '${a}' AND strftime('%m', fecha_emision) = '${m}'
    `).get();
    const actual = query(año, mesStr);
    const anterior = query(añoAnterior, mesAnteriorStr);
    const variacion = (a, b) => b === 0 ? 0 : Math.round((a - b) / b * 100);
    return {
      ingresos: actual.ingresos,
      egresos: actual.egresos,
      balance: actual.ingresos - actual.egresos,
      iva_estimado: actual.iva_cobrado - actual.iva_pagado,
      variacion_ingresos: variacion(actual.ingresos, anterior.ingresos),
      variacion_egresos: variacion(actual.egresos, anterior.egresos),
      variacion_balance: variacion(actual.ingresos - actual.egresos, anterior.ingresos - anterior.egresos)
    };
  }
  flujoAnual(año) {
    return this.db.prepare(`
      SELECT
        strftime('%m', fecha_emision) as mes,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as ingresos,
        COALESCE(SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' AND estado = 'vigente' THEN total ELSE 0 END), 0) as egresos
      FROM ${this.tabla}
      WHERE strftime('%Y', fecha_emision) = '${año}'
      GROUP BY mes
      ORDER BY mes ASC
    `).all();
  }
  topProveedores(año, mes) {
    const mesStr = String(mes).padStart(2, "0");
    return this.db.prepare(`
      SELECT
        rfc_emisor as rfc,
        nombre_emisor as nombre,
        COUNT(*) as facturas,
        SUM(total) as total
      FROM ${this.tabla}
      WHERE tipo_descarga = 'recibida'
        AND tipo_comprobante = 'I'
        AND estado = 'vigente'
        AND strftime('%Y', fecha_emision) = '${año}'
        AND strftime('%m', fecha_emision) = '${mesStr}'
      GROUP BY rfc_emisor
      ORDER BY total DESC
      LIMIT 5
    `).all();
  }
  topClientes(año, mes) {
    const mesStr = String(mes).padStart(2, "0");
    return this.db.prepare(`
      SELECT
        rfc_receptor as rfc,
        nombre_receptor as nombre,
        COUNT(*) as facturas,
        SUM(total) as total
      FROM ${this.tabla}
      WHERE tipo_descarga = 'emitida'
        AND tipo_comprobante = 'I'
        AND estado = 'vigente'
        AND strftime('%Y', fecha_emision) = '${año}'
        AND strftime('%m', fecha_emision) = '${mesStr}'
      GROUP BY rfc_receptor
      ORDER BY total DESC
      LIMIT 5
    `).all();
  }
  obtenerConteos(rfcActivo) {
    return this.db.prepare(`
    SELECT
      SUM(CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' THEN 1 ELSE 0 END) as recibidas,
      SUM(CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' THEN 1 ELSE 0 END) as emitidas,
      SUM(CASE WHEN tipo_comprobante = 'N' THEN 1 ELSE 0 END) as nomina,
      SUM(CASE WHEN tipo_comprobante = 'P' THEN 1 ELSE 0 END) as pagos,
      COUNT(DISTINCT CASE WHEN tipo_descarga = 'emitida' AND tipo_comprobante = 'I' THEN rfc_receptor END) as clientes,
      COUNT(DISTINCT CASE WHEN tipo_descarga = 'recibida' AND tipo_comprobante = 'I' THEN rfc_emisor END) as proveedores,
      SUM(CASE WHEN tipo_comprobante = 'N' AND rfc_emisor = '${rfcActivo}' THEN 1 ELSE 0 END) as empleados,
      SUM(CASE WHEN tipo_comprobante = 'N' AND rfc_receptor = '${rfcActivo}' THEN 1 ELSE 0 END) as patrones
    FROM ${this.tabla}
  `).get();
  }
}
class DashboardHandler {
  repository;
  constructor(db) {
    this.repository = new DashboardRepository(db);
  }
  registrar() {
    electron.ipcMain.handle("dashboard-kpis", async (_, año, mes) => {
      try {
        return { success: true, data: this.repository.kpisDelMes(año, mes) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("dashboard-flujo-anual", async (_, año) => {
      try {
        return { success: true, data: this.repository.flujoAnual(año) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("dashboard-top-proveedores", async (_, año, mes) => {
      try {
        return { success: true, data: this.repository.topProveedores(año, mes) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("dashboard-top-clientes", async (_, año, mes) => {
      try {
        return { success: true, data: this.repository.topClientes(año, mes) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("dashboard-obtener-conteos", async () => {
      try {
        const perfil = ProfileManager.getPerfilActivo();
        const data = this.repository.obtenerConteos(perfil?.rfc || "");
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
}
class CatalogoHandler {
  repository;
  constructor(db) {
    this.repository = new CatalogoRepository(db);
  }
  registrar() {
    electron.ipcMain.handle("catalogo-obtener", async (_, tipo) => {
      try {
        const data = this.repository.obtenerTodos(tipo);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("catalogo-obtener-por-rfc", async (_, tipo, rfc) => {
      try {
        const data = this.repository.obtenerPorRfc(tipo, rfc);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("catalogo-actualizar", async (_, tipo, rfc, datos) => {
      try {
        this.repository.actualizar(tipo, rfc, datos);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("catalogo-sincronizar", async () => {
      try {
        this.repository.sincronizarTodos();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }
}
class ConciliacionService {
  constructor(facturaRepository, pendienteRepository, scraper) {
    this.facturaRepository = facturaRepository;
    this.scraper = scraper;
    this.guardadoService = new FacturaGuardadoService(facturaRepository, pendienteRepository);
  }
  guardadoService;
  async conciliar(config, params, onProgreso) {
    const errores = [];
    try {
      onProgreso?.({ etapa: "autenticando" });
      await this.scraper.iniciar();
      let page;
      const authService = this.scraper.authService;
      if (config.metodoAuth === "contrasena") {
        page = await authService.loginConContrasenaDirecto(config.rfc, config.contrasena, params.captcha);
      } else {
        page = await authService.loginConEfirma(config.rutaCer, config.rutaKey, config.contrasenaFiel);
      }
      const mes = params.periodo.padStart(2, "0");
      const ultimoDia = new Date(parseInt(params.ejercicio), parseInt(mes), 0).getDate();
      const fechaInicio = `01/${mes}/${params.ejercicio}`;
      const fechaFin = `${ultimoDia}/${mes}/${params.ejercicio}`;
      const paramsBusqueda = {
        tipo: params.tipo,
        buscarPor: "fecha",
        fechaInicio,
        fechaFin
      };
      onProgreso?.({ etapa: "consultando" });
      const filasSat = await this.scraper.buscarEnPagina(page, paramsBusqueda);
      const totalSat = filasSat.length;
      onProgreso?.({ etapa: "comparando" });
      const tipoDes = params.tipo === "recibidas" ? "recibida" : "emitida";
      const faltantes = filasSat.filter((f) => !this.facturaRepository.obtenerPorUuid(f.uuid));
      const existentes = filasSat.filter((f) => {
        const local = this.facturaRepository.obtenerPorUuid(f.uuid);
        return local && local.estado === "vigente" && f.estado === "cancelado";
      });
      const totalLocal = totalSat - faltantes.length;
      let descargadas = 0;
      if (faltantes.length > 0) {
        onProgreso?.({ etapa: "descargando", descargadas: 0, totalFaltantes: faltantes.length });
        const { facturas, errores: erroresDescarga } = await this.scraper.descargarEnParalelo(
          page,
          faltantes,
          (p) => onProgreso?.({ etapa: "descargando", descargadas: p.descargadas, totalFaltantes: faltantes.length })
        );
        for (const f of facturas) {
          if (!f.urlDescarga) continue;
          try {
            this.guardadoService.guardar(f, tipoDes);
            descargadas++;
          } catch (err) {
            errores.push({ uuid: f.uuid, error: err.message });
          }
        }
        for (const e of erroresDescarga) {
          const fila = faltantes.find((f) => f.uuid === e.uuid);
          if (fila) {
            this.guardadoService.guardarPendiente(fila, tipoDes, e.error);
          }
          errores.push({ uuid: e.uuid, error: e.error });
        }
      }
      let actualizadas = 0;
      if (existentes.length > 0) {
        onProgreso?.({ etapa: "actualizando", actualizadas: 0 });
        for (const f of existentes) {
          try {
            this.facturaRepository.actualizar(f.uuid, { estado: "cancelado" });
            actualizadas++;
          } catch (err) {
            errores.push({ uuid: f.uuid, error: err.message });
          }
        }
      }
      onProgreso?.({ etapa: "completado" });
      return { totalSat, totalLocal, descargadas, actualizadas, errores };
    } finally {
      await this.scraper.cerrar();
    }
  }
}
class ConciliacionHandler {
  constructor(conciliacionService, configuracionService) {
    this.conciliacionService = conciliacionService;
    this.configuracionService = configuracionService;
  }
  registrar() {
    electron.ipcMain.handle("iniciar-conciliacion", async (event, params) => {
      try {
        const config = this.configuracionService.obtener();
        if (!config) return { success: false, error: "No hay configuración guardada" };
        const resumen = await this.conciliacionService.conciliar(
          config,
          params,
          (progreso) => event.sender.send("progreso-conciliacion", progreso)
        );
        return { success: true, resumen };
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
  async loginConContrasenaDirecto(rfc, password, captcha) {
    const page = await this.context.newPage();
    await page.goto("https://portalcfdi.facturaelectronica.sat.gob.mx/");
    await page.waitForSelector("#divCaptcha", { timeout: 15e3 });
    await page.fill("#rfc", rfc);
    await page.fill("#password", password);
    await page.fill("#userCaptcha", captcha.toUpperCase());
    await this.esperarLoginExitoso(page, () => page.click("#submit"));
    return page;
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
    this.context = await BrowserManager.newContext();
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
    const [_diaI, mesI, anioI] = fechaInicio.split("/").map(Number);
    const [_diaF, mesF, anioF] = fechaFin.split("/").map(Number);
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
        const [diaI2, mesI2, anioI2] = params.fechaInicio.split("/");
        const [diaF, mesF, anioF] = params.fechaFin.split("/");
        const fechaInicialStr = `${diaI2}/${mesI2}/${anioI2}`;
        const fechaFinalStr = `${diaF}/${mesF}/${anioF}`;
        await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (el) el.removeAttribute("disabled");
        }, "ctl00_MainContent_CldFechaInicial2_Calendario_text");
        await page.fill("#ctl00_MainContent_CldFechaInicial2_Calendario_text", fechaInicialStr);
        await page.waitForTimeout(300);
        await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (el) el.removeAttribute("disabled");
        }, "ctl00_MainContent_CldFechaFinal2_Calendario_text");
        await page.fill("#ctl00_MainContent_CldFechaFinal2_Calendario_text", fechaFinalStr);
        await page.waitForTimeout(300);
        await page.selectOption("#ctl00_MainContent_CldFechaFinal2_DdlHora", "23");
        await page.selectOption("#ctl00_MainContent_CldFechaFinal2_DdlMinuto", "59");
        await page.selectOption("#ctl00_MainContent_CldFechaFinal2_DdlSegundo", "59");
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
      await this.context.close();
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
function initDatabase() {
  const db = Database.getInstance();
  const migrationRunner = new MigrationRunner(db);
  try {
    migrationRunner.run();
  } catch (err) {
    console.error("Error en migraciones:", err);
  }
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon,
    title: "IFRAT",
    // ← agregar esto
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.setTitle("IFRAT - Inteligencia Fiscal para la Revisión y Administración Tributaria");
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
  const satScraper = new SatScraper();
  new ImportacionHandler(db).registrar();
  const facturaRepository = new FacturaRepository(db);
  const descargaPendienteRepository = new DescargaPendienteRepository(db);
  const configuracionService = new ConfiguracionService(db);
  const descargaService = new DescargaService(facturaRepository, descargaPendienteRepository, db, satScraper);
  const conciliacionService = new ConciliacionService(facturaRepository, descargaPendienteRepository, satScraper);
  const profileManager = new ProfileManager(db);
  new PerfilHandler(profileManager).registrar();
  new FacturaHandler(descargaService, configuracionService).registrar();
  new ConfiguracionHandler(db).registrar();
  new DashboardHandler(db).registrar();
  new CatalogoHandler(db).registrar();
  new ConciliacionHandler(conciliacionService, configuracionService).registrar();
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
