import { CATEGORIES } from '../contracts/analysis.contract.js';
import { AppError } from '../errors/app.error.js';
import { redactSecrets } from '../security/secrets.js';
import { buildRuleBasedAnalysis } from './traditional.engine.js';

export function createMLEngine({
  port = process.env.ML_PORT || '8001',
  timeoutMs = 5000,
  fetchImpl = fetch,
} = {}) {
  const modelPort = Number(port);
  return async function analyzeWithML(message) {
    if (!Number.isInteger(modelPort) || modelPort < 1 || modelPort > 65535) {
      throw new AppError(503, 'ML_UNAVAILABLE', 'Configura ML_PORT con un puerto válido para el motor ML.');
    }

    const signal = AbortSignal.timeout(timeoutMs);
    let prediction;
    try {
      const response = await fetchImpl(`http://127.0.0.1:${modelPort}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: redactSecrets(message) }),
        redirect: 'manual',
        signal,
      });
      if (!response.ok) {
        if (response.body) await response.body.cancel();
        throw new AppError(502, 'INVALID_ML_RESPONSE', 'El servicio ML no pudo devolver una clasificación.');
      }
      prediction = await response.json();
    } catch (error) {
      if (signal.aborted) {
        throw new AppError(504, 'ML_TIMEOUT', 'El motor ML excedió el tiempo de espera.');
      }
      if (error instanceof AppError) throw error;
      if (error instanceof SyntaxError) {
        throw new AppError(502, 'INVALID_ML_RESPONSE', 'El servicio ML no devolvió un JSON válido.');
      }
      throw new AppError(503, 'ML_UNAVAILABLE', 'El motor ML no está disponible. Verifica el servicio de Python.');
    }

    if (!CATEGORIES.includes(prediction?.category)) {
      throw new AppError(502, 'INVALID_ML_RESPONSE', 'El servicio ML devolvió una categoría inválida.');
    }
    return buildRuleBasedAnalysis(prediction.category, message);
  };
}
