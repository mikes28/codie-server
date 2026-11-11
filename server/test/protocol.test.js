/**
 * Routing wire-protocol parity — byte-for-byte against the Python reference
 * (codie/wire.py). These tests run without any BLE hardware.
 */

'use strict';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import * as p from '../src/ble/protocol.js';

test('buildFrame produces the correct routing frame', () => {
  // SpeakBeep(1000 ms): INFO=0x40, SEQ=1, CMD=0x1064, ARGLEN=2, ARG=0xE8 0x03
  p.resetSeq();
  const { frame, seq } = p.buildFrame(p.CMD_SPEAK_BEEP, p.beepArgs(1000));
  assert.strictEqual(seq, 1);
  assert.deepStrictEqual(
    [...frame],
    [0x40, 0x01, 0x00, 0x64, 0x10, 0x02, 0x00, 0xe8, 0x03],
  );
});

test('u16 is little-endian', () => {
  assert.deepStrictEqual([...p.u16(0x03e8)], [0xe8, 0x03]);
  assert.deepStrictEqual([...p.u16(0xffff)], [0xff, 0xff]);
  assert.deepStrictEqual([...p.u16(0x0fff)], [0xff, 0x0f]);
});

test('i8 two\'s complement', () => {
  assert.deepStrictEqual([...p.i8(40)], [40]);
  assert.deepStrictEqual([...p.i8(-1)], [0xff]);
});

test('infoByte encoding', () => {
  assert.strictEqual(p.infoByte(), 0x40); // APP(0)<<4 | MCU(1)<<6 | NORMAL(0)
  assert.strictEqual(p.infoByte(0, 1, 0x08), 0x48);
});

test('colorHsv resolves named colors', () => {
  const red = p.colorHsv('red');
  assert.ok(red);
  assert.strictEqual(red[0], 0); // hue 0 for red
  assert.strictEqual(red[1], 255);
  assert.strictEqual(red[2], 255);
});

test('colorHsv rejects unknown colors', () => {
  assert.strictEqual(p.colorHsv('notacolor'), null);
});

test('ledAllArgs builds the LED frame args', () => {
  // u16(0x0fff) LE = [0xff, 0x0f]; red HSV = [0, 255, 255]
  const args = p.ledAllArgs('red');
  assert.deepStrictEqual([...args], [0xff, 0x0f, 0x00, 0xff, 0xff]);
});

test('decodeResponse parses a reply frame', () => {
  // Reply frame: INFO=0x10, SEQ=0x0028, CMD=0x9061, ARGLEN=0x0003,
  //   reply-SEQ=0x0012, ReARG=[0x00]
  const data = Buffer.from([0x10, 0x28, 0x00, 0x61, 0x90, 0x03, 0x00, 0x12, 0x00, 0x00]);
  const decoded = p.decodeResponse(data);
  assert.deepStrictEqual(decoded, { replySeq: 0x0012, cmd: 0x9061, args: Buffer.from([0x00]) });
});
