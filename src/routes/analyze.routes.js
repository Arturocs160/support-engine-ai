import { Router } from 'express';
import traditionalEngine from '../engines/traditional.engine.js';
import { analyzeWithGemini } from '../engines/generative.engine.js';
import { hasValidAnalysisFields } from '../contracts/analysis.contract.js';
import { validateAnalyzeRequest } from '../validators/request.validator.js';
import { redactSecrets } from '../security/secrets.js';
import { AppError } from '../errors/app.error.js';

export function createAnalyzeRouter({ traditional = traditionalEngine, generative = analyzeWithGemini } = {}) {
  const router = Router();
  router.post('/', async (req, res) => {
    if (!req.is('application/json')) {
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Utiliza Content-Type: application/json.');
    }
    const { message, mode } = validateAnalyzeRequest(req.body);
    const result = await (mode === 'traditional' ? traditional(message) : generative(message));
    if (!hasValidAnalysisFields(result)) {
      throw new AppError(502, 'INVALID_ENGINE_RESPONSE', 'El motor no devolvió una clasificación válida.');
    }
    // La protección no depende de que el modelo siga sus instrucciones.
    // No cambia categoría ni prioridad: las discrepancias siguen siendo medibles.
    const securitySignal = traditionalEngine(message).requiresHumanReview;
    res.json({
      category: result.category,
      priority: result.priority,
      response: redactSecrets(result.response.trim()),
      requiresHumanReview: result.category === 'SECURITY' || securitySignal || result.requiresHumanReview,
      mode,
    });
  });
  return router;
}
