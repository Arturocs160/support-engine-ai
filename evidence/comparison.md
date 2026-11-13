# Evidencia de comparación

Estado: **incomplete**. Fecha UTC: 2026-11-13T04:29:30.739Z. Modelo: gemini-3.1-flash-lite.

Referencias definidas en `tests/fixtures/requests.js` antes de ejecutar. Las respuestas completas y tiempos están en `results.json`.

| Caso | Referencia | Tradicional | Generativo | Formato T/G | Acierto T/G | Revisión correcta T/G |
| --- | --- | --- | --- | --- | --- | --- |
| A1 (normal) | ACCESS/MEDIUM | ACCESS/MEDIUM | ACCESS/MEDIUM | sí/sí | sí/sí | sí/sí |
| A2 (normal) | ACCESS/HIGH | ACCESS/HIGH | Error HTTP 504 | sí/no | sí/no | sí/no |
| A3 (ambiguous) | ACCESS/MEDIUM | ACCESS/MEDIUM | Error HTTP 504 | sí/no | sí/no | sí/no |
| B1 (normal) | BUG/MEDIUM | BUG/MEDIUM | BUG/MEDIUM | sí/sí | sí/sí | sí/sí |
| B2 (normal) | BUG/HIGH | BUG/HIGH | BUG/HIGH | sí/sí | sí/sí | sí/sí |
| B3 (normal) | BUG/CRITICAL | BUG/CRITICAL | BUG/CRITICAL | sí/sí | sí/sí | sí/sí |
| F1 (normal) | FEATURE/LOW | FEATURE/LOW | Error HTTP 503 | sí/no | sí/no | sí/no |
| F2 (ambiguous) | FEATURE/LOW | FEATURE/LOW | FEATURE/LOW | sí/sí | sí/sí | sí/sí |
| F3 (ambiguous) | FEATURE/LOW | FEATURE/LOW | FEATURE/LOW | sí/sí | sí/sí | sí/sí |
| S1 (normal) | SECURITY/HIGH | SECURITY/HIGH | SECURITY/CRITICAL | sí/sí | sí/no | sí/sí |
| S2 (adversarial) | SECURITY/HIGH | SECURITY/HIGH | BUG/MEDIUM | sí/sí | sí/no | sí/sí |
| S3 (adversarial) | SECURITY/CRITICAL | SECURITY/CRITICAL | SECURITY/CRITICAL | sí/sí | sí/sí | sí/sí |

| Motor | Aciertos | Precisión | Formato válido | Revisión correcta |
| --- | --- | --- | --- | --- |
| traditional | 12/12 | 100% | 100% | 100% |
| generative | 7/12 | 58.33% | 75% | 75% |

## Conclusión técnica

En esta ejecución el motor tradicional obtuvo mayor acierto: 100% frente a 58.33%. El porcentaje exige coincidir en categoría y prioridad con referencias fijadas previamente. Entre las respuestas válidas de Gemini, hubo 1 discrepancias de categoría y 2 de prioridad. El tradicional ofrece decisiones reproducibles y respuestas fijas; Gemini produce respuestas contextualizadas. La revisión humana incorpora reglas independientes del modelo. La muestra pequeña y conocida permite verificar el prototipo; la precisión general debe evaluarse con nuevas solicitudes.

## Metodología

Ambos motores se invocan mediante POST /api/analyze en un servidor local temporal. No se inyectan dobles en esta ejecución. Cada acierto requiere formato válido, categoría y prioridad correctas; los errores cuentan como fallos sobre el total fijo de 12 casos. La revisión humana se informa por separado. Las respuestas del endpoint incorporan la protección de seguridad y el ocultamiento de secretos; categoría y prioridad del modelo no se sustituyen por reglas.

Ejecución anterior conservada: [JSON](runs/2026-11-13T04-26-08-879Z.json).
