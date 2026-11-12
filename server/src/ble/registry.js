/**
 * RobotRegistry — multiple Codie robots on one server.
 *
 * Each robot gets its own CodieClient (own BLE connection). The registry
 * provides the shared surface used by the REST API, the scripts and
 * socket.io.
 */

'use strict';

import { EventEmitter } from 'node:events';

import { CodieClient } from './client.js';
import { RobotScanner } from './scanner.js';
import { normalizeAddress } from './noble.js';
import { runCommand } from '../commands.js';
import { getNoble, ensurePoweredOn } from './noble.js';

/** Scan duration normalization (ms), clamped to [1000, 120000]. */
export function resolveScanDuration(value, fallback = 10000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1000), 120000);
}

/** Microphone raw value full scale (the official Codie API reports 0..~2048). */
export const MIC_FULL_SCALE = 2048;

export class RobotRegistry extends EventEmitter {
  constructor({
    noble,
    filters = {},
    autoReconnect = true,
    reconnectAttempts = 3,
    reconnectDelayMs = 5000,
    telemetryMs = 250,
    responseTimeoutMs = 2500,
    queryTimeoutMs = 1200,
    writeTimeoutMs = 3000,
    statusTimeoutMs = 10000,
    writeGapMs = 50,
    micMs = 200,
  } = {}) {
    super();
    this.noble = noble || getNoble({ adapterId: filters.adapterId || 'hci0' });
    this.filters = filters;
    this.autoReconnect = autoReconnect;
    this.reconnectAttempts = reconnectAttempts;
    this.reconnectDelayMs = reconnectDelayMs;
    this.telemetryMs = telemetryMs;
    this.responseTimeoutMs = responseTimeoutMs;
    this.queryTimeoutMs = queryTimeoutMs;
    this.writeTimeoutMs = writeTimeoutMs;
    this.statusTimeoutMs = statusTimeoutMs;
    this.writeGapMs = writeGapMs;
    this.micMs = micMs;

    this._robots = new Map(); // address -> CodieClient
    this._scanner = new RobotScanner({ noble: this.noble, filters });
    this._scanning = false;
    this._connectLock = Promise.resolve();
  }

  // ------------------------------------------------------------------
  // robot list
  // ------------------------------------------------------------------

  list() {
    return [...this._robots.values()].map((c) => c.describe());
  }

  get(address) {
    return this._robots.get(normalizeAddress(address)) ?? null;
  }

  /** Update BLE discovery filters at runtime (name/UUID/MAC allowlist/macOnly).
   * Applied to the scanner so the next scan uses the new filters. */
  setFilters(filters = {}) {
    this.filters = { ...this.filters, ...filters };
    if (this._scanner) this._scanner.filters = this.filters;
    return this.filters;
  }

  // ------------------------------------------------------------------
  // scan
  // ------------------------------------------------------------------

  async scan({ durationMs } = {}) {
    if (this._scanning) return this.list();
    this._scanning = true;
    try {
      const robots = await this._scanner.scan({ durationMs });
      for (const r of robots) {
        const addr = normalizeAddress(r.address);
        let client = this._robots.get(addr);
        if (!client) {
          client = this._createClient(addr, r.variant ?? null);
          client.describe().name = r.name;
          client.describe().matchReasons = r.matchReasons;
        }
        this._robots.set(addr, client);
        this.emit('robot', client.describe());
      }
      this.emit('scan', this.list());
      return this.list();
    } finally {
      this._scanning = false;
    }
  }

