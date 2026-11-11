/**
 * High-level command validation — runs without BLE hardware.
 */

'use strict';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { runCommand, numberParam, colorParam } from '../src/commands.js';

test('numberParam validates ranges', () => {
  assert.strictEqual(numberParam(5, 'x', { min: 0, max: 10 }), 5);
  assert.throws(() => numberParam(-1, 'x', { min: 0 }));
  assert.throws(() => numberParam(11, 'x', { max: 10 }));
  assert.throws(() => numberParam('abc', 'x'));
  assert.throws(() => numberParam(1.5, 'x', { integer: true }));
});

test('colorParam accepts names and hex', () => {
  assert.strictEqual(colorParam('red', 'color'), 'red');
  assert.strictEqual(colorParam('#ff8800', 'color'), '#ff8800');
  assert.strictEqual(colorParam('ff8800', 'color'), 'ff8800');
  assert.throws(() => colorParam('notacolor', 'color'));
});

test('COMMAND_NAMES lists all commands', async () => {
  const { COMMAND_NAMES } = await import('../src/commands.js');
  assert.ok(COMMAND_NAMES.includes('led'));
  assert.ok(COMMAND_NAMES.includes('forward'));
  assert.ok(COMMAND_NAMES.includes('beep'));
});
