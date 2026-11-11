/**
 * CodieApi client shape tests — the Python client is tested separately with
 * pytest; here we verify the JS-side command contract it relies on.
 */

'use strict';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { COMMAND_NAMES, runCommand } from '../src/commands.js';

test('COMMAND_NAMES matches the Python CodieApi methods', () => {
  const expected = [
    'beep', 'morse', 'tune', 'led', 'ledSingle', 'ledsOff', 'ledAnim',
    'forward', 'backward', 'turn', 'stop', 'status', 'battery', 'sonar',
    'light', 'line', 'mic',
  ];
  assert.deepStrictEqual(COMMAND_NAMES, expected);
});
