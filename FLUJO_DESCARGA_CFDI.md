# Flujo Descarga de CFDI - Análisis Arquitectónico

## 3 Módulos Principales

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  DESCARGA SAT          │  PENDIENTES              │  CONCILIACIÓN      │
│  (DescargaService)     │  (PendientesService)     │  (ConciliacionService)
│                        │                          │                    │
└─────────────────────────────────────────────────────────────────────────┘
         │                       │                           │
         ├──────────────────────┴───────────────────────────┤
         │
         └─► Todos usan las MISMAS 3 dependencias:
             1. SatAuthService      (Autenticación)
             2. SatBusquedaService  (Búsqueda/Consulta)
             3. SatDescargaService  (Descarga archivos)
```

---

## Flujo Detallado: DESCARGA SAT

### Archivo: `src/main/services/DescargaService.ts`

```
DescargaService.descargar(config, params)
│
├─► 1. AuthHelper.login(config, captcha)
│   └─► SatAuthService.loginConContrasena()  ◄── ABRE navegador
│       └─► Retorna: Page (Playwright)
│
├─► 2. SatBusquedaService.buscarPorParametros(page, params)
│   ├─► Evalúa si es búsqueda por folio o rango de fechas
│   ├─► Buscarecibidas por mes (si es recibidas)
│   ├─► Navega a: https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaReceptor.aspx
│   │          o: https://portalcfdi.facturaelectronica.sat.gob.mx/ConsultaEmisor.aspx
│   │
│   ├─► Rellena formularios de búsqueda
│   │   - RFC, rango de fechas, estado, etc
│   │
│   └─► Retorna: FacturaExtraida[] con uuid, rfc, nombre, monto, urlDescarga
│
├─► 3. SatDescargaService.descargarEnLote(page, filas)
│   ├─► EXTRAE COOKIES del contexto Playwright
│   │   const cookies = await context.cookies()
│   │   const cookieString = cookies.map(...).join('; ')
│   │
│   ├─► ITERA en lotes de 10 facturas
│   │   for (let i = 0; i < filas.length; i += this.LOTE_SIZE)
│   │
│   ├─► POR CADA LOTE:
│   │   ├─► Llama descargarUnoConAxios() en paralelo
│   │   │   ├─► Usa axios con cookies guardadas
│   │   │   ├─► POST a: https://portalcfdi.facturaelectronica.sat.gob.mx/{urlDescarga}
│   │   │   ├─► Headers incluyen: Cookie, User-Agent, Referer
│   │   │   └─► Guarda XML en carpeta temporal
│   │   │
│   │   └─► Retorna: { rutaTemp, meta }
│   │
│   └─► Retorna: { exitosas: [], errores: [] }
│
├─► 4. DescargaHelper.procesarDescargas(exitosas)
│   ├─► Valida XML
│   ├─► Parsea CFDI
│   ├─► Guarda en BD
│   └─► Retorna: { guardadas, errores }
│
└─► ⚠️ FIN: Session y navegador QUEDAN ABIERTOS
    └─► No llama authService.cerrarSesion()
    └─► No cierra el contexto de Playwright
    └─► Cookies permanecen en memoria
```

---

## Flujo Detallado: PENDIENTES

### Archivo: `src/main/services/PendientesService.ts`

```
PendientesService.reintentar(config, captcha)
│
├─► 1. AuthHelper.login(config, captcha)
│   └─► ✓ Abre NUEVA sesión (nueva Page)
│
├─► 2. ITERA sobre pendientes:
│   for (let i = 0; i < pendientes.length; i++)
│   │
│   ├─► 2.1. SatBusquedaService.buscarEnPagina(page, { buscarPor: 'folio' })
│   │       └─► Busca UUID específico por folio fiscal
│   │
│   ├─► 2.2. SatDescargaService.descargarUnoConPlaywright()
│   │       ├─► Usa Playwright directamente (NO axios)
│   │       ├─► NO extrae ni usa cookies
│   │       ├─► Espera evento 'download'
│   │       └─► Mueve archivo a carpeta final
│   │
│   ├─► 2.3. CfdiGuardadoService.guardarDesdeRuta()
│   │       └─► Valida y guarda en BD
│   │
│   └─► Progresa: descargadas/totalFacturas
│
└─► ⚠️ FIN: Session y navegador QUEDAN ABIERTOS
    └─► No llama authService.cerrarSesion()
```

---

## Flujo Detallado: CONCILIACIÓN

### Archivo: `src/main/services/ConciliacionService.ts`

```
ConciliacionService.conciliar(config, params)
│
├─► 1. AuthHelper.login(config, captcha)
│   └─► Abre NUEVA sesión
│
├─► 2. SatBusquedaService.buscarEnPagina(page, {buscarPor: 'fecha'})
│   └─► Consulta SAT para mes/año específico
│       └─► Retorna: filas del SAT
│
├─► 3. COMPARA:
│   ├─► faltantes = filasSat.filter(f => !DB.contiene(f.uuid))
│   ├─► aActualizar = filasSat.filter(f => local.vigente && sat.cancelado)
│
├─► 4. SatDescargaService.descargarEnLote(page, faltantes)
│   └─► ✓ Extrae cookies y descarga con axios
│
├─► 5. DescargaHelper.procesarDescargas(exitosas)
│   └─► Guarda nuevas facturas
│
├─► 6. Actualiza estados: vigente → cancelado
│   └─► CfdiGuardadoService.actualizarEstado()
│
├─► 7. ConciliacionRepository.insertar(historial)
│   └─► Guarda registro de conciliación
│
└─► ⚠️ FIN: Session y navegador QUEDAN ABIERTOS
    └─► No llama authService.cerrarSesion()
