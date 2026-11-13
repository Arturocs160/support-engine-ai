
import { analyzeWithGemini } from "./src/engines/generative.engine.js";

const message = "No puedo iniciar sesión en mi cuenta";

try {
  const result = await analyzeWithGemini(message);

  console.log("RESULTADO DE GEMINI:");
  console.log(JSON.stringify(result, null, 2));

} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
