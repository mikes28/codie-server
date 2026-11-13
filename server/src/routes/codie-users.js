/**
 * REST API — codie users (robot user profiles with permissions).
 *
 *   GET    /api/codie-users        list all
 *   POST   /api/codie-users        create
 *   PUT    /api/codie-users/:id    update
 *   DELETE /api/codie-users/:id    delete
 *
 * Fields: id, name, permissions { led, buzzer, maxSpeed },
 *         assignedTo (user id or robot address, or null), createdAt.
 * Persisted in server/data/codie-users.json.
 */

'use strict';

import { Router } from 'express';

import { readJson, writeJson, CODIE_USERS_FILE } from '../store.js';
import { requireAuth } from '../auth.js';

export function createCodieUsersRouter() {
  const router = Router();

  function asyncRoute(handler) {
    return (req, res, next) =>
      Promise.resolve(handler(req, res, next)).catch(next);
  }

  function nextId(items) {
    const max = items.reduce((m, item) => Math.max(m, Number(item.id || 0)), 0);
    return String(max + 1);
  }

  // GET /api/codie-users
  router.get('/', asyncRoute(async (_req, res) => {
    const items = await readJson(CODIE_USERS_FILE);
    res.json({ codieUsers: items });
  }));

  // POST /api/codie-users
  router.post(
    '/',
    requireAuth,
    asyncRoute(async (req, res) => {
      const { name, permissions, assignedTo } = req.body || {};
      if (!name) {
        const err = new Error('name is required');
        err.status = 400;
        throw err;
      }
      const items = await readJson(CODIE_USERS_FILE);
      const item = {
        id: nextId(items),
        name,
        permissions: {
          led: Boolean(permissions?.led),
          buzzer: Boolean(permissions?.buzzer),
          maxSpeed: Number.isFinite(Number(permissions?.maxSpeed))
            ? Number(permissions.maxSpeed)
            : null,
        },
        assignedTo: assignedTo ?? null,
        createdAt: new Date().toISOString(),
      };
      items.push(item);
      await writeJson(CODIE_USERS_FILE, items);
      res.status(201).json({ codieUser: item });
    }),
  );

  // PUT /api/codie-users/:id
  router.put(
    '/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const items = await readJson(CODIE_USERS_FILE);
      const index = items.findIndex((item) => item.id === req.params.id);
      if (index === -1) {
        const err = new Error('Codie user not found');
        err.status = 404;
        throw err;
      }
      const { name, permissions, assignedTo } = req.body || {};
      const item = { ...items[index] };
      if (name !== undefined) item.name = name;
      if (permissions !== undefined) {
        item.permissions = {
          led: Boolean(permissions.led),
          buzzer: Boolean(permissions.buzzer),
          maxSpeed: Number.isFinite(Number(permissions.maxSpeed))
            ? Number(permissions.maxSpeed)
            : item.permissions.maxSpeed,
        };
      }
      if (assignedTo !== undefined) item.assignedTo = assignedTo;
      items[index] = item;
      await writeJson(CODIE_USERS_FILE, items);
      res.json({ codieUser: item });
    }),
  );

  // DELETE /api/codie-users/:id
  router.delete(
    '/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const items = await readJson(CODIE_USERS_FILE);
      const index = items.findIndex((item) => item.id === req.params.id);
      if (index === -1) {
        const err = new Error('Codie user not found');
        err.status = 404;
        throw err;
      }
      items.splice(index, 1);
      await writeJson(CODIE_USERS_FILE, items);
      res.json({ ok: true });
    }),
  );

  return router;
}