```

---

## 🔴 PROBLEMAS IDENTIFICADOS

### 1. **NO CIERRA SESIÓN/NAVEGADOR**

- Después de cada descarga, el `Page` y `BrowserContext` quedan abiertos
- SatAuthService.cerrarSesion() **existe pero NUNCA se llama**
- Recursos de Playwright se acumulan en memoria
- Archivos de Chrome temporal no se limpian

```typescript
// ❌ NO SE LLAMA EN NINGÚN LADO
async cerrarSesion(): Promise<void> {
  if (this.paginaLogin) await this.paginaLogin.close()
  if (this.context) await this.context.close()
  await BrowserManager.cerrar()
}
```

### 2. **ALMACENA Y REUTILIZA COOKIES**

- `SatDescargaService.descargarEnLote()` extrae cookies del contexto
- Las cookies se usan en `axios` para descargas sin abrir navegador
- **Problema**: Cookies pueden caducar y las descargas fallarán

```typescript
// ⚠️ EXTRAE COOKIES del contexto
const context = page.context()
const cookies = await context.cookies()
const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')

// ⚠️ LAS REUTILIZA en axios (línea 96)
headers: { Cookie: cookieString, ... }
```

### 3. **INCONSISTENCIA: Dos métodos de descarga**

- **Descarga SAT**: Usa axios + cookies (sin navegador)
- **Pendientes**: Usa Playwright con eventos de descarga

```typescript
// ❌ SatDescargaService tiene AMBOS métodos
async descargarUnoConPlaywright() { ... }      // Usado en Pendientes
async descargarUnoConAxios() { ... }           // Usado en Descarga
```

### 4. **CONTEXT/PAGE NO SE COMPARTEN**

- Cada módulo abre su propia sesión con `AuthHelper.login()`
- Pero luego reutilizan el contexto en la descarga
- **Problema**: Si falla descarga a mitad, la siguiente intenta reutilizar contexto cerrado

---

## 🏗️ ARQUITECTURA ACTUAL vs IDEAL

### ACTUAL (Defectuosa)

```
[Descarga]  [Pendientes]  [Conciliación]
    │           │              │
    └─────────────────────────┘
           SatAuthService
           SatBusquedaService
           SatDescargaService
           ❌ NO CIERRA SESIÓN
           ❌ COOKIES REUTILIZADAS
           ❌ RECURSOS ACUMULADOS
```

### IDEAL (Propuesto)

```
┌─────────────────────────────────────────┐
│    SatSessionManager (NUEVO)            │  ◄── Gestiona 1 sesión por operación
│  - Abre contexto/page                   │
│  - Mantiene cookies frescas             │
│  - CIERRA siempre                       │
└─────────────────────────────────────────┘
          ▲         ▲         ▲
    [Descarga] [Pendientes] [Conciliación]
```

---

## Handlers IPC (Puntos de Entrada)

### FacturaHandler.ts

```typescript
// Descarga normal
'descargar-facturas'
  → DescargaService.descargar()
    └─► AuthHelper.login() → BrowserContext ABIERTO
    └─► SatBusquedaService.buscarPorParametros()
    └─► SatDescargaService.descargarEnLote()
    └─► ❌ NO CIERRA

// Reintentar pendientes
'reintentar-pendientes'
  → PendientesService.reintentar()
    └─► AuthHelper.login() → BrowserContext ABIERTO (puede ser diferente)
    └─► Itera pendientes uno por uno
    └─► ❌ NO CIERRA

// Conciliación (en otro handler probablemente)
'conciliar'
  → ConciliacionService.conciliar()
    └─► AuthHelper.login() → BrowserContext ABIERTO
    └─► Compara SAT vs Local
    └─► ❌ NO CIERRA
```

---

## 📋 Resumen de Dependencias

| Archivo             | Rol                         | Abre Sesión              | Cierra          |
| ------------------- | --------------------------- | ------------------------ | --------------- |
| SatAuthService      | Autenticación, login/logout | ✓ openContext/Page       | ✗ NUNCA LLAMADA |
| SatBusquedaService  | Navega y extrae datos       | ✗ (recibe Page)          | ✗               |
| SatDescargaService  | Descarga archivos XML       | ✗ (recibe Page)          | ✗               |
| DescargaService     | Orquesta Descarga SAT       | ✗ (crea AuthHelper)      | ✗               |
| PendientesService   | Orquesta Pendientes         | ✗ (crea AuthHelper)      | ✗               |
| ConciliacionService | Orquesta Conciliación       | ✗ (crea AuthHelper)      | ✗               |
| AuthHelper          | Wrapper de auth             | ✓ (llama SatAuthService) | ✗ NO EXPONE     |

---

## 🎯 Cambios Requeridos

1. **Garantizar cierre de sesión** después de cada operación
   - Llamar `authService.cerrarSesion()` en `finally`
   - O crear `SatSessionManager` que maneje lifecycle

2. **Eliminar cookies reutilizadas**
   - Usar navegador (Playwright) para TODAS las descargas
   - O mantener sesión viva solo mientras se descarga

3. **Centralizar gestión de sesión**
   - 1 sesión = 1 operación (Descarga / Pendientes / Conciliación)
   - Sesión se cierra al terminar

4. **Diferenciar métodos de descarga**
   - Usar solo Playwright en `SatDescargaService`
   - Eliminar `descargarUnoConAxios()`
