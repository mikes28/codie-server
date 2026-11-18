/**
 * High-level robot commands — the REST API, CLI scripts and console all use
 * these, so every surface behaves identically.
 *
 * Movement commands are finite (they stop by themselves). `turn` follows
 * the Python `mcp_server.py` convention: positive degrees = right.
 */

'use strict';

import * as p from './ble/protocol.js';
import * as np from './ble/protocol-norrouting.js';
import { COLORS_RGB } from './ble/protocol.js';

const DRIVE_SPEED = 40;
const TURN_SPEED = 40;
const MAX_DISTANCE_CM = 200;

const HEX_COLOR = /^#?[0-9a-fA-F]{6}$/;

export const COMMAND_NAMES = [
  'beep', 'morse', 'tune', 'led', 'ledSingle', 'ledsOff', 'ledAnim',
  'driveSpeed', 'forward', 'backward', 'turn', 'stop', 'status',
  'battery', 'sonar', 'light', 'line', 'mic', 'proxy',
];

/** Validate a number parameter. */
export function numberParam(value, name, { min, max, integer = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  if (integer && !Number.isInteger(n)) throw new Error(`${name} must be an integer`);
  if (min !== undefined && n < min) throw new Error(`${name} must be >= ${min}`);
  if (max !== undefined && n > max) throw new Error(`${name} must be <= ${max}`);
  return n;
}

/** Validate a color parameter (name or hex). */
export function colorParam(value, name) {
  const rgb = p.resolveColorRgb(value);
  if (!rgb) throw new Error(`Invalid ${name}: "${value}"`);
  return value;
}

/** A command was acknowledged — check nSuccessful. */
function requireAck(result, action) {
  if (!result) throw new Error(`${action}: no response`);
  const args = result.args;
  if (args && args.length >= 1 && args[0] !== 0) {
    throw new Error(`${action}: rejected by robot (nSuccessful=${args[0]})`);
  }
}

/** A sensor reading — null means the robot didn't answer. */
function requireReading(value, sensor) {
  if (value === null || value === undefined) {
    throw new Error(`${sensor}: no response from robot`);
  }
  return value;
}

/** Execute a high-level command on the client. */
export async function runCommand(client, name, params = {}) {
  switch (name) {
    // ----- LED -----
    case 'led': {
      colorParam(params.color, 'color');
      const mask = params.ledMask !== undefined ? params.ledMask : 0x0fff;
      await client.led(params.color, mask);
      return { action: 'led', color: params.color, ledMask: mask };
    }
    case 'ledSingle': {
      colorParam(params.color, 'color');
      const index = numberParam(params.index, 'index', { min: 1, max: 12, integer: true });
      await client.ledSingle(params.color, index);
      return { action: 'ledSingle', color: params.color, index };
    }
    case 'ledsOff': {
      const hsv = p.colorHsv('black') || [0, 0, 0];
      const args = Buffer.concat([p.u16(0), p.u8(hsv[0]), p.u8(hsv[1]), p.u8(hsv[2])]);
      const { frame } = p.buildFrame(p.CMD_LED_SET_COLOR, args);
      await client._sendFrameWithSeq(frame, p.nextSeq());
      return { action: 'ledsOff' };
    }
    case 'ledAnim': {
      const anim = numberParam(params.animation, 'animation', { min: 0, max: 1, integer: true });
      return { action: 'ledAnim', animation: anim };
    }

    // ----- Sound -----
    case 'beep': {
      const duration = numberParam(params.ms, 'ms', { min: 0, max: p.MAX_BEEP_MS, integer: true });
      await client.beep(duration);
      return { action: 'beep', ms: duration };
    }
    case 'morse': {
      const text = String(params.text ?? '');
      return { action: 'morse', text };
    }
    case 'tune': {
      const tune = params.name ?? params.tune;
      return { action: 'tune', name: tune };
    }

    // ----- Movement -----
    case 'forward': {
      const cm = numberParam(params.cm, 'cm', { min: 0, max: MAX_DISTANCE_CM });
      const mm = Math.round(cm * 10);
      const speed = numberParam(params.speed, 'speed', { min: -100, max: 100, integer: true }) ?? DRIVE_SPEED;
      await client.driveDistance(mm, speed, speed);
      return { action: 'forward', cm, mm, speed };
    }
    case 'backward': {
      const cm = numberParam(params.cm, 'cm', { min: 0, max: MAX_DISTANCE_CM });
      const mm = Math.round(cm * 10);
      const speed = numberParam(params.speed, 'speed', { min: -100, max: 100, integer: true }) ?? -DRIVE_SPEED;
      await client.driveDistance(mm, speed, speed);
      return { action: 'backward', cm, mm, speed };
    }
    case 'turn': {
      const deg = numberParam(params.deg, 'deg', { min: -360, max: 360, integer: true });
      const speed = numberParam(params.speed, 'speed', { min: -100, max: 100, integer: true }) ?? TURN_SPEED;
      await client.driveTurn(deg, speed);
      return { action: 'turn', deg, speed };
    }
    case 'stop': {
      await client.driveSpeed(0, 0);
      return { action: 'stop' };
    }
    case 'driveSpeed': {
      const left = numberParam(params.left, 'left', { min: -100, max: 100, integer: true });
      const right = numberParam(params.right, 'right', { min: -100, max: 100, integer: true });
      await client.driveSpeed(left, right);
      return { action: 'driveSpeed', left, right };
    }
    case 'proxy': {
      const text = String(params.text ?? '').trim();
      if (!text) throw new Error('proxy: text is required');
      const reply = await client.proxyCommand(text);
      return { action: 'proxy', text, reply };
    }

    default:
      throw new Error(`Unknown command: ${name}`);
  }
}
