// Defensa adicional para secretos identificables; no sustituye evitar incluirlos.
export function redactSecrets(text, knownSecrets = [process.env.GEMINI_API_KEY]) {
  let safe = text;
  for (const secret of knownSecrets) {
    if (typeof secret === 'string' && secret) safe = safe.split(secret).join('[REDACTED]');
  }
  return safe
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b((?:password|passwd|contrase[nñ]a|api[_ -]?key|gemini_api_key|token|secret(?:o)?|clave)\s*(?::|=|\bes\b)\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/\bAIza[A-Za-z0-9_-]{30,}\b/g, '[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]');
}
