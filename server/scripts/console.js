#!/usr/bin/env node
/**
 * Interactive robot console — uses the backend modules directly (the same
 * commands the REST API and the website use).
 *
 * Commands: help, scan, robots, connect <addr>, disconnect, use <addr>,
 * status, battery, sonar, light, line, mic, led <color> [index],
 * leds off, anim <0|1> [color], beep [ms], morse <text>, tune <name>,
 * forward [cm], backward [cm], turn <deg>, stop, quit.
 */

import readline from 'node:readline';

import { config, registryOptions } from './src/config.js';
import { getNoble, ensurePoweredOn } from './src/ble/noble.js';
import { RobotRegistry } from './src/ble/registry.js';
import { formatRobotTable, formatTelemetry, finish } from './src/cli.js';

const registry = new RobotRegistry({
  noble: getNoble({ adapterId: config.ble.adapterId }),
  filters: config.ble,
  ...registryOptions(config.ble),
});

let activeAddress = null;

const HELP = `
Codie console — available commands:
  help                          show this help
  scan [ms]                     scan for Codie robots
  robots                        list known robots
  connect <addr>                connect to a robot
  disconnect                    disconnect the active robot
  use <addr>                    set the active robot
  status                        full sensor status
  battery                       battery percentage
  sonar                         distance in mm
  light                         ambient light
  line                          line sensor values
  mic                           microphone level
  led <color> [index]           set LED color (all, or single LED index 1-12)
  leds off                      turn all LEDs off
  anim <0|1> [color]            LED animation
  beep [ms]                     beep duration in ms (default 500)
  morse <text>                  send Morse code
  tune <name>                   play a built-in tune
  forward [cm]                  drive forward cm (default 10)
  backward [cm]                 drive backward cm (default 10)
  turn <deg>                    turn degrees (positive = right)
  stop                          stop the motors
  quit                          exit
`;

function printActive() {
  if (!activeAddress) {
    console.log('(no active robot — use "connect <addr>" or "use <addr>")');
    return;
  }
  const robot = registry.get(activeAddress);
  console.log(
    `Active: ${activeAddress} (${robot ? robot.variant ?? 'unknown' : '?'}) connected=${
      robot ? robot.connected : false
    }`,
  );
}

async function handle(line) {
  const tokens = line.trim().split(/\s+/);
  const cmd = tokens[0].toLowerCase();
  const args = tokens.slice(1);

  switch (cmd) {
    case 'help':
      console.log(HELP);
      break;
    case 'scan': {
      const durationMs = Number(args[0] ?? config.ble.scanMs);
      console.log(`Scanning ${durationMs / 1000} s…`);
      const robots = await registry.scan({ durationMs });
      console.log(formatRobotTable(robots));
      break;
    }
    case 'robots': {
      const robots = registry.list();
      console.log(formatRobotTable(robots));
      break;
    }
    case 'connect': {
      if (!args[0]) {
        console.error('Usage: connect <addr>');
        break;
      }
      try {
        await registry.connect(args[0]);
        activeAddress = args[0];
        printActive();
      } catch (error) {
        console.error(`Connect failed: ${error.message}`);
      }
      break;
    }
    case 'disconnect': {
      if (activeAddress) {
        await registry.disconnect(activeAddress);
        activeAddress = null;
      }
      console.log('Disconnected.');
      break;
    }
    case 'use': {
      if (!args[0]) {
        console.error('Usage: use <addr>');
        break;
      }
      activeAddress = args[0];
      printActive();
      break;
    }
    case 'status': {
      if (!activeAddress) {
        console.error('No active robot.');
        break;
      }
      try {
        const result = await registry.command(activeAddress, 'status', {});
        console.log(formatTelemetry(result));
      } catch (error) {
        console.error(`Status failed: ${error.message}`);
      }
      break;
    }
    case 'battery':
    case 'sonar':
    case 'light':
    case 'line':
    case 'mic': {
      if (!activeAddress) {
        console.error('No active robot.');
        break;
      }
      try {
        const result = await registry.command(activeAddress, cmd, {});
        console.log(formatTelemetry(result));
      } catch (error) {
        console.error(`${cmd} failed: ${error.message}`);
      }
      break;
    }
    case 'led': {
      if (!activeAddress) {
        console.error('No active robot.');
        break;
      }
      const color = args[0] ?? 'red';
      const index = args[1] ? Number(args[1]) : undefined;
      try {
        if (index) {
          await registry.command(activeAddress, 'ledSingle', { color, index });
        } else {
          await registry.command(activeAddress, 'led', { color });
        }
        console.log(`LED ${index ?? 'all'} -> ${color}`);
      } catch (error) {
        console.error(`LED failed: ${error.message}`);
      }
      break;
    }
    case 'leds': {
      if (args[0] === 'off') {
        await registry.command(activeAddress, 'ledsOff', {});
        console.log('LEDs off');
      } else {
        console.error('Usage: leds off');
      }
      break;
    }
    case 'anim': {
      const animation = Number(args[0] ?? 0);
      const color = args[1] ?? 'white';
      await registry.command(activeAddress, 'ledAnim', { animation, color });
      console.log(`Animation ${animation} (${color})`);
      break;
    }
    case 'beep': {
      const ms = Number(args[0] ?? 500);
      await registry.command(activeAddress, 'beep', { ms });
      console.log(`Beep ${ms} ms`);
      break;
    }
    case 'morse': {
      const text = args.join(' ') ?? 'SOS';
      await registry.command(activeAddress, 'morse', { text });
      console.log(`Morse: ${text}`);
      break;
    }
    case 'tune': {
      const name = args[0] ?? 'shave_haircut';
      await registry.command(activeAddress, 'tune', { name });
      console.log(`Tune: ${name}`);
      break;
    }
    case 'forward': {
      const cm = Number(args[0] ?? 10);
      await registry.command(activeAddress, 'forward', { cm });
      console.log(`Forward ${cm} cm`);
      break;
    }
    case 'backward': {
      const cm = Number(args[0] ?? 10);
      await registry.command(activeAddress, 'backward', { cm });
      console.log(`Backward ${cm} cm`);
      break;
    }
    case 'turn': {
      const deg = Number(args[0]);
      if (!deg && deg !== 0) {
        console.error('Usage: turn <deg>');
        break;
      }
      await registry.command(activeAddress, 'turn', { deg });
      console.log(`Turn ${deg} deg`);
      break;
    }
    case 'stop': {
      await registry.command(activeAddress, 'stop', {});
      console.log('Stopped');
      break;
    }
    case 'quit':
    case 'exit':
      return false;
    case '':
      break;
    default:
      console.error(`Unknown command: ${cmd}. Type "help".`);
  }
  return true;
}

try {
  await ensurePoweredOn(registry.scanner.noble, 10000);
} catch (error) {
  console.warn(`BLE adapter unavailable: ${error.message}`);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let queue = Promise.resolve();
let closing = false;
rl.prompt();

console.log('Codie console — "help" for commands, "quit" to exit.');
console.log(
  `Filter: name="${config.ble.nameFilter}", allowlist=${config.ble.macAllowlist.join(',') || '(none)'}`,
);

rl.on('line', (line) => {
  if (closing) return;
  queue = queue.then(() => handle(line)).then((cont) => {
    if (cont === false) {
      closing = true;
      rl.close();
    } else {
      rl.prompt();
    }
  });
});

rl.on('close', async () => {
  await registry.shutdown();
  finish(0, registry.noble);
});
