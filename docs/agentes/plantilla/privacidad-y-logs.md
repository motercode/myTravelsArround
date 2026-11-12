# Privacidad y logs

Para apps que guardan datos personales reales en el móvil. El repositorio puede acabar siendo
público: **cualquier dato real que entre en git es una fuga**, aunque se borre después (queda en la
historia).

## Lo que nunca entra en git

- Ficheros de datos del cliente (exports de contactos, hojas de cálculo, bases de datos).
- Fotos, vídeos y audios de casos reales.
- **Logs del móvil del usuario**: suelen llevar nombres, direcciones y texto leído.
- Configuración que identifica al cliente (nombre, direcciones): va a los ajustes de la app.
- Capturas de pantalla con datos reales.

Patrones de `.gitignore` de partida:
```gitignore
# Datos reales: nunca en el repositorio
*.vcf
*.xlsx
*.xls
*.ods
*.mp4
*.mov
docs/datos-reales/
docs/logs*/
/logs/
```
Revisa `git status` antes de cada commit; ignora carpetas enteras, no ficheros sueltos.

## Datos ficticios

- Un conjunto pequeño y reconocible ("Ana Ficticia", "Calle Ficticia", teléfonos `+346000000NN`)
  usado igual en tests, capturas y docs.
- Generadores sintéticos en `app/src/sharedTest` para formatos de fichero (p. ej. un `.xlsx` creado
  en el test en vez de uno real).

## Log solo en debug

Un único objeto `DebugLog` con `d/w/e(tag, mensaje)`:
- Escribe solo si `BuildConfig.DEBUG` (necesita `buildFeatures { buildConfig = true }`).
- En debug también guarda en `files/logs/<app>-debug.log` (rotación por tamaño, p. ej. 2 MB) para
  revisar pruebas hechas sin el móvil conectado; un botón en Ajustes lo comparte con un
  `FileProvider` declarado **solo en el manifiesto de debug** (`src/debug/AndroidManifest.xml`).
- `DebugLog.init(context)` instala un `UncaughtExceptionHandler` que escribe la traza del cierre en el
  log antes de pasar al manejador anterior.
- Nunca `android.util.Log` ni `println` directos con datos.

Implementación de referencia: `DebugLog.kt` de ConserjeCV.

## R8 en release

`isMinifyEnabled = true` y en `proguard-rules.pro`:
```proguard
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...); public static int d(...); public static int i(...);
    public static int w(...); public static int e(...); public static int wtf(...);
}
-assumenosideeffects class <paquete>.DebugLog {
    public void d(...); public void w(...); public void e(...);
}
```
Así en release ni siquiera se construyen los mensajes.

Comprobación antes de publicar:
```bash
./gradlew assembleRelease
unzip -p app/build/outputs/apk/release/app-release*.apk 'classes*.dex' | strings | grep -c "<texto de un log>"   # 0
adb logcat -s <Etiqueta>    # con el APK de release instalado: nada
```

## En la app

- Guarda lo mínimo. Para métricas de uso, solo metadatos (tiempos, contadores), nunca contenido.
- Si necesitas recordar una decisión sobre un dato personal sin guardarlo, guarda una huella
  (SHA-256 con una sal aleatoria propia de la instalación).
- Borra los datos intermedios cuando ya no sirven.

## Agentes de IA con datos reales

Un agente puede leer en local los datos reales que le pase el usuario para entender el uso, pero:
- No copia nombres, teléfonos ni direcciones reales a código, tests, docs, issues, PR ni commits.
- En los ejemplos los sustituye por datos ficticios.
- No los envía a servicios externos.
