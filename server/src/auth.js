/**
 * Authentication: session-based auth with password hashing via node:crypto.
 *
 * Passwords are hashed with scrypt (no extra npm dependency). Sessions use
 * express-session with an in-memory store (single-process dev server).
 *
 * Permission model:
 *   - A codie user has permissions { led, buzzer, maxSpeed } and an
 *     `assignedTo` pointing at either a user id or a robot address.
 *   - `hasPermission` grants an action when any codie user assigned to the
 *     acting user OR to the robot address allows it.
 */

'use strict';

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import { readJson } from './store.js';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_COST = 2 ** 14;

/** Hash a plaintext password with scrypt. Returns `salt:hash` hex. */
export function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH);
  const saltHex = salt.toString('hex');
  const derived = scryptSync(password, salt, KEY_LENGTH, {
    maxmem: SCRYPT_COST * 128 * 1024,
  });
  return `${saltHex}:${derived.toString('hex')}`;
}

/** Compare a plaintext password against a `salt:hash` stored hash. */
export function comparePassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  try {
    const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH, {
      maxmem: SCRYPT_COST * 128 * 1024,
    });
    return timingSafeEqual(Buffer.from(hashHex, 'hex'), derived);
  } catch {
    return false;
  }
}

/** Middleware: require an authenticated user (401 otherwise). */
export function requireAuth(req, res, next) {
  if (!req.session.user) {
    const err = new Error('Authentication required');
    err.status = 401;
    return next(err);
  }
  next();
}

/** Middleware: require an admin user (403 otherwise). */
export function requireAdmin(req, res, next) {
  if (!req.session.user) {
    const err = new Error('Authentication required');
    err.status = 401;
    return next(err);
  }
  if (req.session.user.role !== 'admin') {
    const err = new Error('Admin required');
    err.status = 403;
    return next(err);
  }
  next();
}

/** Commands that need the `led` permission. */
const LED_COMMANDS = new Set(['led', 'ledSingle', 'ledAnim', 'ledsOff']);

/** Commands that need the `buzzer` permission. */
const BUZZER_COMMANDS = new Set(['beep', 'morse', 'tune']);

/** Commands subject to the `maxSpeed` permission. */
const DRIVE_COMMANDS = new Set([
  'driveSpeed', 'forward', 'backward', 'turn', 'stop',
]);

/** Map a command name to the permission it requires (null = none). */
export function permissionForCommand(command) {
  if (LED_COMMANDS.has(command)) return 'led';
  if (BUZZER_COMMANDS.has(command)) return 'buzzer';
  if (DRIVE_COMMANDS.has(command)) return 'maxSpeed';
  return null;
}

/**
 * Check whether the acting user is permitted to run a command on a robot.
 *
 * Relevant codie users: those assigned to the acting user (assignedTo ===
 * user.id) or to the robot address (assignedTo === address).
 *
 * - led/buzzer: any relevant codie user with that boolean permission true.
 * - maxSpeed: any relevant codie user whose maxSpeed >= requested speed.
 *
 * Returns { allowed: boolean, reason?: string }.
 */
export function hasPermission(user, codieUsers, address, command, params = {}) {
  const permission = permissionForCommand(command);
  if (!permission) return { allowed: true };

  const relevant = codieUsers.filter(
    (cu) => cu.assignedTo === user.id || cu.assignedTo === address,
  );

  for (const cu of relevant) {
    const perms = cu.permissions || {};
    if (permission === 'maxSpeed') {
      const maxSpeed = perms.maxSpeed;
      if (maxSpeed === undefined || maxSpeed === null) continue;
      const speed = Number(params.speed ?? 0);
      if (Number.isFinite(speed) && speed <= maxSpeed) {
        return { allowed: true };
      }
    } else if (perms[permission] === true) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason: `Insufficient permission: ${permission}`,
  };
}

/**
 * Express middleware factory: require a boolean permission (led/buzzer) for
 * the robot in req.params.address, resolved from the command in req.body.
 * Used to guard command-style routes.
 */
export function checkPermission(permission) {
  return async (req, res, next) => {
    const user = req.session.user;
    if (!user) {
      const err = new Error('Authentication required');
      err.status = 401;
      return next(err);
    }
    const codieUsers = await readJson('codie-users.json');
    const address = req.params.address;
    const command = req.body?.name;
    const params = req.body?.params ?? {};
    const required = permissionForCommand(command ?? '');
    if (!required || required !== permission) {
      return next();
    }
    const result = hasPermission(user, codieUsers, address, command, params);
    if (!result.allowed) {
      const err = new Error(result.reason);
      err.status = 403;
      return next(err);
    }
    next();
  };
}
