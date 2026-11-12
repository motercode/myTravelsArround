# ADR de partida

ADR genéricos para copiar al `ADR.md` de un proyecto nuevo. Renumera, pon la fecha y ajusta lo que
no aplique. Entre paréntesis, el ADR de ConserjeCV del que salen.

```markdown
# ADR

## ADR-0001: Android nativo con Kotlin, Jetpack Compose y Room
- Fecha: AAAA-MM-DD
- Estado: Aceptado

### Contexto
App para un solo tipo de dispositivo, con datos locales estructurados y UI que cambia a menudo.

### Decisión
Kotlin, Jetpack Compose con Material 3 y Room para la persistencia. Un solo módulo y una sola Activity.

### Consecuencias
- Sin dependencia de frameworks multiplataforma.
- El esquema de Room se migra a mano (ver ADR de migraciones).

## ADR-0002: decisiones en issues, PR y este ADR
(ConserjeCV ADR-0006)
- Producto y alcance → issue. Implementación → PR. Arquitectura y proceso → este ADR.
- Las decisiones menores se apuntan en una línea en "Registro de decisiones operativas".

## ADR-0003: control de calidad E2E obligatorio antes de cada PR
(ConserjeCV ADR-0010)
- Cada PR crea o actualiza E2E de su alcance; los existentes no se borran.
- Antes de abrir el PR se ejecuta la suite completa en un dispositivo real con `scripts/e2e.sh` y se
  pega el informe en el PR.
- Nunca `connectedAndroidTest` (desinstala la app y borra sus datos).

## ADR-0004: E2E sobre datos semilla aislados de los datos reales
(ConserjeCV ADR-0025)
- Un runner de tests redirige base de datos, ajustes y log a ficheros `*_test` antes de arrancar la app
  y desactiva las fuentes externas (agenda, etc.).
- Una regla siembra un conjunto fijo de datos ficticios antes de cada test y se niega a actuar sobre
  la base real.
- El script de E2E comprueba con una suma de control que los datos reales no cambian.

## ADR-0005: sin logs en release y R8 activado
(ConserjeCV ADR-0026)
- Todo log pasa por `DebugLog`, que solo escribe en debug.
- R8 activo en release, con `-assumenosideeffects` para `android.util.Log` y `DebugLog`.
- Antes de publicar se comprueba que el dex de release no contiene textos de diagnóstico.

## ADR-0006: Room con migraciones manuales y datos iniciales en el repositorio
(ConserjeCV ADR-0007 y siguientes)
- Cada cambio de esquema sube la versión y añade una `Migration` con su test instrumentado.
- Prohibida la migración destructiva.
- Los datos iniciales se crean desde el repositorio, de forma idempotente y desde un solo punto.

## ADR-0007 (opcional): la app solo funciona en local
(ConserjeCV ADR-0002 y ADR-0022)
- Sin backend ni permiso `INTERNET`; sin copias de seguridad automáticas.
- Los datos que identifican al cliente se configuran en la app, no están en el código.
- Ningún dato real en el repositorio.

## Registro de decisiones operativas
- AAAA-MM-DD: proyecto creado a partir de la plantilla de ConserjeCV.
```
