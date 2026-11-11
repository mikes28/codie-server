/**
 * Robot discovery (scan) — only Codie robots are shown.
 *
 * The environment is full of other BLE devices (headphones, phones,
 * fitness bands). The filter uses two "identity" signals:
 *
 *   1. name      — the Codie's advertised name ("Codie"); the filter is
 *                  prefix-based, so multiple robots ("Codie", "Codie 2")
 *                  match;
 *   2. UUID      — one of the robot's advertised service UUIDs.
 *
 * Optional MAC allowlist narrows the set further:
 *   - macAllowlist non-empty → the address must be in it;
 *   - macOnly = true → the allowlist alone is enough (no name/UUID check).
 */

'use strict';

import { normalizeAddress } from './noble.js';
import * as p from './protocol.js';

/** Discovery start/stop timeout guard. */
const DISCOVERY_TIMEOUT_MS = 8000;

/** Pure filter function — uniformly testable. */
export function matchRobot(advertisement, filters = {}) {
  const reasons = [];
  const name = (advertisement.name || '').trim();
  const nameFilter = (filters.nameFilter || '').trim().toLowerCase();
  const address = normalizeAddress(advertisement.address || '');
  const allowlist = (filters.macAllowlist || []).map(normalizeAddress);
  const uuids = (advertisement.serviceUuids || []).map(p.canonicalUuid);
  const wantedUuids = (filters.serviceUuids || []).map(p.canonicalUuid);

  const nameMatched = Boolean(nameFilter) && name.toLowerCase().startsWith(nameFilter);
  const uuidMatched = wantedUuids.some((wanted) => uuids.includes(wanted));

  if (nameMatched) reasons.push('name');
  if (uuidMatched) reasons.push('service-uuid');

  const allowlisted = allowlist.includes(address);
  if (filters.macOnly) {
    return { match: allowlisted, reasons: allowlisted ? ['allowlist-mac-only'] : [] };
  }
  if (allowlist.length > 0 && !allowlisted) {
    return { match: false, reasons: ['not-allowlisted'] };
  }
  if (allowlist.length > 0) reasons.push('allowlisted');

  if (nameMatched || uuidMatched) return { match: true, reasons };
  return { match: false, reasons };
}

/** Noble peripheral -> advertisement description. */
export function describePeripheral(peripheral) {
  return {
    address: peripheral.address,
    name: peripheral.localName || peripheral.name || '',
    serviceUuids: (peripheral.serviceUuids || []).slice(),
    rssi: peripheral.rssi ?? null,
  };
}

/**
 * Scanner — BlueZ runs only one discovery at a time, so calls are serialized
 * (a `scan` and a `connect` must not collide).
 */
export class RobotScanner {
  constructor({ noble, filters } = {}) {
    this.noble = noble;
    this.filters = filters;
    this._discovering = null;
    this._queue = Promise.resolve();
  }

  /** Scan for `durationMs` and return matching robots. */
  async scan({ durationMs } = {}) {
    const ms = durationMs ?? 10000;
    this._queue = this._queue.then(() => this._runScan(ms));
    return this._queue;
  }

  async _runScan(ms) {
    if (this._discovering) return this._discovering;
    this._discovering = this._discover(ms);
    try {
      return await this._discovering;
    } finally {
      this._discovering = null;
    }
  }

  async _discover(ms) {
    const noble = this.noble;
    const filters = this.filters;

    return new Promise((resolve, reject) => {
      const found = new Map();
      let timer = null;
      let discoveryState = 'idle';

      const onScanStart = () => {
        discoveryState = 'scanning';
        timer = setTimeout(stop, ms);
      };
      const onScanStop = () => {
        discoveryState = 'stopped';
        clearTimeout(timer);
        timer = null;
        noble.removeAllListeners('scanStart');
        noble.removeAllListeners('scanStop');
        noble.removeAllListeners('discover');
        resolve([...found.values()]);
      };
      const onDiscover = (peripheral) => {
        const desc = describePeripheral(peripheral);
        const result = matchRobot(desc, filters);
        if (result.match) {
          found.set(desc.address, { ...desc, matchReasons: result.reasons });
        }
      };

      function stop() {
        try {
          noble.stopScanningAsync();
        } catch (e) {
          // ignore — stopScanning may throw if already stopped
        }
        onScanStop();
      }

      noble.on('scanStart', onScanStart);
      noble.on('scanStop', onScanStop);
      noble.on('discover', onDiscover);

      noble
        .startScanningAsync([], { allowDuplicates: false })
        .then(() => {})
        .catch((err) => {
          noble.removeAllListeners('scanStart');
          noble.removeAllListeners('scanStop');
          noble.removeAllListeners('discover');
          reject(err);
        });
    });
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
