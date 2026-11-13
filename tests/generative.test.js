import assert from 'node:assert/strict';
import test from 'node:test';
import { createGenerativeEngine } from '../src/engines/generative.engine.js';
import { hasValidAnalysis } from '../src/contracts/analysis.contract.js';
import { redactSecrets } from '../src/security/secrets.js';

const API_KEY = 'CLAVE_SINTETICA_SOLO_PARA_PRUEBAS';
const valid = { category: 'ACCESS', priority: 'MEDIUM', response: 'Utilice la recuperación de contraseña.', requiresHumanReview: false };
const engineFor = (data, options = {}) => createGenerativeEngine({
  apiKey: API_KEY, generate: async () => ({ text: JSON.stringify(data) }), ...options,
});

test('solicita JSON estructurado, oculta secretos y devuelve el contrato común', async () => {
  let captured;
  const engine = createGenerativeEngine({ apiKey: API_KEY, model: 'modelo-de-prueba', generate: async (request) => {
    captured = request;
    return { text: JSON.stringify({ ...valid, response: `No comparta password=SECRETO ni ${API_KEY}`, extra: 'ignorado' }) };
  } });
  const result = await engine(`No puedo entrar. password=SECRETO token="DOS PALABRAS" Bearer abc.def.ghi ${API_KEY}`);
  assert.equal(captured.model, 'modelo-de-prueba');
  assert.equal(captured.config.responseMimeType, 'application/json');
  assert.equal(captured.config.httpOptions.retryOptions.attempts, 1);
  assert.equal(captured.config.responseSchema.required.length, 4);
  assert.ok(captured.config.systemInstruction.includes('no confiable'));
  for (const secret of ['SECRETO', 'DOS PALABRAS', 'abc.def.ghi', API_KEY]) {
    assert.ok(!captured.contents.includes(secret));
    assert.ok(!result.response.includes(secret));
  }
  assert.ok(hasValidAnalysis(result));
  assert.equal(result.mode, 'generative');
  assert.equal(result.category, 'ACCESS');
  assert.equal(Object.keys(result).length, 5);
});

test('valida entradas antes de consultar el proveedor', async () => {
  let calls = 0;
  const engine = createGenerativeEngine({ apiKey: API_KEY, generate: async () => { calls++; } });
  for (const value of [null, 7, {}, [], '', '   ', 'x'.repeat(5001)]) {
    await assert.rejects(engine(value), { status: 400, code: 'INVALID_MESSAGE' });
  }
  assert.equal(calls, 0);
});

test('la ausencia de clave se informa al usar el motor, sin consultar el proveedor', async () => {
  let calls = 0;
  const engine = createGenerativeEngine({ apiKey: '', generate: async () => { calls++; } });
  await assert.rejects(engine('No puedo entrar'), { status: 503, code: 'MODEL_NOT_CONFIGURED' });
  assert.equal(calls, 0);
});

test('rechaza JSON inválido, nulos y campos ausentes o incorrectos', async (t) => {
  const invalidValues = [
    null, [], {}, { ...valid, category: 'OTHER' }, { ...valid, priority: 'URGENT' },
    { ...valid, response: '' }, { ...valid, response: '   ' }, { ...valid, response: 10 },
    { ...valid, requiresHumanReview: 'false' }, { ...valid, requiresHumanReview: undefined },
  ];
  for (const [index, value] of invalidValues.entries()) {
    await t.test(`respuesta inválida ${index + 1}`, async () => {
      await assert.rejects(engineFor(value)('Solicitud'), { status: 502, code: 'INVALID_MODEL_RESPONSE' });
    });
  }
  for (const text of ['no es JSON', '```json\n{}\n```', undefined]) {
    await assert.rejects(engineFor(valid, { generate: async () => ({ text }) })('Solicitud'), { status: 502 });
  }
});

test('SECURITY obliga revisión humana aunque el modelo indique false', async () => {
  const result = await engineFor({ ...valid, category: 'SECURITY', priority: 'HIGH' })('Detecté phishing');
  assert.equal(result.requiresHumanReview, true);
});

test('reintenta una sola vez errores temporales y no filtra su mensaje', async () => {
  let calls = 0;
  const engine = engineFor(valid, { retryDelayMs: 0, generate: async () => {
    calls++;
    if (calls === 1) throw Object.assign(new Error(API_KEY), { status: 429 });
    return { text: JSON.stringify(valid) };
  } });
  assert.equal((await engine('No puedo entrar')).category, 'ACCESS');
  assert.equal(calls, 2);

  calls = 0;
  const unavailable = engineFor(valid, { retryDelayMs: 0, generate: async () => {
    calls++;
    throw Object.assign(new Error(API_KEY), { status: 503 });
  } });
  await assert.rejects(unavailable('Solicitud'), (error) => {
    assert.equal(error.status, 503);
    assert.ok(!error.message.includes(API_KEY));
    return true;
  });
  assert.equal(calls, 2);
});

test('no reintenta errores permanentes de autenticación', async () => {
  let calls = 0;
  const engine = engineFor(valid, { generate: async () => {
    calls++;
    throw Object.assign(new Error(API_KEY), { status: 403 });
  } });
  await assert.rejects(engine('Solicitud'), { status: 503, code: 'MODEL_ACCESS_DENIED' });
  assert.equal(calls, 1);
});

test('el timeout devuelve 504 y aborta la llamada pendiente', async () => {
  let signal;
  let calls = 0;
  const engine = engineFor(valid, { timeoutMs: 15, generate: async (request) => {
    calls++;
    signal = request.config.abortSignal;
    return new Promise(() => {});
  } });
  await assert.rejects(engine('Solicitud'), { status: 504, code: 'MODEL_TIMEOUT' });
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
});

test('distingue timeout del proveedor, modelo inexistente y cuota sin exponer detalles', async () => {
  for (const [status, expectedStatus, code, attempts] of [
    [504, 504, 'MODEL_TIMEOUT', 1], [408, 504, 'MODEL_TIMEOUT', 1],
    [404, 503, 'MODEL_NOT_FOUND', 1], [429, 503, 'MODEL_RATE_LIMITED', 2],
  ]) {
    let calls = 0;
    const engine = engineFor(valid, { retryDelayMs: 0, generate: async () => {
      calls++;
      throw Object.assign(new Error(API_KEY), { status });
    } });
    await assert.rejects(engine('Solicitud'), { status: expectedStatus, code });
    assert.equal(calls, attempts);
  }
});

test('oculta claves privadas, tokens JWT y credenciales identificables', () => {
  const message = 'password="secreto con espacios" api_key=secreto2 Bearer abc123 '
    + 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.firma '
    + '-----BEGIN PRIVATE KEY-----\nDATOS_PRIVADOS\n-----END PRIVATE KEY-----';
  const safe = redactSecrets(message, []);
  for (const value of ['secreto con espacios', 'secreto2', 'abc123', 'eyJhbGci', 'DATOS_PRIVADOS']) {
    assert.ok(!safe.includes(value));
  }
  assert.equal(redactSecrets('No puedo iniciar sesión; olvidé mi contraseña.', []), 'No puedo iniciar sesión; olvidé mi contraseña.');
});
