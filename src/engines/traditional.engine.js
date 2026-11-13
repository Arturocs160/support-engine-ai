'use strict';

const DEFAULT_PRIORITIES = Object.freeze({
  ACCESS: 'MEDIUM',
  BUG: 'MEDIUM',
  FEATURE: 'LOW',
  SECURITY: 'HIGH',
});

const RESPONSES = Object.freeze({
  ACCESS:
    'Verifique sus credenciales y utilice la recuperación de contraseña si es necesario. Si el problema continúa, contacte al equipo de soporte.',
  BUG:
    'Comparta los pasos para reproducir la falla y el mensaje de error con el equipo de soporte, sin incluir información sensible.',
  FEATURE:
    'Gracias por la sugerencia. Describa la funcionalidad y el problema que resolvería para que el equipo pueda evaluarla.',
  SECURITY:
    'Se requiere la revisión del equipo de seguridad. No comparta contraseñas ni información sensible y reporte el incidente por el canal autorizado.',
});

const CRITICAL_SECURITY_PATTERNS = [
  /\b(?:ransomware|hack\w*|exfiltracion|data breach|data leak)\b/,
  /\b(?:filtracion|fuga|robo|filtraron|robaron)\b.{0,40}\b(?:datos|informacion|credenciales|contrasenas)\b/,
  /\b(?:datos|informacion|credenciales|contrasenas?|tokens?|api keys?|cuenta)\b.{0,40}\b(?:expuest\w*|filtrad\w*|filtraron|robad\w*|comprometid\w*|leaked|stolen)\b/,
  /\b(?:vulnerabilidad|incidente)\b.{0,20}\bcritic[oa]\b/,
  /\b(?:explotacion activa|exploit activo|se esta explotando|estan explotando)\b/,
];

