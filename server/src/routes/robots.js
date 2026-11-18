/**
 * REST API — robot discovery, connections, commands, telemetry, scripts.
 *
 * Every endpoint works through the RobotRegistry, so HTTP and socket.io
 * behave identically (the socket forwards to the same registry events and
 * the same `runCommand`).
 */

'use strict';

import { Router } from 'express';

import { COMMAND_NAMES } from '../commands.js';
import { resolveScanDuration } from '../ble/registry.js';

export const SUPPORTED_VARIANTS = ['routing', 'no-routing'];

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function describeRobot(robot) {
  if (!robot) return robot;
  return { ...robot, variant: robot.variant ?? null };
}

export function createRobotRouter({ registry, filters = {}, scripts = null }) {
  const router = Router();

  // GET /api/health — is the server alive?
  router.get('/health', async (_req, res) => {
    res.json({ ok: true });
  });

  // GET /api/config — filter, command names, supported generations
  router.get('/config', (_req, res) => {
    res.json({
      variants: SUPPORTED_VARIANTS,
      commands: COMMAND_NAMES,
      ble: {
        nameFilter: filters.nameFilter || 'Codie',
        serviceUuids: filters.serviceUuids || [],
        macAllowlist: filters.macAllowlist || [],
        macOnly: Boolean(filters.macOnly),
      },
    });
  });

  // POST /api/config — update BLE discovery filters at runtime
  router.post('/config', asyncRoute(async (req, res) => {
    const { ble } = req.body || {};
    if (!ble || typeof ble !== 'object') {
      const err = new Error('Missing ble config');
      err.status = 400;
      throw err;
    }
    const updated = registry.setFilters(ble);
    res.json({ ble: {
      nameFilter: updated.nameFilter || 'Codie',
      serviceUuids: updated.serviceUuids || [],
      macAllowlist: updated.macAllowlist || [],
      macOnly: Boolean(updated.macOnly),
    } });
  }));

  // GET /api/robots — all known robots + telemetry
  router.get('/robots', (_req, res) => {
    res.json({ robots: registry.list() });
  });

  // GET /api/robots/:address — one robot
  router.get('/robots/:address', (req, res) => {
    const robot = registry.get(req.params.address);
    if (!robot) {
      const err = new Error('Unknown robot');
      err.status = 404;
      throw err;
    }
    res.json(describeRobot(robot));
  });

  // POST /api/scan — discover robots
  router.post('/scan', asyncRoute(async (req, res) => {
    const durationMs = resolveScanDuration(req.body?.durationMs);
    const robots = await registry.scan({ durationMs });
    res.json({ robots });
  }));

  // POST /api/robots/:address/connect
  router.post('/robots/:address/connect', asyncRoute(async (req, res) => {
    const robot = await registry.connect(req.params.address);
    res.json(describeRobot(robot));
  }));

  // POST /api/robots/:address/disconnect
  router.post('/robots/:address/disconnect', asyncRoute(async (req, res) => {
    const ok = await registry.disconnect(req.params.address);
    if (!ok) {
      const err = new Error('Unknown robot');
      err.status = 404;
      throw err;
    }
    res.json({ ok: true });
  }));

  // POST /api/robots/:address/command — { name, params }
  router.post('/robots/:address/command', asyncRoute(async (req, res) => {
    const { name, params = {} } = req.body || {};
    if (!name || !COMMAND_NAMES.includes(name)) {
      const err = new Error(`Unknown command: ${name}`);
      err.status = 400;
      throw err;
    }
    const result = await registry.command(req.params.address, name, params);
    res.json({ action: name, ...result });
  }));

  // GET /api/robots/:address/telemetry — last telemetry snapshot
  router.get('/robots/:address/telemetry', (req, res) => {
    const robot = registry.get(req.params.address);
    if (!robot) {
      const err = new Error('Unknown robot');
      err.status = 404;
      throw err;
    }
    res.json({ telemetry: robot.telemetry ?? null });
  });

  // POST /api/robots/:address/mic/start
  router.post('/robots/:address/mic/start', (_req, res) => {
    registry.startMic(_req.params.address);
    res.json({ ok: true });
  });

  // POST /api/robots/:address/mic/stop
  router.post('/robots/:address/mic/stop', (_req, res) => {
    registry.stopMic(_req.params.address);
    res.json({ ok: true });
  });

  // GET /api/scripts — list available robot scripts
  router.get('/scripts', asyncRoute(async (_req, res) => {
    const list = scripts ? await scripts.list() : [];
    res.json({ scripts: list });
  }));

  // GET /api/firmware — firmware interface register
  router.get('/firmware', asyncRoute(async (_req, res) => {
    const surface = scripts ? await scripts.firmware() : {};
    res.json(surface);
  }));

  // POST /api/robots/:address/script — start a script
  router.post('/robots/:address/script', asyncRoute(async (req, res) => {
    const { name } = req.body || {};
    if (!name) {
      const err = new Error('Missing script name');
      err.status = 400;
      throw err;
    }
    const result = await registry.startScript(req.params.address, name);
    res.json(result);
  }));

  // GET /api/robots/:address/script — running script status
  router.get('/robots/:address/script', (req, res) => {
    res.json({ script: registry.scriptStatus(req.params.address) });
  });

  // DELETE /api/robots/:address/script — stop the running script
  router.delete('/robots/:address/script', asyncRoute(async (req, res) => {
    const ok = await registry.stopScript(req.params.address);
    res.json({ ok: ok });
  }));

  return router;
}
