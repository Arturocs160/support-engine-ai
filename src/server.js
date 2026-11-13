import 'dotenv/config';
import express from 'express';
import { pathToFileURL } from 'node:url';
import { createAnalyzeRouter } from './routes/analyze.routes.js';
import { AppError } from './errors/app.error.js';

export function createApp(engines) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(express.json({ limit: '32kb', strict: false }));
  app.use('/api/analyze', createAnalyzeRouter(engines));
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Ruta no encontrada.')));
  app.use((error, _req, res, _next) => {
    let safeError = error;
    if (error.type === 'entity.too.large') {
      safeError = new AppError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo no debe exceder 32 KB.');
    } else if (error.type === 'entity.parse.failed') {
      safeError = new AppError(400, 'INVALID_JSON', 'El cuerpo no contiene un JSON válido.');
    } else if (['charset.unsupported', 'encoding.unsupported'].includes(error.type)) {
      safeError = new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Utiliza JSON con codificación UTF-8.');
    } else if (!(error instanceof AppError)) {
      safeError = new AppError(500, 'INTERNAL_ERROR', 'No fue posible procesar la solicitud.');
    }
    res.status(safeError.status).json({ error: { code: safeError.code, message: safeError.message } });
  });
  return app;
}

export function startServer() {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535.');
  }
  const server = createApp().listen(port, host, () => {
    console.log(`AI Support Engine disponible en http://${host}:${port}`);
  });
  server.on('error', () => {
    console.error('No fue posible iniciar el servidor. Revisa HOST, PORT y si el puerto está ocupado.');
    process.exitCode = 1;
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    startServer();
  } catch {
    console.error('Configuración inválida. Revisa HOST y PORT.');
    process.exitCode = 1;
  }
}
