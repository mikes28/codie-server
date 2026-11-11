/**
 * socket.io layer — real-time channel between the server and the browser.
 *
 * The server forwards registry events ('scan', 'robot', 'telemetry') to
 * every connected client. The client can request the same operations as
 * the REST API ('scan:request', 'robot:connect', ...).
 */

'use strict';

import { resolveScanDuration } from './ble/registry.js';

export function attachRealtime({ io, registry, scripts = null }) {
  io.on('connection', (socket) => {
    socket.emit('robots', { robots: registry.list() });

    socket.on('scan:request', async (payload = {}) => {
      const durationMs = resolveScanDuration(payload?.durationMs);
      const robots = await registry.scan({ durationMs });
      socket.emit('scan', { robots });
    });

    socket.on('robot:connect', async (payload = {}) => {
      try {
        const robot = await registry.connect(payload.address);
        socket.emit('robot', robot);
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('robot:disconnect', async (payload = {}) => {
      try {
        await registry.disconnect(payload.address);
        socket.emit('robot', { address: payload.address, connected: false });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('robot:command', async (payload = {}) => {
      try {
        const result = await registry.command(payload.address, payload.name, payload.params ?? {});
        socket.emit('command-result', { action: payload.name, ...result });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // microphone listen start/stop (the browser level meter)
    socket.on('mic:start', (payload = {}) => {
      registry.startMic(payload.address);
    });

    socket.on('mic:stop', (payload = {}) => {
      registry.stopMic(payload.address);
    });

    // robot scripts (the Python communication script)
    socket.on('script:start', async (payload = {}) => {
      try {
        const result = await registry.startScript(payload.address, payload.name);
        socket.emit('script:event', { address: payload.address, event: { event: 'start', ...result } });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('script:stop', (payload = {}) => {
      registry.stopScript(payload.address);
      socket.emit('script:event', { address: payload.address, event: { event: 'stopped' } });
    });

    // advanced firmware commands (console protocol)
    socket.on('advanced:command', async (payload = {}) => {
      // forwarded through the command layer as a console op
      socket.emit('error', { message: 'advanced commands require a console session' });
    });

    // console commands (get|set|call interface op [args...])
    socket.on('console:command', async (payload = {}) => {
      socket.emit('error', { message: 'console commands not exposed over socket' });
    });
  });

  // Registry events -> every connected client.
  registry.on('scan', (robots) => io.emit('scan', { robots }));
  registry.on('robot', (robot) => io.emit('robot', robot));
  registry.on('telemetry', (robot) => io.emit('telemetry', robot));
  // command results issued via REST also go to the socket
  registry.on('command', (result) => io.emit('command-result', result));
  // BLE layer errors (bad packet, dropped connection) — the browser must see them
  registry.on('robot-error', (payload) => io.emit('robot-error', payload));
  // microphone values (the browser level meter)
  registry.on('mic', (payload) => io.emit('mic', payload));
  // robot script events (from the Python communication script)
  if (scripts) {
    scripts.on('event', (payload) => io.emit('script:event', payload));
  }

  return { io };
}
