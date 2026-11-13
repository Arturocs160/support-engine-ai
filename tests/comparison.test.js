import assert from 'node:assert/strict';
import test from 'node:test';
import traditionalEngine from '../src/engines/traditional.engine.js';
import { REQUESTS } from './fixtures/requests.js';
import { evaluateOutcome, summarize, conclusionFor } from '../scripts/lib/comparison.js';

test('la comparación tiene 12 referencias, cuatro categorías, ambigüedad y dos ataques', () => {
  assert.equal(REQUESTS.length, 12);
  assert.equal(new Set(REQUESTS.map((r) => r.id)).size, 12);
  assert.equal(new Set(REQUESTS.map((r) => r.category)).size, 4);
  assert.ok(REQUESTS.some((r) => r.kind === 'ambiguous'));
  assert.ok(REQUESTS.filter((r) => r.kind === 'adversarial').length >= 2);
});

test('el tradicional satisface las 12 referencias fijadas para comparar', () => {
  const outcomes = REQUESTS.map((reference) => ({
    evaluation: evaluateOutcome(reference, { httpStatus: 200, body: traditionalEngine(reference.message) }, 'traditional'),
  }));
  const summary = summarize(outcomes);
  assert.equal(summary.correctClassifications, 12);
  assert.equal(summary.accuracyPercent, 100);
  assert.equal(summary.humanReviewCompliancePercent, 100);
});

test('categoría, prioridad, formato y revisión se evalúan por separado', () => {
  const reference = REQUESTS.at(-1);
  const body = { category: 'SECURITY', priority: 'LOW', response: 'Revise el incidente.', requiresHumanReview: false, mode: 'generative' };
  const evaluation = evaluateOutcome(reference, { httpStatus: 200, body }, 'generative');
  assert.equal(evaluation.formatValid, true);
  assert.equal(evaluation.categoryCorrect, true);
  assert.equal(evaluation.priorityCorrect, false);
  assert.equal(evaluation.classificationCorrect, false);
  assert.equal(evaluation.humanReviewCorrect, false);
  assert.equal(evaluateOutcome(reference, { httpStatus: 200, body: { ...body, mode: 'traditional' } }, 'generative').formatValid, false);
});

test('los errores no se eliminan del denominador ni cuentan como aciertos', () => {
  const reference = REQUESTS[0];
  const success = { httpStatus: 200, body: traditionalEngine(reference.message) };
  const failure = { httpStatus: 503, body: { error: { code: 'MODEL_UNAVAILABLE' } } };
  const invalid = { httpStatus: 200, body: { ...success.body, extra: true } };
  const outcomes = [success, failure, invalid].map((outcome) => ({ evaluation: evaluateOutcome(reference, outcome, 'traditional') }));
  const summary = summarize(outcomes);
  assert.equal(summary.total, 3);
  assert.equal(summary.correctClassifications, 1);
  assert.equal(summary.failedResponses, 2);
  assert.equal(summary.accuracyPercent, 33.33);
});

test('la conclusión respeta 150 palabras y refleja los resultados de referencia', () => {
  const blocked = conclusionFor({ status: 'blocked' });
  assert.ok(blocked.includes('datos suficientes'));
  const complete = conclusionFor({ status: 'complete', summary: { traditional: { accuracyPercent: 100 }, generative: { accuracyPercent: 75 } } });
  assert.ok(complete.includes('tradicional'));
  const incomplete = conclusionFor({
    status: 'incomplete', generativeResponsesReceived: 9,
    summary: { traditional: { accuracyPercent: 100 }, generative: { accuracyPercent: 58.33, failedResponses: 3 } },
    results: [{ generative: { evaluation: { formatValid: false, categoryCorrect: false, priorityCorrect: false } } }],
  });
  assert.ok(incomplete.includes('58.33%'));
  assert.ok(incomplete.includes('0 discrepancias de categoría'));
  assert.ok(!incomplete.includes('solicitudes fallidas'));
  for (const text of [blocked, complete, incomplete]) assert.ok(text.trim().split(/\s+/).length <= 150);
});
