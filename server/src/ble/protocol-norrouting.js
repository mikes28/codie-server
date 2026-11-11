/**
 * Codie BLE wire-protocol — **no-routing generation** (JS port).
 *
 * Frame: SEQ(2) | CMD(2) | ARG…
 * Four characteristics (request + action + two replies).
 *
 * 1:1 port of the Python `codie/wire_norrouting.py` reference (the codiejs
 * protocol). Parity reference for the JS port.
 */

'use strict';

import { colorHsv } from './protocol.js';

// --- BLE GATT identifiers (from the codiejs configuration) ----------------

export const SERVICE_UUID = 'd46e7e53-ba2f-4044-ade9-f85ead45f458';
/** Sensor request goes here; the reply comes back (indicate). */
export const REQUEST_UUID = '25ad752e7a424c90852690e85fb3741d';
export const REQUEST_REPLY_UUID = '02a92ec60e7e415ca311828a802c61d5';
/** Commands (beep, LED, motor) go here; the reply comes back (indicate). */
export const ACTION_UUID = '0b08f48da33f4a93ad2584928e2ef792';
export const ACTION_REPLY_UUID = '8a7f8f018679400cb32b464c71f5d06b';

// --- Command IDs ----------------------------------------------------------

export const CMD_ECHO = 0x00;
export const CMD_MOVE = 0x01; // distance u16 (mm), leftSpeed i8, rightSpeed i8
export const CMD_MOTOR_BOTH = 0x02; // leftSpeed i8, rightSpeed i8
export const CMD_MOTOR_LEFT = 0x03; // speed i8
export const CMD_MOTOR_RIGHT = 0x04; // speed i8
export const CMD_TURN = 0x05; // angle u16 (°), speed i8
export const CMD_BEEP = 0x06; // volume u8, frequency u16 (Hz), duration u16 (ms)
export const CMD_SET_COLOR = 0x08; // hue u8, saturation u8, value u8
export const CMD_SET_ANIMATION = 0x09; // animation u8, hue u8, sat u8, repeat u8, speed u8

// Motor speed is signed (i8, two's complement): codiejs sends `value & 0xff`.
// `turn` is documented as "positive speed = left" — the firmware interprets
// the byte as i8. (0..100 is the positive speed range; negative is reverse.)

// --- Sensor queries (onto the request characteristic) ---------------------

export const QUERY_DISTANCE = 0x01; // -> mm
export const QUERY_BATTERY = 0x02; // -> %
export const QUERY_SOUND = 0x03; // -> raw (0..~2048)
export const QUERY_LIGHT = 0x04; // -> raw (0..4096)
export const QUERY_LINE = 0x05; // -> raw

export const MAX_BEEP_MS = 10000;

// --- Frame encoding -------------------------------------------------------

/** u16 little-endian bytes. */
export function u16(value) {
  return Buffer.from([value & 0xff, (value >> 8) & 0xff]);
}

/** Command frame: SEQ(2) | CMD(2) | PARAM... */
export function buildFrame(cmd, params = [], seq = 0) {
  return Buffer.from([...u16(seq), ...u16(cmd), ...params]);
}

/** Decode a reply frame. */
export function decodeReply(data) {
  if (!data || data.length < 4) return null;
  const seq = data.readUInt16LE(0);
  const cmd = data.readUInt16LE(2);
  const args = data.subarray(4);
  return { seq, cmd, args };
}

// --- Sensor value normalization (per codiejs) -----------------------------

/** Distance: the raw value arrives in 0.1 mm units. */
export function normalizeDistance(raw) {
  return Math.round(raw / 10);
}

/** Battery: percent, capped at 100. */
export function normalizeBattery(raw) {
  return raw > 100 ? 100 : raw;
}

// --- Line sensor value ----------------------------------------------------

/** The no-routing generation line sensor reports a single fixed-point value
 * (not two 12-bit values). Scale 2^20 per codiejs, threshold 30. */
export const LINE_SCALE = 1024 * 1024;
export const LINE_THRESHOLD = 30;

/** Decode the 4-byte line sensor value (payload without the SEQ). */
export function decodeLine(payload) {
  if (!payload || payload.length < 4) return { value: 0, level: 0, onLine: false };
  const raw = payload.readUInt32LE(0);
  const value = raw / LINE_SCALE;
  const level = Math.round((value / 1024) * 100);
  return { value, level, onLine: value > LINE_THRESHOLD };
}

// --- LED color parameters for this generation -----------------------------

/** Hue 0-360 x 0.7, sat/val 0-100 x 2.55 for the no-routing generation. */
export function colorParams(color) {
  const hsv = colorHsv(color);
  if (!hsv) return null;
  return {
    hue: Math.round((hsv[0] / 255) * 360 * 0.7),
    sat: Math.round((hsv[1] / 255) * 100 * 2.55),
    val: Math.round((hsv[2] / 255) * 100 * 2.55),
  };
}
