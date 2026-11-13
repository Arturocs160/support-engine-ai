import { MODES } from '../contracts/analysis.contract.js';
import { AppError } from '../errors/app.error.js';

export function validateAnalyzeRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'INVALID_REQUEST', 'El cuerpo debe ser un objeto JSON.');
  }
  if (typeof body.message !== 'string' || !body.message.trim()
      || body.message.trim().length > 5000) {
    throw new AppError(400, 'INVALID_MESSAGE', 'message debe contener entre 1 y 5000 caracteres.');
  }
  if (!MODES.includes(body.mode)) {
    throw new AppError(400, 'INVALID_MODE', 'mode debe ser traditional o generative.');
  }
  return { message: body.message.trim(), mode: body.mode };
}
