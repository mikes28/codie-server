/**
 * Express application — REST API + static frontend serving.
 *
 * The `registry` is injected so tests can run the app with a fake registry
 * and no BLE hardware.
 */

'use strict';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { createRobotRouter } from './routes/robots.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const publicDir = path.join(here, '..', 'public');

export function createApp({ registry, filters = {}, scripts = null }) {
  const app = express();

  app.use(express.json());
  app.use('/api', createRobotRouter({ registry, filters, scripts }));
  app.use(express.static(publicDir));

  // Express error handler — 4 args (Express identifies it by arity).
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    // Validation errors arrive with 400 (the command layer flags them),
    // BLE errors with 503, anything else (programming bug) with 500.
    const status = error.status || 500;
    if (status >= 500) console.error('[api]', error);
    res.status(status).json({ error: error.message || 'Unknown error.' });
  });

  return app;
}
