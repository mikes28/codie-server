/**
 * No-routing wire-protocol parity against codie/wire_norrouting.py.
 */

'use strict';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import * as np from '../src/ble/protocol-norrouting.js';

test('buildFrame encodes SEQ|CMD|PARAM', () => {
  const frame = np.buildFrame(np.CMD_MOVE, [0x01, 0x02, 0x03], 7);
  assert.deepStrictEqual([...frame], [0x07, 0x00, 0x01, 0x00, 0x01, 0x02, 0x03]);
});

test('decodeReply parses seq|cmd|args', () => {
  const data = Buffer.from([0x07, 0x00, 0x01, 0x00, 0x01, 0x02, 0x03]);
  const decoded = np.decodeReply(data);
  assert.deepStrictEqual(decoded, { seq: 7, cmd: 0x0001, args: Buffer.from([0x01, 0x02, 0x03]) });
});

test('normalizeDistance converts 0.1mm units', () => {
  assert.strictEqual(np.normalizeDistance(100), 10);
  assert.strictEqual(np.normalizeDistance(250), 25);
});

test('normalizeBattery caps at 100', () => {
  assert.strictEqual(np.normalizeBattery(50), 50);
  assert.strictEqual(np.normalizeBattery(150), 100);
});

test('decodeLine parses the fixed-point value', () => {
  // raw = 31 * 2^20 = 32505856 -> value = 31.0, level = 3, onLine = true
  const payload = Buffer.from([0x00, 0x00, 0xf0, 0x01]);
  const line = np.decodeLine(payload);
  assert.strictEqual(line.value, 31.0);
  assert.strictEqual(line.level, 3);
  assert.strictEqual(line.onLine, true);
});

test('colorParams scales hue/sat/val for no-routing gen', () => {
  const cp = np.colorParams('red');
  assert.ok(cp);
  assert.strictEqual(cp.hue, 0);
  assert.strictEqual(cp.sat, 255);
  assert.strictEqual(cp.val, 255);
});
