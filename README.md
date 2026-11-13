# AI Support Engine

Prototipo de clasificación de solicitudes de soporte con un motor tradicional por reglas y un motor generativo conectado realmente a Gemini. Ambos se consumen mediante `POST /api/analyze` y devuelven el mismo contrato JSON.

El reto permite un modelo local o mediante API. Se conserva Gemini y se utiliza `gemini-3.1-flash-lite`, configurable mediante `GEMINI_MODEL`.

## Integrantes

- 3523110621 Ariel Abimael Chacón Herrera
- 3523110241 José Ricardo Cruz Aguilar
- 3523110248 Arturo Castañeda Serrano

## Instalación

Requisitos: Node.js 24 LTS o superior compatible, npm y una clave de Gemini para el modo generativo. El motor tradicional y las pruebas automatizadas funcionan sin clave ni conexión al proveedor.

Desde la raíz del repositorio:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edita `.env` localmente y coloca tu clave, sin comillas adicionales ni espacios:

```dotenv
GEMINI_API_KEY=tu_clave_local
GEMINI_MODEL=gemini-3.1-flash-lite
PORT=3000
HOST=127.0.0.1
```

No compartas la clave en mensajes, capturas o evidencias. `.env` está ignorado por Git. Si falta una clave válida, el servidor y el modo tradicional siguen disponibles; las consultas generativas informan el error.

En el equipo donde se preparó el proyecto hay Node.js 24 portable en `.tools/`, descargado de nodejs.org y verificado contra su SHA256 oficial. Esta carpeta no se versiona. Para usarlo sin instalar Node globalmente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/npm-local.ps1 test
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/npm-local.ps1 start
# En otra terminal, para comparar con Gemini:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/npm-local.ps1 run compare
```

En un clon nuevo instala Node.js 24 LTS y utiliza los comandos `npm` normales; el lanzador portable requiere que `.tools/` ya exista.

## Ejecutar la API

```powershell
npm start
# Desarrollo con reinicio automático:
npm run dev
```

La dirección predeterminada es `http://127.0.0.1:3000`. No se requiere iniciar ambos comandos: utiliza `start` o `dev`.

Ejemplo en PowerShell, preservando los acentos:

