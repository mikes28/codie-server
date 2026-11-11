#!/usr/bin/env node
/**
 * Run a single command on a robot (non-interactive).
 *
 *   node scripts/control.js --robot 00:07:80:66:F0:DA led red
 *   node scripts/control.js --robot <ADDRESS> forward 20
 *   node scripts/control.js led red            # --robot omitted: scan, then first match
 *   node scripts/control.js --robot <ADDRESS> status --json
 *
 * Commands follow the semantics of src/commands.js — the same layer used by
 * the REST API and the console.
 */

import { config, registryOptions } from './src/config.js';
import { getNoble, ensurePoweredOn } from './src/ble/noble.js';
import { RobotRegistry } from './src/ble/registry.js';
import { parseArgs, formatTelemetry, finish } from './src/cli.js';

const { _: positional, flags } = parseArgs(process.argv.slice(2));

const commandName = positional[0];
if (!commandName) {
  console.error(
    'Usage: node scripts/control.js [--robot <ADDRESS>] <command> [value]\n' +
      'Commands: led|leds|anim|beep|morse|tune|forward|backward|turn|stop|status|battery|sonar|light|line|mic',
  );
  process.exit(2);
}

const args = positional.slice(1);
const registry = new RobotRegistry({
  noble: getNoble({ adapterId: config.ble.adapterId }),
  filters: config.ble,
  ...registryOptions(config.ble),
  telemetryMs: 0,
});

function buildCommand() {
  switch (commandName) {
    case 'led': {
      const color = args[0] ?? 'red';
      return { name: 'led', params: { color } };
    }
    case 'leds':
    case 'ledsOff': {
      return { name: 'ledsOff', params: {} };
    }
    case 'anim': {
      const animation = Number(args[0] ?? 0);
      return { name: 'ledAnim', params: { animation } };
    }
    case 'beep': {
      const ms = Number(args[0] ?? 500);
      return { name: 'beep', params: { ms } };
    }
    case 'morse': {
      const text = args.join(' ') ?? 'SOS';
      return { name: 'morse', params: { text } };
    }
    case 'tune': {
      const name = args[0] ?? 'shave_haircut';
      return { name: 'tune', params: { name } };
    }
    case 'forward': {
      const cm = Number(args[0] ?? 10);
      return { name: 'forward', params: { cm } };
    }
    case 'backward': {
      const cm = Number(args[0] ?? 10);
      return { name: 'backward', params: { cm } };
    }
    case 'turn': {
      const deg = Number(args[0] ?? 90);
      return { name: 'turn', params: { deg } };
    }
    case 'stop': {
      return { name: 'stop', params: {} };
    }
    case 'status': {
      return { name: 'status', params: {} };
    }
    case 'battery': {
      return { name: 'battery', params: {} };
    }
    case 'sonar': {
      return { name: 'sonar', params: {} };
    }
    case 'light': {
      return { name: 'light', params: {} };
    }
    case 'line': {
      return { name: 'line', params: {} };
    }
    case 'mic': {
      return { name: 'mic', params: {} };
    }
    default: {
      console.error(`Unknown command: ${commandName}`);
      process.exit(2);
    }
  }
}

const command = buildCommand();
if (!command) {
  process.exit(2);
} else {
  await run(command);
}

async function run(command) {
  await ensurePoweredOn(registry.scanner.noble, 10000);

  let address = flags.robot;
  if (!address) {
    // scan, then use the first match
    const robots = await registry.scan({ durationMs: config.ble.scanMs });
    if (!robots.length) {
      console.error('No Codie robots found.');
      finish(1, registry.noble);
      return;
    }
    address = robots[0].address;
  }

  let robot;
  try {
    robot = await registry.connect(address);
  } catch (error) {
    console.error(`Connect failed: ${error.message}`);
    finish(1, registry.noble);
    return;
  }

  try {
    const result = await registry.command(address, command.name, command.params);
    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const telemetry = {};
      if (result.battery !== undefined) telemetry.battery = result.battery;
      if (result.sonar !== undefined) telemetry.sonar = result.sonar;
      if (result.light !== undefined) telemetry.light = result.light;
      if (result.line !== undefined) telemetry.line = result.line;
      if (result.mic !== undefined) telemetry.mic = result.mic;
      if (Object.keys(telemetry).length) {
        console.log(formatTelemetry(telemetry));
      } else {
        console.log(`OK: ${command.name}`);
      }
    }
  } catch (error) {
    console.error(`Command failed: ${error.message}`);
    finish(1, registry.noble);
    return;
  }

  await registry.disconnect(address);
  finish(0, registry.noble);
}
