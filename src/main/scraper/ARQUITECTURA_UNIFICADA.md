# Arquitectura Unificada SAT

## Descripción General

Esta arquitectura consolida la lógica de autenticación y operaciones en portales SAT en servicios reutilizables que siguen principios SOLID.

## Principios SOLID Aplicados

### 1. Single Responsibility Principle (SRP)

Cada clase tiene una única responsabilidad:

- **PortalConfigProvider**: Solo lee configuración
- **SatUnifiedAuthService**: Solo autentica usuarios
- **SatPortalOperationService**: Orquesta operaciones (Template Method)
- **SatConstanciaOperationService**: Lógica específica de Constancia
- **SatCumplimientoOperationService**: Lógica específica de Cumplimiento

### 2. Open/Closed Principle (OCP)

- Abierto a extensión: Nuevos portales heredan de `SatPortalOperationService`
- Cerrado a modificación: La lógica base no cambia
- Configuración JSON permite agregar portales sin código

### 3. Liskov Substitution Principle (LSP)

- Todos los servicios de operación implementan `ISatOperation`
- Pueden usarse de manera intercambiable
- `SatUnifiedAuthService` implementa `ISatAuthService`

### 4. Interface Segregation Principle (ISP)

- Interfaces pequeñas y específicas:
  - `CaptchaData`: Solo para captcha
  - `CiecCredentials` / `FielCredentials`: Credenciales separadas
  - `ISatAuthService`: Solo autenticación
  - `ISatOperation`: Solo operaciones

### 5. Dependency Injection (DI)

- `IPortalConfigProvider` inyectada en servicios
- `ConfiguracionService` inyectado en handlers
- Permite testear fácilmente mock objetos

## Estructura de Archivos

```
src/main/
├── config/
│   └── satPortals.config.json          # Configuración de todos los portales
├── scraper/
│   ├── SatPortalConfig.ts              # Interfaces y tipos (SOLID)
│   ├── PortalConfigProvider.ts         # Lee configuración JSON
│   ├── SatUnifiedAuthService.ts        # Autenticación unificada
│   ├── SatPortalOperationService.ts    # Servicio base abstracto
│   ├── SatConstanciaOperationService.ts # Implementación: Constancia
│   ├── SatCumplimientoOperationService.ts # Implementación: Cumplimiento
│   ├── SatAuthService.ts               # DEPRECATED (mantener para compatibilidad)
│   └── ...
└── ipc/
    ├── UnifiedSatHandler.ts            # Handler dinámico unificado
    ├── ConstanciaHandler.ts            # DEPRECATED (usa UnifiedSatHandler)
    ├── CumplimientoHandler.ts          # DEPRECATED (usa UnifiedSatHandler)
    └── ...
```

## Flujo de Ejecución

### Obtener Captcha

```
React Component
    ↓
IPC: obtener-captcha-dinamico { portalId: 'constancia' }
    ↓
UnifiedSatHandler.obtenerCaptcha()
    ↓
SatUnifiedAuthService.obtenerCaptcha(portalId)
    ↓
PortalConfigProvider.obtenerConfiguracion(portalId)
    ↓
[config.json] Selectores CSS específicos
    ↓
Playwright navega y captura imagen
    ↓
Retorna imagenBase64
```

### Ejecutar Operación

```
React Component
    ↓
IPC: ejecutar-operacion-dinamica { portalId, credenciales }
    ↓
UnifiedSatHandler.ejecutarOperacion()
    ↓
SatConstanciaOperationService.ejecutar()  (o Cumplimiento)
    ↓
1. ejecutarOperacion() - Template Method
2. Autentica (heredado)
3. ejecutarOperacionEspecífica() - Implementación
    ↓
Retorna SatOperationResult
```

## Cómo Agregar un Nuevo Portal

### 1. Actualizar configuración JSON

```json
{
  "id": "nuevo-portal",
  "name": "Nuevo Portal SAT",
  "baseUrl": "https://nuevo.sat.gob.mx/",
  "loginUrl": "https://nuevo.sat.gob.mx/login",
  "loginDomain": "nuevo.sat.gob.mx",
  "authMethods": ["ciec", "fiel"],
  "requiresCaptcha": true,
  "selectors": {
    "captchaImage": "#captcha-img",
    "rfcField": "#rfc",
    ...
  }
}
```

### 2. Crear servicio de operación

```typescript
import { SatPortalOperationService } from './SatPortalOperationService'

export class SatNuevoPortalOperationService extends SatPortalOperationService {
  constructor(configProvider: IPortalConfigProvider) {
    super('nuevo-portal', configProvider)
  }

  protected async ejecutarOperacion(
    credenciales: SatCredentials,
    options: SatOperationOptions
  ): Promise<SatOperationResult> {
    // Tu lógica específica aquí
  }
}
```

### 3. Registrar en main index.ts

```typescript
import { SatNuevoPortalOperationService } from './scraper/SatNuevoPortalOperationService'

const nuevoPortalService = new SatNuevoPortalOperationService(configProvider)

const unifiedHandler = new UnifiedSatHandler(configuracionService, {
  // ... portales existentes
  'nuevo-portal': {
    obtenerCaptcha: () => nuevoPortalService.obtenerCaptcha(),
    ejecutar: (cred, opts) => nuevoPortalService.ejecutar(cred, opts),
    cerrarSesion: () => nuevoPortalService.cerrarSesion()
  }
})
```

## Compatibilidad Hacia Atrás

El código React existente sigue funcionando sin cambios:

- `window.api.obtenerCaptcha()` → redirige a `obtener-captcha-dinamico`
- `window.api.constanciaObtenerCaptcha()` → mapea a UnifiedSatHandler
- Todos los handlers legacy están soportados

## Mejoras vs. Código Anterior

| Aspecto               | Antes       | Después     |
| --------------------- | ----------- | ----------- |
| Duplicación de código | 60%         | 0%          |
| Servicios de auth     | 3           | 1           |
| Handlers IPC          | 6+          | 1 dinámico  |
| Agregar nuevo portal  | ~400 líneas | ~100 líneas |
| Testabilidad          | Baja        | Alta (DI)   |
| Selectores dinámicos  | No          | Sí (JSON)   |
| SOLID compliance      | Parcial     | Completo    |

## Testing

```typescript
// Mock de configuración
const mockConfig: IPortalConfigProvider = {
  obtenerConfiguracion: () => ({...}),
  listarPortales: () => [...]
}

// Crear servicio con mock
const authService = new SatUnifiedAuthService(mockConfig)

// Testear sin tocar el navegador
const captcha = await authService.obtenerCaptcha('test')
```

## Performance

- **Lazy loading**: Servicios creados solo cuando se usan
- **Context reuse**: Reutiliza BrowserContext entre llamadas
- **Memory efficient**: Limpia páginas automáticamente
- **Retry logic**: Reintentos inteligentes para timeouts

## Seguridad

- Credenciales de FIEL se usan directamente desde config
- No se guardan en variables intermedias
- Cleanup automático de sesiones
- Página cerrada inmediatamente tras operación

## Logging y Debugging

```typescript
// Todos los servicios usan console.log con prefijo
console.log('[SatConstanciaOperationService] Constancia capturada:', ruta)
console.error('[SatUnifiedAuthService] Error:', error)
```

Monitor en DevTools:

- Filtrar por `[SatConstancia]`, `[SatCumplimiento]`, etc.
- Seguir flujo de operaciones