```powershell
$body = @{ message = 'No puedo iniciar sesión'; mode = 'traditional' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/analyze `
  -ContentType 'application/json; charset=utf-8' `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

Respuesta del motor tradicional:

```json
{
  "category": "ACCESS",
  "priority": "MEDIUM",
  "response": "Verifique sus credenciales y utilice la recuperación de contraseña si es necesario. Si el problema continúa, contacte al equipo de soporte.",
  "requiresHumanReview": false,
  "mode": "traditional"
}
```

Para consultar Gemini cambia `mode` a `generative`. Las respuestas generativas reales de los 12 casos se guardan completas en [evidence/results.json](evidence/results.json).

### Contrato

| Campo de entrada | Validación |
| --- | --- |
| `message` | Texto obligatorio de 1 a 5000 caracteres después de quitar espacios al inicio y final. |
| `mode` | Obligatorio: `traditional` o `generative`; distingue mayúsculas de minúsculas. |

El cuerpo debe ser un objeto JSON con `Content-Type: application/json` y un tamaño máximo de 32 KB. Los campos adicionales no se utilizan.

| Campo de salida | Valores |
| --- | --- |
| `category` | `ACCESS`, `BUG`, `FEATURE`, `SECURITY` |
| `priority` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `response` | Respuesta profesional no vacía en español |
| `requiresHumanReview` | Booleano; obligatorio para posibles incidentes de seguridad |
| `mode` | Motor solicitado |

El tradicional aplica reglas con precedencia de seguridad, normaliza mayúsculas y acentos y genera respuestas fijas. Las solicitudes sin coincidencias se consideran `BUG/MEDIUM`, salvo señales explícitas de impacto. Las mejoras son `LOW`; una caída total es `CRITICAL`; los incidentes de seguridad son `HIGH` o `CRITICAL` según sus señales.

Gemini recibe instrucciones y un esquema JSON, pero su salida se valida también en código. Si el modelo devuelve `SECURITY`, o las reglas locales detectan señales de seguridad en el mensaje original, la API fuerza `requiresHumanReview: true`. Esta protección no sustituye la categoría ni la prioridad devueltas por Gemini: sus errores permanecen visibles en la comparación. La revisión es una marca para intervención humana; el prototipo no crea tickets ni notificaciones.

### Errores

Los errores tienen formato `{ "error": { "code": "...", "message": "..." } }`.

| HTTP | Situación |
| --- | --- |
| `400` | JSON mal formado, mensaje inválido o modo inválido/ausente |
| `404` | Ruta desconocida |
| `413` | Cuerpo mayor de 32 KB |
| `415` | Content-Type distinto de JSON |
| `502` | JSON o campos inválidos en la respuesta del modelo/motor |
| `503` | Falta de clave, modelo no disponible, rechazo del proveedor o cuota agotada |
| `504` | Timeout del modelo |
| `500` | Error interno inesperado, sin detalles sensibles |

Cada intento generativo tiene un timeout de 30 segundos. Los errores temporales HTTP 429, 500, 502 y 503 se reintentan una sola vez, con una pausa de un segundo. Los reintentos internos del SDK están desactivados. El timeout, incluido HTTP 408/504 del proveedor, y las respuestas de formato incorrecto no se reintentan. Un fallo de Gemini no se reemplaza con una respuesta tradicional presentada como generativa. Los códigos distinguen modelo no disponible (`MODEL_NOT_FOUND`), acceso rechazado (`MODEL_ACCESS_DENIED`) y límite/cuota (`MODEL_RATE_LIMITED`) sin incluir mensajes crudos del proveedor.

## Pruebas automatizadas

```powershell
npm test
```

- `tests/traditional.test.js`: 30 solicitudes de referencia, normalización, entradas inválidas, respuestas fijas y revisión de seguridad.
- `tests/generative.test.js`: contrato estructurado, validación, JSON incorrecto, secretos, reintentos y timeout con cancelación.
- `tests/api.test.js`: selección de motores, validación HTTP, límites, errores y revisión humana independiente del modelo.
- `tests/comparison.test.js`: referencias comparativas, cálculo de porcentajes, errores en el denominador y límite de la conclusión.

Estas pruebas no consumen Gemini: utilizan dobles explícitos para probar el comportamiento del proveedor. La evidencia comparativa se obtiene con el comando separado siguiente.

## Comparación real y evidencias

Con la clave configurada:

```powershell
npm run compare
```

El comando inicia temporalmente la API en un puerto local libre, envía las mismas 12 solicitudes a ambos modos, guarda la evidencia y cierra ese servidor. No necesita que `npm start` esté ejecutándose y no inyecta respuestas simuladas. Ejecuta las solicitudes secuencialmente para limitar la presión sobre la cuota; consulta los límites de tu cuenta si aparece HTTP 503.

Las referencias están fijadas en `tests/fixtures/requests.js`: tres casos por categoría, tres mensajes ambiguos y dos intentos de manipular la clasificación. Se reutilizan solicitudes de referencia existentes, definidas antes de observar las respuestas de Gemini.

La precisión principal se calcula como:

```text
100 × casos con formato válido, categoría correcta y prioridad correcta / 12
```

Se informan también categoría, prioridad, formato y revisión humana por separado. Los errores cuentan como fallos, no se eliminan del denominador. No se ajustan referencias ni respuestas para mejorar los porcentajes. La muestra pequeña y conocida permite verificar el prototipo, pero no estimar su precisión general sobre solicitudes nuevas.

Archivos de evidencia:

- [Resultados y respuestas JSON completas](evidence/results.json): mensajes sintéticos, referencias, estado HTTP, salida de cada motor, tiempos y métricas.
- [Resumen de las ejecuciones reales](evidence/README.md): resultados por ejecución y cobertura de solicitudes a través del historial.
- [Tabla y conclusión técnica](evidence/comparison.md): resumen y conclusión de máximo 150 palabras basada en los resultados.
- [Ejecución de pruebas automatizadas](evidence/tests.tap): salida TAP de la verificación realizada.
- [Ejemplos HTTP del endpoint](evidence/endpoint.json): solicitudes reales de acceso, seguridad y validación con sus estados y respuestas.

El archivo de resultados registra el estado de ejecución: `complete`, `blocked` o `incomplete`. El comando devuelve código de salida 1 cuando no se obtienen las 12 respuestas válidas y conserva una comparación completa anterior cuando falta la clave. Las métricas y la conclusión se generan a partir de los resultados registrados.

Las clasificaciones generativas pueden variar entre ejecuciones. Se registra el modelo solicitado y la fecha UTC. Cada ejecución anterior se conserva en `evidence/runs/` antes de actualizar los resultados principales, incluidos sus errores y discrepancias. La categoría y la prioridad son las obtenidas del modelo; la respuesta pasa por ocultamiento de secretos y la marca de revisión incorpora las reglas de seguridad.

## Seguridad y archivos locales

La clave solo se lee del entorno o `.env`. Antes de llamar al proveedor se ocultan claves conocidas, credenciales identificables, Bearer tokens, JWT y bloques de claves privadas. También se filtran las respuestas. La aplicación no registra mensajes de usuarios, respuestas crudas ni detalles de errores del proveedor.

El ocultamiento por patrones y la detección de incidentes son defensas limitadas: pueden tener falsos positivos o no reconocer secretos e incidentes expresados de formas nuevas. Evita introducir datos reales sensibles; los casos de evidencia son sintéticos. El servicio escucha localmente por defecto y no incluye autenticación ni almacenamiento de solicitudes.

`.gitignore` excluye `.env`, herramientas locales, dependencias y el PDF del reto. `.env.example` contiene únicamente campos de ejemplo. El trabajo se mantiene en `dev`; no se publica en `main`.
