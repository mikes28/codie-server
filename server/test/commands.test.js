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
test('driveSpeed validates and forwards', async () => {
  const calls = [];
  const client = { driveSpeed: async (l, r) => calls.push([l, r]) };
  const result = await runCommand(client, 'driveSpeed', { left: -40, right: 60 });
  assert.deepStrictEqual(calls, [[-40, 60]]);
  assert.deepStrictEqual(result, { action: 'driveSpeed', left: -40, right: 60 });
});

test('driveSpeed rejects out-of-range', async () => {
  const client = { driveSpeed: async () => {} };
  await assert.rejects(() => runCommand(client, 'driveSpeed', { left: 200, right: 0 }));
  await assert.rejects(() => runCommand(client, 'driveSpeed', { left: 'x', right: 0 }));
});

test('proxy forwards text and returns reply', async () => {
  const client = { proxyCommand: async (text) => `echo:${text}` };
  const result = await runCommand(client, 'proxy', { text: 'get appSys ver' });
  assert.deepStrictEqual(result, { action: 'proxy', text: 'get appSys ver', reply: 'echo:get appSys ver' });
});

test('proxy rejects empty text', async () => {
  const client = { proxyCommand: async () => '' };
  await assert.rejects(() => runCommand(client, 'proxy', { text: '' }));
  await assert.rejects(() => runCommand(client, 'proxy', { text: '   ' }));
});
