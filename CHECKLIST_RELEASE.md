# Checklist — IFRAT Desktop listo para release

Estado al: **04 Oct 2026**. Objetivo: dejar el Desktop (my-sat-app) liberable y verificado contra
el backend Emite. Marcas: `[x]` hecho/verificado · `[ ]` pendiente · `(de ellos)` = responsabilidad
del backend/UI de Emite, no del Desktop.

---

## Fase 0 — Bloqueadores del backend Emite (de ellos, imprescindibles)

- [ ] **Desplegar `/api` en `ifrat.ar-sa.com.mx`** — hoy el dominio no sirve la API:
      `https://.../api/licencia/resumen` da error de certificado SSL y la SPA devuelve 405 en POST.
      Es el único bloqueador real del release.
- [ ] Verificar en producción (curl/Postman con credencial real):
      `POST /api/auth/login` → 200 `{succeeded,data{token,refreshToken}}`
      `POST /api/vinculacion/maquina` → 200 `{data{yaExistia}}` (idempotente)
      `GET /api/licencia/resumen` → 200 `{data{usoIlimitado,contadores[{modulo,rfc,usos,limite,restantes}]}}`
- [ ] **Configurar SMTP (`Correo:Smtp:Host`)** en producción — sin esto el correo de verificación
      no llega y ningún usuario nuevo puede loguear (la cuenta nace `PendienteVerificacion`).
- [ ] (opcional) `/uso/validar` + `/uso/consumir` — hoy NO existen; los contadores del servidor
      nunca bajan. No bloquea (el unlock por `usoIlimitado` funciona), solo lo alinea con el
      decremento local del Desktop.
- [ ] (opcional) CORS en `Program.cs` — afecta solo a la web (el Desktop usa Node/Electron, no
      navegador). Sin CORS la web no consume la API.
- [ ] (cosmético) llenar `Nombre` en `LoginResultDto` — hoy viene vacío (solo Token/RefreshToken/Email).
- [ ] (web, de ellos) quitar `USE_MOCK_BACKEND=true` y apuntar `API_BASE_URL` a la API desplegada;
      la página `/vincular` con device-code está obsoleta.

## Fase 1 — Código Desktop (mi parte) — casi todo verificado

- [x] `npm run typecheck` OK (node + web).
- [x] `npm run build` exit 0 (solo warnings pre-existentes de imports dinámicos).
- [x] ESLint 0 errores nuevos / archivos nuevos con Prettier aplicado.
- [x] Login directo (email/password) — mismo credencial que la web.
- [x] Auto-vinculación de máquina tras cada acceso (idempotente, `yaExistia`).
- [x] Silent login con refreshToken (24 h) — 401 real → evento `sesion-token-rechazado` → LoginPage.
- [x] Resumen de licencia con `usoIlimitado` + `contadores` → límites por módulo (LimiteUsoService).
- [x] Sin sesión → todos los módulos bloqueados (SesionGate).
- [x] Límites demo locales: Descargar/Importar/Conciliación/Pendientes 3 c/u; Cumplimiento 1;
      Constancia 1 (local, no existe en backend).
- [x] Consumo de uso solo cuando la operación produce `rutaArchivo`; Radar 69-B sin límite.
- [x] Hint en LoginPage cuando el backend rechaza credenciales (incluye email sin verificar).
- [x] **Contrato E2E validado en vivo** contra backend LOCAL: registro → verificar-email → login →
      vincular (×2, idempotente) → resumen (5 contadores 3/3/3/3/1) → refresh rotado → logout. ✔

## Fase 2 — Empaquetado / release (mi parte) — HAY PENDIENTES REALES

- [x] **Resolver conflicto de config** — se eliminó `electron-builder.yml`; `package.json > build`
      quedó como fuente única de verdad (`appId com.ifrat.app`, `productName IFRAT`,
      publish GitHub `Fco-Arteaga-portafolio/ifrat-releases`, output `infrat-releases`).
      Verificado con `electron-builder --dir`: `loaded configuration file=package.json`.
- [x] **Publish URL del auto-updater** — al quedar `package.json > build.publish` (provider github)
      como única fuente, el updater ya apunta al release real de GitHub (ya no a `https://example.com/...`).
- [x] Definir `directories.output` y `artifactName` de release — output `infrat-releases`
      (en `package.json`); artifactName NSIS por defecto (`IFRAT Setup <version>.exe`).
- [ ] Verificar empaquetado: `npm run build:win` (NSIS) → instalar en máquina limpia.
      (Validado el paso previo: `build:unpack` OK — salida `infrat-releases/win-unpacked/IFRAT.exe`
      con `better-sqlite3` reconstruido para Electron 39.)
- [ ] Verificar `better-sqlite3` (nativa) empaquetada y reconstruida (`electron-builder install-app-deps`);
      revisar que `npmRebuild: false` del yml no rompa el module nativo.
- [ ] Verificar que el número de versión visible en el Desktop salga de `package.json` (hoy 1.3.0),
      no hardcodeado.
- [ ] Probar actualización: publicar release en GitHub (releases repo), abrir Desktop anterior →
      detecta versión → descarga → instala.

## Fase 3 — Prueba de aceptación final (contra PRODUCCIÓN, cuando /api esté arriba)

La prueba E2E local ya validó el contrato. Repetir contra producción con una cuenta REAL:
- [ ] Registrar usuario nuevo en la web → llegar el correo (SMTP) → verificar email.
- [ ] Primera apertura del Desktop → login → queda conectado (sesión persistida).
- [ ] Confirmar en Configuración → "Cuenta de IFRAT": sesión iniciada; cerrar sesión funciona.
- [ ] Límites demo visibles y aplicados: 3/3/3/3/1 (Descarga/Importar/Conciliación/Pendientes/Cumplimiento).
- [ ] Al agotar un límite → bloqueo del módulo con mensaje (no crash).
- [ ] **Compra en Emite (MercadoPago, cuando exista)** → `GET /licencia/resumen` devuelve
      `usoIlimitado: true` → módulos liberados sin reinicio de credencial.
- [ ] Comprar 2ª máquina / 2º RFC en Emite → vinculación/uso por RFC nuevos.
- [ ] Reiniciar la máquina → silent login conserva la sesión (offline OK).
- [ ] Revocar/expirar token → vuelve a LoginPage (evento `sesion-token-rechazado`).
- [ ] Instalación limpia en otra máquina (NSIS) → arranque, login y vinculación automática.

## Fase 4 — Regresión rápida de módulos (post-release)

- [ ] Descarga por rango/fecha y por folio (SAT), con captcha.
- [ ] Importación de XML; Conciliación (descarga faltantes incluida); Pendientes/reintentos.
- [ ] Cumplimiento (constancia CSF) y Radar 69-B (sin límite).
- [ ] Exportación a Excel; generación de PDF; reportes mensuales.
- [ ] Auditoría local (LicenseRepository) registra operaciones sin errores.

## Deuda conocida (no bloqueante)

- Contadores de uso del SERVIDOR no bajan hasta que exista `/uso/consumir`; mientras, el Desktop
  lleva el consumo local (`LimiteUsoService`) y el resumen se re-sincroniza en cada acceso.
- Constancia CSF no existe en el backend: su contador (1) es 100% local.
- `Nombre` del login vacío en backend (cosmético; el Desktop no lo muestra).