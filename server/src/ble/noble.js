/**
 * Noble (BlueZ D-Bus binding) instance — the backend's single BLE "radio",
 * so multiple robots can be handled at the same time.
 *
 * The D-Bus binding talks to the system BlueZ service, so it works
 * alongside `bluetoothctl` and needs neither root nor `setcap`.
 */

'use strict';

import { withBindings } from '@stoprocent/noble';

let instance = null;

/** @returns {import('@stoprocent/noble').Noble} */
export function getNoble({ adapterId = 'hci0' } = {}) {
  if (!instance) {
    instance = withBindings('dbus', { adapterId });
  }
  return instance;
}

/** Wait until the adapter is powered on. */
export async function ensurePoweredOn(noble, timeoutMs = 10000) {
  if (noble.state === 'poweredOn') return;
  await noble.waitForPoweredOnAsync(timeoutMs);
}

/** Normalize a BLE address into "00:07:80:66:F0:DA" form. */
export function normalizeAddress(address) {
  if (!address) return '';
  const hex = String(address).replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length !== 12) return String(address).toUpperCase();
  return hex.match(/.{2}/g).join(':');
}