// Se evalúan en orden. La seguridad siempre tiene precedencia, incluso si el
// mensaje pide ignorar las reglas o asignar una categoría o prioridad diferente.
const CATEGORY_RULES = [
  {
    category: 'SECURITY',
    patterns: [
      ...CRITICAL_SECURITY_PATTERNS,
      /\b(?:vulnerabil\w*|malware|phishing|exploit\w*|xss|csrf|ataques?|ciberataques?|ddos)\b/,
      /\b(?:incidente|brecha|fallo|falla|error) de seguridad\b/,
      /\b(?:inyeccion sql|sql injection|security incident|fuerza bruta)\b/,
      /\b(?:acceso|actividad|inicio de sesion)\b.{0,40}\b(?:no autorizad[oa]|sospechos[oa]|sin autorizacion|sin permiso)\b/,
      /\b(?:accedio|entro|ingreso)\b.{0,50}\bsin (?:mi )?(?:permiso|autorizacion)\b/,
    ],
  },
  {
    category: 'ACCESS',
    patterns: [
      /\b(?:no puedo|no podemos|no consigo|no me permite|no permite|no logra|imposible|error|fallo|falla|problemas? para)\b.{0,50}\b(?:iniciar sesion|acceder|entrar|ingresar|login|autenticar\w*)\b/,
      /\b(?:cuenta|usuario)\b.{0,30}\b(?:bloquead[oa]|deshabilitad[oa])\b/,
      /\b(?:credenciales|contrasena|password)\b.{0,25}\b(?:invalid\w*|incorrect\w*|olvidad\w*)\b/,
      /\b(?:olvide|recuperar|restablecer)\b.{0,30}\b(?:contrasena|password)\b/,
      /\b(?:acceso denegado|sin permisos|invalid credentials|access denied|cannot log in|can't log in)\b/,
    ],
  },
  {
    category: 'FEATURE',
    patterns: [
      /\b(?:quiero|quisiera|necesito|solicito|podrian|pueden|me gustaria|seria util)\b.{0,60}\b(?:agregar|agreguen|agregaran|anadir|anadan|incorporar|implementar|integrar|incluir|incluyan|permitir|habilitar)\b/,
      /\b(?:me gustaria|quisiera|seria util)\b.{0,40}\b(?:exportar|filtrar|personalizar|automatizar)\b/,
      /\b(?:agregar|anadir|incorporar|implementar|integrar|incluir)\b.{0,40}\b(?:funcionalidad|funcion|opcion|boton|filtro|integracion|inicio de sesion|login|modo oscuro)\b/,
      /\b(?:feature request|please add|would like to add)\b/,
    ],
  },
  {
    category: 'BUG',
    patterns: [
      /\b(?:error\w*|fallo\w*|falla\w*|bug\w*|defecto\w*|crash\w*|lentitud)\b/,
      /\b(?:no funciona|no carga|no responde|se cierra|se congela|pantalla en blanco|fuera de servicio)\b/,
      /\b(?:caid[oa]|perdida de datos|datos perdidos|perdieron datos|dejo de funcionar)\b/,
    ],
  },
  {
    category: 'ACCESS',
    patterns: [
      /\b(?:login|iniciar sesion|inicio de sesion|contrasena|password|credenciales|autenticacion|permisos)\b/,
    ],
  },
  {
    category: 'FEATURE',
    patterns: [/\b(?:nueva funcionalidad|nueva funcion|mejora|sugerencia|feature|modo oscuro|dark mode)\b/],
  },
];

const CRITICAL_BUG_PATTERNS = [
  /\b(?:caida|interrupcion|falla|fallo)\s+(?:total|generalizada|masiva)\b/,
  /\b(?:todo el sistema|sistema completo|servicio completo|plataforma completa)\b.{0,50}\b(?:caid[oa]|inaccesible|no funciona|no responde|fuera de servicio)\b/,
  /\b(?:produccion|production)\b.{0,40}\b(?:caid[oa]|down|fuera de servicio)\b/,
];

const HIGH_IMPACT_PATTERNS = [
  /\b(?:urgente|urgent|bloqueante)\b/,
  /\b(?:todos los usuarios|todas las cuentas|nadie|todo el equipo)\b/,
  /\b(?:no funciona|no carga|no responde|se cierra|se congela|caid[oa]|fuera de servicio)\b/,
  /\b(?:perdida de datos|datos perdidos|perdieron datos)\b/,
];

function matchesAny(message, patterns) {
  return patterns.some((pattern) => pattern.test(message));
}

function determinePriority(category, message) {
  if (category === 'SECURITY') {
    return matchesAny(message, CRITICAL_SECURITY_PATTERNS) ? 'CRITICAL' : 'HIGH';
  }

  // Las sugerencias conservan prioridad baja; la urgencia se aplica a fallas
  // y problemas de acceso. Una caída total del servicio se considera crítica.
  if (category === 'FEATURE') {
    return DEFAULT_PRIORITIES.FEATURE;
  }

  if (category === 'BUG' && matchesAny(message, CRITICAL_BUG_PATTERNS)) {
    return 'CRITICAL';
  }

  return matchesAny(message, HIGH_IMPACT_PATTERNS)
    ? 'HIGH'
    : DEFAULT_PRIORITIES[category];
}

/**
 * Clasifica una solicitud mediante reglas locales, sin servicios externos.
 * Los mensajes sin coincidencias se consideran BUG y reciben prioridad según
 * las señales de impacto; sin ellas, la prioridad predeterminada es MEDIUM.
 * La revisión humana señala posibles incidentes; no confirma su existencia.
 *
 * @param {string} message Texto de la solicitud de soporte.
 * @returns {{category: string, priority: string, response: string,
 *   requiresHumanReview: boolean, mode: string}}
 * @throws {TypeError} Si message no es una cadena.
 * @throws {RangeError} Si message está vacío o solo contiene espacios.
 *
 * @example
 * import traditionalEngine from './traditional.engine.js';
 * traditionalEngine('No puedo iniciar sesión');
 */
function traditionalEngine(message) {
  if (typeof message !== 'string') {
    throw new TypeError('El mensaje debe ser una cadena de texto.');
  }

  const normalizedMessage = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedMessage) {
    throw new RangeError('El mensaje no puede estar vacío.');
  }

  const rule = CATEGORY_RULES.find(({ patterns }) =>
    matchesAny(normalizedMessage, patterns),
  );
  const category = rule ? rule.category : 'BUG';

  return {
    category,
    priority: determinePriority(category, normalizedMessage),
    response: RESPONSES[category],
    requiresHumanReview: category === 'SECURITY',
    mode: 'traditional',
  };
}

export default traditionalEngine;
