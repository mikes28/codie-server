/**
 * REST API — authentication (session-based).
 *
 *   POST /api/auth/register   { username, email, password, role? }
 *   POST /api/auth/login      { username, password }
 *   POST /api/auth/logout
 *   GET  /api/auth/me
 *
 * Users are persisted in server/data/users.json. Passwords are hashed with
 * scrypt (node:crypto). Sessions are express-session cookies.
 */

'use strict';

import { randomUUID } from 'node:crypto';

import { Router } from 'express';

import { readJson, writeJson, USERS_FILE } from '../store.js';
import { hashPassword, comparePassword, requireAuth, requireAdmin } from '../auth.js';

export function createAuthRouter() {
  const router = Router();

  function asyncRoute(handler) {
    return (req, res, next) =>
      Promise.resolve(handler(req, res, next)).catch(next);
  }

  // POST /api/auth/register
  router.post(
    '/register',
    asyncRoute(async (req, res) => {
      const { username, email, password, role } = req.body || {};
      if (!username || !email || !password) {
        const err = new Error('username, email and password are required');
        err.status = 400;
        throw err;
      }
      if (password.length < 8) {
        const err = new Error('password must be at least 8 characters');
        err.status = 400;
        throw err;
      }

      const users = await readJson(USERS_FILE);
      if (users.some((u) => u.username === username)) {
        const err = new Error('Username already registered');
        err.status = 409;
        throw err;
      }
      if (users.some((u) => u.email === email)) {
        const err = new Error('Email already registered');
        err.status = 409;
        throw err;
      }

      const user = {
        id: randomUUID(),
        username,
        email,
        password: hashPassword(password),
        role: role === 'admin' ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      await writeJson(USERS_FILE, users);

      // Log the new user in.
      req.session.user = { id: user.id, username, email, role: user.role };

      const { password: _pw, ...withoutPassword } = user;
      res.status(201).json({ user: withoutPassword });
    }),
  );

  // POST /api/auth/login
  router.post(
    '/login',
    asyncRoute(async (req, res) => {
      const { username, password } = req.body || {};
      if (!username || !password) {
        const err = new Error('username and password are required');
        err.status = 400;
        throw err;
      }

      const users = await readJson(USERS_FILE);
      const user = users.find((u) => u.username === username);
      if (!user || !(await comparePassword(password, user.password))) {
        const err = new Error('Invalid username or password');
        err.status = 401;
        throw err;
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      };

      const { password: _pw, ...withoutPassword } = user;
      res.json({ user: withoutPassword });
    }),
  );

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ error: 'Could not log out' });
        return;
      }
      res.clearCookie('codie.sid');
      res.json({ ok: true });
    });
  });

  // GET /api/auth/me
  // GET /api/users — list all users (admin only)
  router.get('/users', requireAdmin, asyncRoute(async (_req, res) => {
    const users = await readJson(USERS_FILE);
    const safe = users.map(({ password: _pw, ...u }) => u);
    res.json({ users: safe });
  }));

  // PUT /api/users/:id — update user role (admin only)
  router.put('/users/:id', requireAdmin, asyncRoute(async (req, res) => {
    const { role } = req.body || {};
    if (!role || !['user', 'admin'].includes(role)) {
      const err = new Error('Invalid role');
      err.status = 400;
      throw err;
    }
    const users = await readJson(USERS_FILE);
    const idx = users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    users[idx].role = role;
    await writeJson(USERS_FILE, users);
    const { password: _pw, ...safe } = users[idx];
    res.json({ user: safe });
  }));

  // DELETE /api/users/:id — delete user (admin only)
  router.delete('/users/:id', requireAdmin, asyncRoute(async (req, res) => {
    const users = await readJson(USERS_FILE);
    const idx = users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    const [removed] = users.splice(idx, 1);
    await writeJson(USERS_FILE, users);
    const { password: _pw, ...safe } = removed;
    res.json({ user: safe });
  }));

  return router;
}
