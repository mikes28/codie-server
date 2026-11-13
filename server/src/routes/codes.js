/**
 * REST API — user code storage and execution.
 *
 *   GET    /api/code              list the authenticated user's code
 *   POST   /api/code              save a new code entry
 *   GET    /api/code/:id          get one code entry
 *   DELETE /api/code/:id          delete one code entry
 *   POST   /api/code/:id/run      deliver code to a robot via proxy command
 *
 * Fields: id, userId, name, code (python), language ('blocks'|'python'),
 *         createdAt, updatedAt. Persisted in server/data/codes.json.
 */

'use strict';

import { Router } from 'express';

import { readJson, writeJson, CODES_FILE } from '../store.js';
import { requireAuth } from '../auth.js';

export function createCodesRouter({ registry } = {}) {
  const router = Router();

  function asyncRoute(handler) {
    return (req, res, next) =>
      Promise.resolve(handler(req, res, next)).catch(next);
  }

  function nextId(items) {
    const max = items.reduce((m, item) => Math.max(m, Number(item.id || 0)), 0);
    return String(max + 1);
  }

  function ownOrAdmin(item, user) {
    return item.userId === user.id || user.role === 'admin';
  }

  // GET /api/code — list the authenticated user's code entries
  router.get('/', requireAuth, asyncRoute(async (req, res) => {
    const items = await readJson(CODES_FILE);
    const mine = items.filter((item) => item.userId === req.session.user.id);
    res.json({ codes: mine });
  }));

  // POST /api/code — save a new code entry
  router.post(
    '/',
    requireAuth,
    asyncRoute(async (req, res) => {
      const { name, code, language } = req.body || {};
      if (!name) {
        const err = new Error('name is required');
        err.status = 400;
        throw err;
      }
      if (code === undefined) {
        const err = new Error('code is required');
        err.status = 400;
        throw err;
      }
      if (language !== undefined && !['blocks', 'python'].includes(language)) {
        const err = new Error("language must be 'blocks' or 'python'");
        err.status = 400;
        throw err;
      }
      const items = await readJson(CODES_FILE);
      const now = new Date().toISOString();
      const item = {
        id: nextId(items),
        userId: req.session.user.id,
        name,
        code,
        language: language ?? 'python',
        createdAt: now,
        updatedAt: now,
      };
      items.push(item);
      await writeJson(CODES_FILE, items);
      res.status(201).json({ code: item });
    }),
  );

  // GET /api/code/:id — get one code entry (owner or admin)
  router.get(
    '/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const items = await readJson(CODES_FILE);
      const item = items.find((item) => item.id === req.params.id);
      if (!item) {
        const err = new Error('Code not found');
        err.status = 404;
        throw err;
      }
      if (!ownOrAdmin(item, req.session.user)) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
      res.json({ code: item });
    }),
  );

  // DELETE /api/code/:id — delete one code entry (owner or admin)
  router.delete(
    '/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const items = await readJson(CODES_FILE);
      const index = items.findIndex((item) => item.id === req.params.id);
      if (index === -1) {
        const err = new Error('Code not found');
        err.status = 404;
        throw err;
      }
      const item = items[index];
      if (!ownOrAdmin(item, req.session.user)) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
      items.splice(index, 1);
      await writeJson(CODES_FILE, items);
      res.json({ ok: true });
    }),
  );

  // POST /api/code/:id/run — deliver code to a robot via proxy command
  router.post(
    '/:id/run',
    requireAuth,
    asyncRoute(async (req, res) => {
      const { address } = req.body || {};
      if (!address) {
        const err = new Error('robot address is required');
        err.status = 400;
        throw err;
      }
      const items = await readJson(CODES_FILE);
      const item = items.find((item) => item.id === req.params.id);
      if (!item) {
        const err = new Error('Code not found');
        err.status = 404;
        throw err;
      }
      if (!ownOrAdmin(item, req.session.user)) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
      if (!registry) {
        const err = new Error('Robot registry unavailable');
        err.status = 503;
        throw err;
      }
      const result = await registry.command(address, 'proxy', {
        text: item.code,
      });
      res.json({ ok: true, code: item, address, result });
    }),
  );

  return router;
}
