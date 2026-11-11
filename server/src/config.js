/**
 * Backend configuration — exclusively from environment variables.
 *
 * The `.env.example` lives in the repo root; the server loads it on start.
 */

'use strict';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnvFile } from 'dotenv';

import { SERVICE_UUID } from './ble/protocol.js';
import { defaultScriptDir } from './scripts.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// The repo root `.env` (shared with the Python side) and the server/.env —
// neither is mandatory, environment variables override both.
loadEnvFile({
  path: [path.join(here, '..', '..', '.env'), path.join(here, '..', '.env')],
  quiet: true,
});

/** The robot vendor UUID (observed live on the 2026-10-20 scan). */
export const ADVERTISED_ROBOT_UUID = 'd46e7e53ba2f4044ade9f85ead45f458';

function num(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  return /^(1|true|yes|on)$/i.test(raw);
}

function list(env, name, fallback = []) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(env = process.env) {
  const ble = {
    adapterId: env.CODIE_ADAPTER ?? 'hci0',
    nameFilter: env.CODIE_ROBOT_NAME ?? 'Codie',
    serviceUuids: list(env, 'CODIE_ROBOT_UUIDS', [
      '52af0001-978a-628d-c845-0a104ca2b8dd',
      'd46e7e53-ba2f-4044-ade9-f85ead45f458',
    ]),
    macAllowlist: list(env, 'CODIE_MAC_ALLOWLIST', []),
    macOnly: bool(env, 'CODIE_MAC_ONLY', false),
    scanMs: num(env, 'CODIE_SCAN_MS', 10000),
    scanWindowMs: num(env, 'CODIE_SCAN_WINDOW_MS', 8000),
    connectTimeoutMs: num(env, 'CODIE_CONNECT_TIMEOUT_MS', 20000),
    connectRetries: num(env, 'CODIE_CONNECT_RETRIES', 3),
    retryDelayMs: num(env, 'CODIE_RETRY_DELAY_MS', 3000),
    telemetryMs: num(env, 'CODIE_TELEMETRY_MS', 250),
    responseTimeoutMs: num(env, 'CODIE_RESPONSE_TIMEOUT_MS', 2500),
    queryTimeoutMs: num(env, 'CODIE_QUERY_TIMEOUT_MS', 1200),
    writeTimeoutMs: num(env, 'CODIE_WRITE_TIMEOUT_MS', 3000),
    statusTimeoutMs: num(env, 'CODIE_STATUS_TIMEOUT_MS', 10000),
    writeGapMs: num(env, 'CODIE_WRITE_GAP_MS', 50),
    micMs: num(env, 'CODIE_MIC_MS', 200),
    autoReconnect: bool(env, 'CODIE_AUTO_RECONNECT', true),
    reconnectAttempts: num(env, 'CODIE_RECONNECT_ATTEMPTS', 3),
    reconnectDelayMs: num(env, 'CODIE_RECONNECT_DELAY_MS', 5000),
    scriptTimeoutMs: num(env, 'CODIE_SCRIPT_TIMEOUT_MS', 120000),
    autoConnect: list(env, 'CODIE_AUTO_CONNECT', []),
  };

  return {
    port: num(env, 'PORT', 3000),
    host: env.HOST ?? '0.0.0.0',
    ble,
    python: env.CODIE_PYTHON ?? 'python3',
    scriptDir: defaultScriptDir,
  };
}

/**
 * The `RobotRegistry` options derived from the BLE configuration — one place
 * so the server and the scripts use the same values.
 */
export function registryOptions(ble) {
  return {
    adapterId: ble.adapterId,
    nameFilter: ble.nameFilter,
    serviceUuids: ble.serviceUuids,
    macAllowlist: ble.macAllowlist,
    macOnly: ble.macOnly,
    autoReconnect: ble.autoReconnect,
    reconnectAttempts: ble.reconnectAttempts,
    reconnectDelayMs: ble.reconnectDelayMs,
    telemetryMs: ble.telemetryMs,
    responseTimeoutMs: ble.responseTimeoutMs,
    queryTimeoutMs: ble.queryTimeoutMs,
    writeTimeoutMs: ble.writeTimeoutMs,
    statusTimeoutMs: ble.statusTimeoutMs,
    writeGapMs: ble.writeGapMs,
    micMs: ble.micMs,
  };
}

export const config = loadConfig();
