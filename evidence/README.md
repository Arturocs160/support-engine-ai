# Ejecuciones reales de Gemini

| Fecha UTC | Modelo | Estado | Respuestas válidas | Acierto tradicional | Acierto generativo | JSON completo |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-13T04:26:08.879Z | gemini-3.1-flash-lite | incomplete | 11/12 | 100% | 75% | [JSON](runs/2026-11-13T04-26-08-879Z.json) |
| 2026-11-13T04:29:30.739Z | gemini-3.1-flash-lite | incomplete | 9/12 | 100% | 58.33% | [JSON](results.json) |

Se registraron 20 respuestas generativas válidas que cubren 12 solicitudes distintas en 2 ejecuciones. Cada porcentaje se calcula por ejecución, con un denominador fijo de 12 y los errores incluidos.

Las marcas de revisión humana incorporan la protección de la API. Los resultados de distintas ejecuciones se muestran por separado.

## Conclusión de la última ejecución

En esta ejecución el motor tradicional obtuvo mayor acierto: 100% frente a 58.33%. El porcentaje exige coincidir en categoría y prioridad con referencias fijadas previamente. Entre las respuestas válidas de Gemini, hubo 1 discrepancias de categoría y 2 de prioridad. El tradicional ofrece decisiones reproducibles y respuestas fijas; Gemini produce respuestas contextualizadas. La revisión humana incorpora reglas independientes del modelo. La muestra pequeña y conocida permite verificar el prototipo; la precisión general debe evaluarse con nuevas solicitudes.
