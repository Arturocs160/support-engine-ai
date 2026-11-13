import 'dotenv/config';
import { once } from 'node:events';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createApp } from '../src/server.js';
import { REQUESTS } from '../tests/fixtures/requests.js';
import { evaluateOutcome, summarize, renderReport, renderHistory } from './lib/comparison.js';

const evidenceDir = new URL('../evidence/', import.meta.url);
const resultsFile = new URL('results.json', evidenceDir);

async function main() {
  const configured = Boolean(process.env.GEMINI_API_KEY?.trim());
  let previous = null;
  try {
    previous = JSON.parse(await readFile(resultsFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // No reemplazar una comparación real anterior con resultados sin credencial.
  if (!configured && previous?.status === 'complete') {
    console.error('Falta GEMINI_API_KEY. Se conserva la evidencia real anterior.');
    process.exitCode = 1;
    return;
  }
  const server = createApp().listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/api/analyze`;
    const results = [];
    for (const reference of REQUESTS) {
      const row = {
        id: reference.id, kind: reference.kind, message: reference.message,
        reference: {
          category: reference.category, priority: reference.priority,
          requiresHumanReview: reference.requiresHumanReview,
        },
      };
      for (const mode of ['traditional', 'generative']) {
        const start = performance.now();
        let outcome;
        try {
          const response = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: reference.message, mode }),
            signal: AbortSignal.timeout(70_000),
          });
          outcome = { httpStatus: response.status, body: await response.json() };
        } catch {
          outcome = { httpStatus: null, body: { error: { code: 'REQUEST_FAILED', message: 'La solicitud local no se completó.' } } };
        }
        row[mode] = {
          ...outcome, elapsedMs: Number((performance.now() - start).toFixed(2)),
          evaluation: evaluateOutcome(reference, outcome, mode),
        };
      }
      results.push(row);
      console.log(`${row.id}: traditional HTTP ${row.traditional.httpStatus}; generative HTTP ${row.generative.httpStatus}`);
      // Una solicitud por vez y pausa para reducir presión sobre la cuota.
      if (configured && reference !== REQUESTS.at(-1)) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const summary = Object.fromEntries(['traditional', 'generative'].map((mode) => [mode, summarize(results.map((row) => row[mode]))]));
    const report = {
      status: !configured ? 'blocked' : Object.values(summary).every((s) => s.validResponses === REQUESTS.length) ? 'complete' : 'incomplete',
      generatedAt: new Date().toISOString(),
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite',
      provider: 'Gemini', providerConfigured: configured,
      generativeResponsesReceived: summary.generative.validResponses,
      referenceSource: 'tests/fixtures/requests.js',
      criterion: 'Formato válido y coincidencia de categoría y prioridad. Errores incluidos en el denominador.',
      summary, results,
    };
    await mkdir(evidenceDir, { recursive: true });
    const runsDir = new URL('runs/', evidenceDir);
    await mkdir(runsDir, { recursive: true });
    if (previous) {
      const name = new Date(previous.generatedAt).toISOString().replace(/[:.]/g, '-') + '.json';
      await writeFile(new URL(name, runsDir), JSON.stringify(previous, null, 2) + '\n');
      report.previousRun = `runs/${name}`;
    }
    await writeFile(resultsFile, JSON.stringify(report, null, 2) + '\n');
    await writeFile(new URL('comparison.md', evidenceDir), renderReport(report));
    const archivedFiles = (await readdir(runsDir)).filter((name) => name.endsWith('.json'));
    const history = await Promise.all(archivedFiles.map(async (name) => ({
      report: JSON.parse(await readFile(new URL(name, runsDir), 'utf8')),
      path: `runs/${name}`,
    })));
    history.push({ report, path: 'results.json' });
    await writeFile(new URL('README.md', evidenceDir), renderHistory(history));
    console.table(summary);
    console.log(`Evidencia guardada. Estado: ${report.status}.`);
    if (report.status !== 'complete') process.exitCode = 1;
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch(() => {
  console.error('No fue posible generar la evidencia. Revisa la configuración y los permisos de la carpeta evidence.');
  process.exitCode = 1;
});
