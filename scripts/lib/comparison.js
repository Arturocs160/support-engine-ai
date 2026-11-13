import { hasValidAnalysis } from '../../src/contracts/analysis.contract.js';

export function evaluateOutcome(reference, outcome, mode) {
  const formatValid = outcome.httpStatus === 200 && hasValidAnalysis(outcome.body)
    && outcome.body.mode === mode;
  return {
    formatValid,
    categoryCorrect: formatValid && outcome.body.category === reference.category,
    priorityCorrect: formatValid && outcome.body.priority === reference.priority,
    classificationCorrect: formatValid && outcome.body.category === reference.category
      && outcome.body.priority === reference.priority,
    humanReviewCorrect: formatValid && outcome.body.requiresHumanReview === reference.requiresHumanReview,
  };
}

export function summarize(outcomes) {
  const total = outcomes.length;
  const count = (key) => outcomes.filter((outcome) => outcome.evaluation[key]).length;
  const percent = (n) => total ? Number((100 * n / total).toFixed(2)) : 0;
  return {
    total,
    validResponses: count('formatValid'),
    failedResponses: total - count('formatValid'),
    correctClassifications: count('classificationCorrect'),
    accuracyPercent: percent(count('classificationCorrect')),
    categoryAccuracyPercent: percent(count('categoryCorrect')),
    priorityAccuracyPercent: percent(count('priorityCorrect')),
    formatCompliancePercent: percent(count('formatValid')),
    humanReviewCompliancePercent: percent(count('humanReviewCorrect')),
  };
}

export function conclusionFor(report) {
  if (report.status === 'blocked' || (report.status !== 'complete' && !report.generativeResponsesReceived)) {
    return 'No hay datos suficientes para establecer una comparación entre ambos motores. '
      + 'Ejecuta npm run compare con la configuración local preparada para obtener resultados.';
  }
  const traditional = report.summary.traditional.accuracyPercent;
  const generative = report.summary.generative.accuracyPercent;
  const result = traditional === generative
    ? `En esta ejecución ambos motores empataron con ${traditional}% de acierto.`
    : `En esta ejecución el motor ${traditional > generative ? 'tradicional' : 'generativo'} obtuvo mayor acierto: ${Math.max(traditional, generative)}% frente a ${Math.min(traditional, generative)}%.`;
  const discrepancies = report.results
    ? `Entre las respuestas válidas de Gemini, hubo ${report.results.filter((r) => r.generative.evaluation.formatValid && !r.generative.evaluation.categoryCorrect).length} discrepancias de categoría y ${report.results.filter((r) => r.generative.evaluation.formatValid && !r.generative.evaluation.priorityCorrect).length} de prioridad. `
    : '';
  return `${result} El porcentaje exige coincidir en categoría y prioridad con referencias fijadas previamente. ${discrepancies}`
    + 'El tradicional ofrece decisiones reproducibles y respuestas fijas; Gemini produce respuestas contextualizadas. '
    + 'La revisión humana incorpora reglas independientes del modelo. '
    + 'La muestra pequeña y conocida permite verificar el prototipo; la precisión general debe evaluarse con nuevas solicitudes.';
}

function outcomeLabel(outcome) {
  if (!outcome.evaluation.formatValid) return `Error HTTP ${outcome.httpStatus ?? 'sin respuesta'}`;
  return `${outcome.body.category}/${outcome.body.priority}`;
}

export function renderReport(report) {
  const lines = [
    '# Evidencia de comparación', '',
    `Estado: **${report.status}**. Fecha UTC: ${report.generatedAt}. Modelo: ${report.model}.`, '',
    'Referencias definidas en `tests/fixtures/requests.js` antes de ejecutar. Las respuestas completas y tiempos están en `results.json`.', '',
    '| Caso | Referencia | Tradicional | Generativo | Formato T/G | Acierto T/G | Revisión correcta T/G |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  const yesNo = (value) => value ? 'sí' : 'no';
  for (const row of report.results) {
    const t = row.traditional;
    const g = row.generative;
    lines.push(`| ${row.id} (${row.kind}) | ${row.reference.category}/${row.reference.priority} | ${outcomeLabel(t)} | ${outcomeLabel(g)} | ${yesNo(t.evaluation.formatValid)}/${yesNo(g.evaluation.formatValid)} | ${yesNo(t.evaluation.classificationCorrect)}/${yesNo(g.evaluation.classificationCorrect)} | ${yesNo(t.evaluation.humanReviewCorrect)}/${yesNo(g.evaluation.humanReviewCorrect)} |`);
  }
  lines.push('', '| Motor | Aciertos | Precisión | Formato válido | Revisión correcta |', '| --- | --- | --- | --- | --- |');
  for (const mode of ['traditional', 'generative']) {
    const s = report.summary[mode];
    lines.push(`| ${mode} | ${s.correctClassifications}/${s.total} | ${s.accuracyPercent}% | ${s.formatCompliancePercent}% | ${s.humanReviewCompliancePercent}% |`);
  }
  lines.push('',
    '## Conclusión técnica', '', conclusionFor(report), '',
    '## Metodología', '',
    'Ambos motores se invocan mediante POST /api/analyze en un servidor local temporal. No se inyectan dobles en esta ejecución. Cada acierto requiere formato válido, categoría y prioridad correctas; los errores cuentan como fallos sobre el total fijo de 12 casos. La revisión humana se informa por separado. Las respuestas del endpoint incorporan la protección de seguridad y el ocultamiento de secretos; categoría y prioridad del modelo no se sustituyen por reglas.', '');
  if (report.previousRun) lines.push(`Ejecución anterior conservada: [JSON](${report.previousRun}).`, '');
  return lines.join('\n');
}

export function renderHistory(runs) {
  const ordered = [...runs].sort((a, b) => a.report.generatedAt.localeCompare(b.report.generatedAt));
  const ids = new Set();
  let validResponses = 0;
  const lines = [
    '# Ejecuciones reales de Gemini', '',
    '| Fecha UTC | Modelo | Estado | Respuestas válidas | Acierto tradicional | Acierto generativo | JSON completo |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const { report, path } of ordered) {
    for (const row of report.results) {
      if (row.generative.evaluation.formatValid) {
        ids.add(row.id);
        validResponses++;
      }
    }
    lines.push(`| ${report.generatedAt} | ${report.model} | ${report.status} | ${report.summary.generative.validResponses}/12 | ${report.summary.traditional.accuracyPercent}% | ${report.summary.generative.accuracyPercent}% | [JSON](${path}) |`);
  }
  lines.push('',
    `Se registraron ${validResponses} respuestas generativas válidas que cubren ${ids.size} solicitudes distintas en ${ordered.length} ejecuciones. Cada porcentaje se calcula por ejecución, con un denominador fijo de 12 y los errores incluidos.`, '',
    'Las marcas de revisión humana incorporan la protección de la API. Los resultados de distintas ejecuciones se muestran por separado.', '',
    '## Conclusión de la última ejecución', '', conclusionFor(ordered.at(-1).report), '');
  return lines.join('\n');
}
