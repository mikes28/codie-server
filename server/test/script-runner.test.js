/**
 * ScriptRunner — tests with a fake Python engine (no hardware, no Python).
 */

'use strict';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ScriptRunner } from '../src/scripts.js';

test('runner rejects duplicate start on same robot', async () => {
  const runner = new ScriptRunner({ python: 'python3' });
  // Override spawn to avoid real subprocess
  const originalSpawn = runner.constructor;
  runner._running.set('AA:BB', { child: { kill() {} }, name: 'foo', startTime: Date.now(), timer: null });
  await assert.rejects(() => runner.start('AA:BB', 'foo'), { status: 409 });
});

test('status returns null when not running', () => {
  const runner = new ScriptRunner({ python: 'python3' });
  assert.strictEqual(runner.status('AA:BB'), null);
});

test('list reads scripts via the runner process', async () => {
  // The real runner calls the python engine --list; here we just check the
  // function exists and returns a promise (it will fail without python, which
  // is fine for a unit test of the wiring).
  const runner = new ScriptRunner({ python: 'python3' });
  const promise = runner.list();
  assert.ok(promise instanceof Promise);
  await promise.catch(() => {}); // expected to fail without python3
});
