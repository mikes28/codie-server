/**
 * Server start: Express + socket.io + BLE registry.
 *
 *   node src/index.js
 *
 * Configuration comes from environment variables (see src/config.js).
 */

'use strict';

import { createServer } from 'node:http';

import { Server } from 'socket.io';

import { config, registryOptions } from './config.js';
import { createApp } from './app.js';
import { attachRealtime } from './realtime.js';
import { ScriptRunner } from './scripts.js';
import { getNoble, ensurePoweredOn } from './ble/noble.js';
import { RobotRegistry } from './ble/registry.js';

export async function startServer(options = {}) {
  const settings = options.config || config;
  const noble = options.noble || getNoble({ adapterId: settings.ble.adapterId });

  const registry =
    options.registry ||
    new RobotRegistry({
      noble,
      filters: settings.ble,
      ...registryOptions(settings.ble),
    });

  const scripts =
    options.scripts ||
    new ScriptRunner({
      python: settings.python,
      scriptDir: settings.scriptDir,
      timeoutMs: settings.ble.scriptTimeoutMs,
    });

  const app = createApp({ registry, filters: settings.ble, scripts });
  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: true, credentials: true },
  });
  attachRealtime({ io, registry, scripts });

  await new Promise((resolve) => {
    server.listen(settings.port, settings.host, resolve);
  });

  const address = server.address();
  // The scripts talk to the backend's own REST API — the address is the
  // actually-listening port (0.0.0.0 isn't usable on loopback).
  scripts.setApiUrl(`http://127.0.0.1:${address.port}`);

  console.log(`[codie] server listening: http://${settings.host}:${address.port}`);
  console.log(
    `[codie] robot filter: name="${settings.ble.nameFilter}" uuid=${settings.ble.serviceUuids.join(',')} ` +
      `allowlist=${settings.ble.macAllowlist.join(',') || '(none)'}`,
  );

  try {
    await ensurePoweredOn(noble, 10000);
    console.log('[codie] BLE adapter ready');
  } catch (error) {
    console.warn(`[codie] BLE adapter unavailable: ${error.message}`);
  }

  for (const addressToConnect of settings.ble.autoConnect) {
    registry.connect(addressToConnect).catch((error) => {
      console.warn(`[codie] auto-connect to ${addressToConnect} failed: ${error.message}`);
    });
  }

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('[codie] shutting down…');
    await registry.shutdown();
    io.close();
    server.close();
    process.exit(0);
  };

  // signal handlers only once (startServer may be called multiple times)
  if (process.listenerCount('SIGINT') === 0) {
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  return { app, server, io, registry, noble };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('[codie] fatal:', error);
    process.exit(1);
  });
}