  _createClient(address, variant) {
    const client = new CodieClient({
      noble: this.noble,
      address,
      variant,
      autoReconnect: this.autoReconnect,
      reconnectAttempts: this.reconnectAttempts,
      reconnectDelayMs: this.reconnectDelayMs,
      responseTimeoutMs: this.responseTimeoutMs,
      queryTimeoutMs: this.queryTimeoutMs,
      writeTimeoutMs: this.writeTimeoutMs,
      statusTimeoutMs: this.statusTimeoutMs,
      writeGapMs: this.writeGapMs,
      micMs: this.micMs,
    });

    client.on('connect', (payload) => {
      const desc = client.describe();
      desc.connected = true;
      this.emit('robot', desc);
    });

    client.on('disconnect', () => {
      const desc = client.describe();
      desc.connected = false;
      this.emit('robot', desc);
    });

    client.on('telemetry', (payload) => {
      const desc = client.describe();
      desc.telemetry = payload;
      this.emit('telemetry', desc);
    });

    client.on('sensor', (payload) => {
      const desc = client.describe();
      desc.telemetry = desc.telemetry || {};
      desc.telemetry[payload.sensor] = payload.value;
      this.emit('telemetry', desc);
    });

    client.on('mic', (payload) => {
      const desc = client.describe();
      desc.telemetry = desc.telemetry || {};
      desc.telemetry.mic = payload.level;
      this.emit('telemetry', desc);
      this.emit('mic', payload);
    });

    client.on('robot-error', (payload) => this.emit('robot-error', payload));
    client.on('error', (payload) => this.emit('robot-error', payload));

    this._robots.set(address, client);
    return client;
  }

  // ------------------------------------------------------------------
  // connect / disconnect
  // ------------------------------------------------------------------

  async connect(address, peripheral = null) {
    const addr = normalizeAddress(address);
    let client = this._robots.get(addr);
    if (!client) {
      client = this._createClient(addr, null);
    }
    if (client.connected) return client.describe();

    this._connectLock = this._connectLock.then(async () => {
      if (peripheral) {
        await client.connect(peripheral);
      } else {
        // find a scanned peripheral matching this address
        // the scanner keeps discovered peripherals; we need one
        throw new Error(`No peripheral for ${addr}; scan first`);
      }
    });
    await this._connectLock;
    return client.describe();
  }

  async connectByPeripheral(address, peripheral) {
    const addr = normalizeAddress(address);
    let client = this._robots.get(addr);
    if (!client) {
      client = this._createClient(addr, null);
    }
    await client.connect(peripheral);
    return client.describe();
  }

  async disconnect(address) {
    const addr = normalizeAddress(address);
    const client = this._robots.get(addr);
    if (!client) return false;
    await client.disconnect();
    return true;
  }

  // ------------------------------------------------------------------
  // telemetry
  // ------------------------------------------------------------------

  startTelemetry(address) {
    const client = this._robots.get(normalizeAddress(address));
    if (!client) return;
    client.startTelemetry(this.telemetryMs);
  }

  stopTelemetry(address) {
    const client = this._robots.get(normalizeAddress(address));
    if (!client) return;
    client._stopTelemetry();
  }

  startMic(address) {
    const client = this._robots.get(normalizeAddress(address));
    if (!client) return;
    client.startMic(this.micMs);
  }

  stopMic(address) {
    const client = this._robots.get(normalizeAddress(address));
    if (!client) return;
    client._stopMic();
  }

  // ------------------------------------------------------------------
  // commands
  // ------------------------------------------------------------------

  async command(address, name, params = {}) {
    const client = this._robots.get(normalizeAddress(address));
    if (!client) throw new Error(`Unknown robot ${address}`);
    if (!client.connected) throw new Error(`Robot ${address} not connected`);
    return runCommand(client, name, params);
  }

  // ------------------------------------------------------------------
  // scripts
  // ------------------------------------------------------------------

  setScriptRunner(runner) {
    this._scripts = runner;
  }

  async startScript(address, name) {
    if (!this._scripts) throw new Error('Script runner not available');
    return this._scripts.start(address, name);
  }

  async stopScript(address) {
    if (!this._scripts) throw new Error('Script runner not available');
    return this._scripts.stop(address);
  }

  scriptStatus(address) {
    if (!this._scripts) return null;
    return this._scripts.status(address);
  }

  // ------------------------------------------------------------------
  // shutdown
  // ------------------------------------------------------------------

  async shutdown() {
    this._stopScanning();
    for (const client of this._robots.values()) {
      await client.disconnect();
    }
    this._robots.clear();
  }

  _stopScanning() {
    this._scanning = false;
  }
}
