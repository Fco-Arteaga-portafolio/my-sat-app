# Contrato del módulo RFC de cuenta (agregar RFC / sincronización)

> Documenta cómo IFRAT Desktop (`my-sat-app`) consume los RFCs de la cuenta y
> qué debe implementar Emite para que "Agregar RFC" funcione igual desde el
> Desktop y desde el frontend, sincronizado por el backend.
>
> Base URL: `https://ifrat.ar-sa.com.mx/api` · Envelope `Result<T>` (camelCase)
> · Ambos endpoints con `Authorization: Bearer <jwt>`; el `UsuarioId` sale del
> JWT (mismo login que la web).

## Reglas del producto (acordadas)

- Los RFCs de una cuenta viven en `ProductoRfc` (ya existe en Emite) y son
  compartidos: sirven igual para Emite y para IFRAT Desktop.
- La demo otorga **1 RFC gratis** (`precioPagado = 0`). Comprar el producto RFC
  desde el web ("Agregar RFC" → `RfcAdicional`) otorga cupo para otro RFC.
- **Comprar y agregar son procesos separados**: la compra habilita el alta; el
  alta (dar de alta el RFC) es otra acción.
- **Regla estricta del Desktop**: el alta de contribuyente solo se habilita si
  la cuenta **compró** el producto RFC (algún RFC activo con `precioPagado > 0`
  en el resumen). El RFC gratuito de la demo **no** habilita el botón.

## 1) Resumen de licencia — `GET /api/licencia/resumen` (ya existe)

El Desktop ya lo consume. Necesita leer la lista de RFCs:

```jsonc
{
  "succeeded": true,
  "data": {
    "usoIlimitado": false,
    "contadores": [],
    "rfcs": [
      { "id": "guid", "rfc": "XAXX010101000", "alias": "Mi empresa",
        "fechaAlta": "2026-10-07T00:00:00Z", "activo": true, "precioPagado": 0 },
      { "id": "guid", "rfc": "AAA010101001", "alias": "Segundo RFC",
        "fechaAlta": "2026-10-07T00:00:00Z", "activo": true, "precioPagado": 249.00 }
    ]
  }
}
```

El Desktop deriva el gate así (CONTRATO del lado Desktop):

- `puedeAgregarRfc = rfcs.some(r => r.activo && r.precioPagado > 0)`
- Si no hay resumen (offline/no sincronizado) el gate queda **apagado** con
  motivo "No se pudo sincronizar tu licencia".

> `rfcs` ya viene en el DTO `LicenciaResumenDto` — no hay cambio aquí, solo
> usarlo.

## 2) Registrar RFC en la cuenta — `POST /api/rfcs` (nuevo)

Lo llama el Desktop cuando el usuario guarda un contribuyente nuevo. **No
cobra** (el cupo ya se compró aparte en el web): valida el cupo y da de alta el
RFC en la cuenta para que también aparezca en Emite.

### Request body (application/json)

```jsonc
{
  "rfc": "AAA010101001",   // obligatorio, se normaliza a mayúsculas sin guiones (12/13)
  "alias": "Segunda empresa" // opcional (nombre del contribuyente)
}
```

### Respuesta exitosa (HTTP 200)

```json
{
  "succeeded": true,
  "data": {
    "id": "guid",
    "rfc": "AAA010101001",
    "alias": "Segunda empresa",
    "activo": true,
    "precioPagado": 0,
    "yaExistia": false
  },
  "message": null,
  "statusCode": 200
}
```

- **Idempotente**: si el RFC ya está activo en la cuenta, responder success con
  `yaExistia: true` (así el Desktop puede configurar un RFC comprado en Emite
  sin duplicarlo).
- **Cupo**: si la cuenta no tiene el producto RFC comprado (regla estricta) o
  ya usó sus slots → HTTP 400 con `{ succeeded: false, message: "..." }`. El
  Desktop muestra `message` tal cual.

### Errores

- RFC inválido/vacío → 400 `"El RFC es obligatorio"` / `"El RFC no tiene el formato correcto"`.
- Sin cupo → 400 `"Compra el producto RFC para agregar otro contribuyente"`.
- Sin JWT → 401.

## Notas de implementación para Emite

- Reuso: entidad `ProductoRfc`, repositorio `IProductoRfcRepository`
  (`ContarActivosAsync`, `ObtenerPorRfcAsync`) y `ProductoRfc.CrearComprado`
  existen. El cupo = productos RFC comprados (activos) − RFCs activos.
- `AplicarCobroMercadoPagoService` hoy **crea el RFC al comprar** (con el string
  del checkout). Para respetar "comprar ≠ agregar", mueve la creación del RFC al
  `POST /api/rfcs` (la compra solo otorga cupo) o, mínimo, permite que este
  endpoint registre RFCs nuevos mientras haya cupo. Decisión de producto tuya;
  el Desktop ya quedó listo para que `POST /api/rfcs` sea la puerta de entrada.
- El endpoint NO cobra ni toca MercadoPago: el pago del producto RFC ocurre en
  el web (orden `RfcAdicional`).

## Cómo consume esto el Desktop (referencia)

- `src/main/services/BackendService.ts` → `registrarRfc(jwt, { rfc, alias })`
  (POST /rfcs) y `ResumenLicencia.rfcs` (GET /licencia/resumen).
- `src/main/services/SesionService.ts` → `puedeAgregarRfc()` (regla estricta).
- `src/main/ipc/PerfilHandler.ts` → `obtener-estado-agregar-rfc` y `crear-perfil`
  (registra en el backend **antes** de crear el perfil local; si el backend
  rechaza o el endpoint no existe, muestra el error y NO crea el perfil).
- `src/renderer/src/pages/PerfilesPage/` → botón "Agregar contribuyente"
  deshabilitado + motivo cuando no hay producto RFC comprado, con reintento de
  sincronización (para reflejar compras hechas en Emite).