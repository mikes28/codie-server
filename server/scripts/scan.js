#!/usr/bin/env node
/**
 * Robot discovery — only Codie robots are shown (other BLE devices filtered).
 *
 *   node scripts/scan.js
 *   node scripts/scan.js --duration 20000
 *   node scripts/scan.js --name Codie --mac DF:74:94:43:36:ED
 *   node scripts/scan.js --json
 *
 * Filtering can be overridden via environment variables:
 *   CODIE_ROBOT_NAME, CODIE_ROBOT_UUIDS, CODIE_MAC_ALLOWLIST, CODIE_MAC_ONLY
 */

import { config } from './src/config.js';
import { getNoble, ensurePoweredOn } from './src/ble/noble.js';
import { RobotScanner } from './src/ble/scanner.js';
import { parseArgs, flagEnabled, formatRobotTable, finish } from './src/cli.js';

const { _: positional, flags } = parseArgs(process.argv.slice(2));

if (flags.help || flags.h) {
  console.log(
    'Usage: node scripts/scan.js [--duration <ms>] [--name <name>] [--mac <addr>] [--json]\n' +
      'Scans for Codie robots in the environment (other BLE devices filtered out).',
  );
  process.exit(0);
}

const filters = {
  ...config.ble,
  nameFilter: flags.name ?? config.ble.nameFilter,
  macAllowlist: flags.mac ? [flags.mac] : config.ble.macAllowlist,
  macOnly: flags['mac-only'] !== undefined ? flagEnabled(flags['mac-only']) : config.ble.macOnly,
};

const durationMs = Number(flags.duration ?? flags.d ?? positional[0] ?? config.ble.scanMs);

const noble = getNoble({ adapterId: config.ble.adapterId });
await ensurePoweredOn(noble, 10000);

const scanner = new RobotScanner({ noble, filters });
console.log(
  `Scanning ${Math.round(durationMs / 1000)} s (filter: name="${filters.nameFilter}", ` +
    `allowlist=${filters.macAllowlist.join(',') || '(none)'})…`,
);

const robots = await scanner.scan({ durationMs });

if (flags.json) {
  console.log(JSON.stringify(robots, null, 2));
} else {
  console.log(formatRobotTable(robots));
  if (robots.length) {
    console.log('\nConnect: node scripts/control.js --robot <ADDRESS> status');
  }
}

finish(0, noble);
