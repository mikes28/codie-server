/**
 * CodieClient unit tests with a fake BLE transport (no hardware).
 */

'use strict';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { CodieClient } from '../src/ble/client.js';
import * as p from '../src/ble/protocol.js';

/** Minimal fake characteristic with a configurable UUID. */
function makeChar(uuid) {
  const listeners = new Map();
  return {
    uuid,
    async writeAsync() {},
    async subscribeAsync() {},
    on(event, fn) {
      if (event === 'data') listeners.set('data', fn);
    },
    _emit(data) {
      listeners.get('data')?.(data);
    },
  };
}

/** Minimal fake peripheral with the routing service. */
function makePeripheral() {
  const writeChar = makeChar(p.WRITE_UUID);
  const notifyChar = makeChar(p.NOTIFY_UUID);
  return {
    address: '00:07:80:66:F0:DA',
    services: [
      {
        uuid: p.SERVICE_UUID,
        characteristics: [writeChar, notifyChar],
      },
    ],
    async connectAsync() {},
    async disconnectAsync() {},
    on() {},
  };
}

/** Build a fake reply notification for a given seq and cmd. */
function fakeReply(seq, cmd, args = Buffer.alloc(0)) {
  return Buffer.concat([
    Buffer.from([0x10]), // INFO
    p.u16(seq),          // SEQ (echoed)
    p.u16(cmd | 0x8000), // CMD with reply flag
    p.u16(2 + args.length), // ARGLEN = reply-SEQ(2) + ReARG
    p.u16(seq),          // reply-SEQ
    args,                // ReARG
  ]);
}

test('sendCommand sends a framed request and resolves on reply', async () => {
  const peripheral = makePeripheral();
  const client = new CodieClient({ noble: null, address: peripheral.address });
  client._peripheral = peripheral;
  client._connected = true;
  client._writeChar = peripheral.services[0].characteristics[0];
  client._notifyChar = peripheral.services[0].characteristics[1];
  // Wire up the notify listener (normally done in _subscribeNotify during connect)
  client._notifyChar.on('data', (data) => client._onNotify(data));

  const writes = [];
  client._writeChar.writeAsync = async (buf) => {
    writes.push(Buffer.from(buf));
  };

  const promise = client.beep(1000);
  // Let the write gap (150 ms) elapse so the write actually fires
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(writes.length, 1);
  const frame = writes[0];
  // Frame: INFO(1) | SEQ(2) | CMD(2) | ARGLEN(2) | ARG...
  assert.strictEqual(frame[0], 0x40);
  assert.strictEqual(frame.readUInt16LE(3), 0x1064);
  assert.strictEqual(frame.readUInt16LE(5), 2);
  assert.strictEqual(frame[7], 0xe8);
  assert.strictEqual(frame[8], 0x03);

  // Simulate the robot's reply notification resolving the pending promise
  const seq = frame.readUInt16LE(1);
  client._notifyChar._emit(fakeReply(seq, 0x1064, Buffer.from([0x00])));

  await promise;
});

test('rejects when not connected', async () => {
  const client = new CodieClient({ noble: null, address: '00:00:00:00:00:00' });
  await assert.rejects(() => client.beep(500), /not connected/);
});
