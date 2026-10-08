# Contrato del módulo de Soporte Técnico (tickets)

> Documenta el **contrato real ya implementado en Emite** y la cara que lo
> consume: la pantalla "Soporte Técnico" de IFRAT Desktop (`my-sat-app`).
>
> Base URL (producción): `https://ifrat.ar-sa.com.mx/api`
> Formato de respuestas: envelope `Result<T>` del backend (`{ succeeded, data, message, statusCode }`, camelCase).
> Ambos endpoints requieren `Authorization: Bearer <jwt>` (mismo login que la web). El `UsuarioId` sale del JWT.

---

## 1) Crear ticket — `POST /api/soporte/tickets`

### Request body (application/json)

```jsonc
{
  "macAddress": "hash estable de node-machine-id", // obligatorio, se normaliza a mayúsculas
  "versionIfrat": "1.2.21",                        // versión de IFRAT Desktop
  "asunto": "No descarga constancia",              // requerido
  "descripcion": "Al intentar generar...",         // requerido
  "contenidoLog": "logs en texto plano"            // obligatorio, hasta ~200 KB
}
```

### Respuesta exitosa (HTTP 200)

```json
{
  "succeeded": true,
  "data": {
    "id": "c2f4e3a3-...",
    "macAddress": "...",
    "versionIfrat": "1.2.21",
    "asunto": "No descarga constancia",
    "descripcion": "Al intentar generar...",
    "contenidoLog": "...",
    "estado": "Enviado",
    "fechaEnvio": "2026-10-07T15:04:00Z",
    "fechaVistoPorSoporte": null,
    "respuestaSoporte": null,
    "fechaRespuesta": null
  },
  "message": null,
  "statusCode": 200
}
```

### Errores

- Campos inválidos/faltantes → HTTP 400 con `{ succeeded: false, message: "..." }`.
- Sin JWT → HTTP 401.
- El Desktop muestra `message` tal cual viene del backend.

### Estados del ticket (ciclo)

`Enviado` → `Visto` → `ConSeguimiento`

- `Enviado`: recibido, IFRAT aún no lo ha visto.
- `Visto`: IFRAT ya lo abrió (`fechaVistoPorSoporte` se llena).
- `ConSeguimiento`: IFRAT respondió (`respuestaSoporte` + `fechaRespuesta`).

---

## 2) Listar tickets del usuario — `GET /api/soporte/tickets`

Devuelve solo los tickets del **usuario autenticado**, más recientes primero:

```json
{
  "succeeded": true,
  "data": [
    {
      "id": "c2f4e3a3-...",
      "macAddress": "...",
      "versionIfrat": "1.2.21",
      "asunto": "No descarga constancia",
      "descripcion": "Al intentar generar...",
      "contenidoLog": "...",
      "estado": "ConSeguimiento",
      "fechaEnvio": "2026-10-07T15:04:00Z",
      "fechaVistoPorSoporte": "2026-10-07T16:00:00Z",
      "respuestaSoporte": "Ya lo revisamos, actualiza a la 1.2.22.",
      "fechaRespuesta": "2026-10-07T16:10:00Z"
    }
  ],
  "message": null,
  "statusCode": 200
}
```

Sin tickets → `data: []`.

---

## 3) Extras del lado IFRAT (consumidos por Emite, no por el Desktop)

- `PATCH /api/soporte/tickets/{ticketId}/visto` — IFRAT marca el ticket como visto.
- `PATCH /api/soporte/tickets/{ticketId}/seguimiento` — body `{ "respuesta": "..." }`; queda `ConSeguimiento`.
- `GET /api/soporte/tickets/{ticketId}` — detalle, solo si es del usuario.

> Nota del backend: aún no hay roles en el JWT, así que estos endpoints quedan con
> `[Authorize]` genérico y se registra `UsuarioSoporteId` (quién lo hizo). Cuando
> existan roles, restringirlos a cuentas de soporte de IFRAT.

---

## Cómo consume esto el Desktop (referencia)

- `src/main/services/BackendService.ts` → `enviarTicketSoporte(jwt, datos)` (POST /soporte/tickets) y `obtenerTicketsSoporte(jwt)` (GET /soporte/tickets).
- `src/main/ipc/SoporteHandler.ts` → arma el payload: `macAddress` de `node-machine-id` (`SesionService.obtenerHardwareId()`), `versionIfrat` de `app.getVersion()`, y `contenidoLog` con los logs en memoria (recortados a ~200 KB).
- `src/renderer/src/components/ModalSoporte/` → UI con pestañas "Nuevo reporte" y "Mis tickets".
- Si el endpoint no responde, el Desktop muestra el error y ofrece guardar el reporte en un `.txt` local.