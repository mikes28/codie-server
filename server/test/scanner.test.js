/**
 * Robot discovery filter — pure function, no BLE hardware needed.
 */

'use strict';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { matchRobot } from '../src/ble/scanner.js';

test('matches by name prefix', () => {
  const result = matchRobot(
    { name: 'Codie', address: '00:07:80:66:F0:DA', serviceUuids: [] },
    { nameFilter: 'Codie' },
  );
  assert.strictEqual(result.match, true);
  assert.ok(result.reasons.includes('name'));
});

test('rejects non-Codie names', () => {
  const result = matchRobot(
    { name: 'Headphones', address: 'AA:BB:CC:DD:EE:FF', serviceUuids: [] },
    { nameFilter: 'Codie' },
  );
  assert.strictEqual(result.match, false);
});

test('matches by service UUID', () => {
  const result = matchRobot(
    { name: '', address: '00:07:80:66:F0:DA', serviceUuids: ['52af0001978a628dc8450a104ca2b8dd'] },
    { nameFilter: 'Codie', serviceUuids: ['52af0001-978a-628d-c845-0a104ca2b8dd'] },
  );
  assert.strictEqual(result.match, true);
  assert.ok(result.reasons.includes('service-uuid'));
});

test('macOnly accepts allowlisted regardless of name/UUID', () => {
  const result = matchRobot(
    { name: 'Other', address: '00:07:80:66:F0:DA', serviceUuids: [] },
    { nameFilter: 'Codie', macAllowlist: ['00:07:80:66:F0:DA'], macOnly: true },
  );
  assert.strictEqual(result.match, true);
});

test('macAllowlist blocks non-allowlisted', () => {
  const result = matchRobot(
    { name: 'Codie', address: 'AA:BB:CC:DD:EE:FF', serviceUuids: [] },
    { nameFilter: 'Codie', macAllowlist: ['00:07:80:66:F0:DA'] },
  );
  assert.strictEqual(result.match, false);
  assert.ok(result.reasons.includes('not-allowlisted'));
});

test('normalize name matching is case-insensitive', () => {
  const result = matchRobot(
    { name: 'codie 2', address: 'AA:BB:CC:DD:EE:FF', serviceUuids: [] },
    { nameFilter: 'Codie' },
  );
  assert.strictEqual(result.match, true);
});
