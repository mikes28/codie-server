/**
 * Codie BLE wire-protocol — frame encoding/decoding (JavaScript port).
 *
 * The routing generation frame: INFO(1) | SEQ(2) | CMD(2) | ARGLEN(2) | ARG…
 * All multi-byte fields little-endian. 20 byte buffer, only the filled part
 * is sent.
 *
 * This is a 1:1 port of the Python `codie/wire.py` reference — the
 * `server/test/parity.test.js` checks byte-for-byte equality.
 */

'use strict';

// --- BLE GATT identifiers -------------------------------------------------

export const SERVICE_UUID = '52af0001-978a-628d-c845-0a104ca2b8dd';
export const WRITE_UUID = '52af0002-978a-628d-c845-0a104ca2b8dd';
export const NOTIFY_UUID = '52af0003-978a-628d-c845-0a104ca2b8dd';

/** Canonical UUID form: lowercase, no dashes, Bluetooth short form expanded.
 * The BLE bindings return the dashless form, so all comparisons use it. */
export function canonicalUuid(uuid) {
  if (!uuid) return '';
  return String(uuid).replace(/-/g, '').toLowerCase();
}

/** Are two UUIDs equal (format-independent)? */
export function sameUuid(a, b) {
  return Boolean(a) && Boolean(b) && canonicalUuid(a) === canonicalUuid(b);
}

// --- Roles (ordinal) and priority ----------------------------------------

export const ROLE_APP = 0;
export const ROLE_MCU = 1;
export const ROLE_BLE = 2;
export const ROLE_BROADCAST = 3;

export const PRIO_NORMAL = 0x00;
export const PRIO_HIGH = 0x08;

// --- Command IDs (CodieCommandType) --------------------------------------

export const CMD_DRIVE_SPEED = 0x1060; // leftSpeed i8, rightSpeed i8 (%)
export const CMD_DRIVE_DISTANCE = 0x1061; // distance u16 (mm), leftSpeed i8, rightSpeed i8
export const CMD_DRIVE_TURN = 0x1062; // degree u16 (°), speed i8 (+ left, - right)
export const CMD_SONAR = 0x1063; // (sensor) -> range u16 (mm)
export const CMD_SPEAK_BEEP = 0x1064; // duration u16 (ms, max 10000)
export const CMD_LED_SET_COLOR = 0x1065; // ledMask u16, hue u8, sat u8, val u8 (HSV 0-255!)
export const CMD_LED_START_ANIM = 0x1066; // built-in animation (params TBD)
export const CMD_APP_CONNECTED = 0x1067; // app connect notification to the MCU
export const CMD_APP_DISCONNECTED = 0x1068; // app disconnect notification
export const CMD_BATTERY = 0x1069; // (sensor) -> soc u8 (%)
export const CMD_LIGHT = 0x106a; // (sensor) -> u16 (12 bit)
export const CMD_LINE = 0x106b; // (sensor) -> left u16, right u16 (12 bit)
export const CMD_MIC = 0x106c; // (sensor) -> u16
export const CMD_BATTERY_VOLTAGE = 0x106e; // (sensor) -> u16; no reply on this firmware

/** Reply args start after INFO(1)+SEQ(2)+CMD(2)+ARGLEN(2)+REQSEQ(2) = 9. */
export const RESPONSE_ARG_POS = 9;

export const MAX_BEEP_MS = 10000;

// --- Colors ---------------------------------------------------------------
// Per the official Codie BLE API v1.0, hue/sat/val are 0-255.

export const COLORS_RGB = {
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  cyan: [0, 255, 255],
  yellow: [255, 255, 0],
  orange: [255, 165, 0],
};

const HEX_COLOR_RE = /^#?([0-9a-f]{6})$/i;

/** Hex string -> RGB values, or null if not a hex color. */
export function hexToRgb(value) {
  if (typeof value !== 'string') return null;
  const m = HEX_COLOR_RE.exec(value);
  if (!m) return null;
  const hex = m[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** Resolve a color (name or hex) to RGB values, or null. */
export function resolveColorRgb(color) {
  if (typeof color !== 'string') return null;
  const rgb = hexToRgb(color);
  if (rgb) return rgb;
  const key = color.toLowerCase();
  return COLORS_RGB[key] ?? null;
}

/** HSV color 0..255 scale (official Codie BLE API v1.0). */
export function colorHsv(color) {
  const rgb = resolveColorRgb(color);
  if (!rgb) return null;
  return rgbToHsv(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255).map((v) =>
    Math.round(v * 255)
  );
}

/** Python colorsys.rgb_to_hsv 1:1 port (r,g,b ∈ [0,1]); returns [h,s,v] 0..1. */
function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  if (d === 0) h = 0;
  else if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return [h / 360, s, max];
}

// --- Low-level byte helpers ----------------------------------------------

export function u16(value) {
  return Buffer.from([value & 0xff, (value >> 8) & 0xff]);
}

export function u8(value) {
  return Buffer.from([value & 0xff]);
}

/** Two's complement i8. */
export function i8(value) {
  return Buffer.from([value & 0xff]);
}

/** INFO byte: (sender<<4) | (dest<<6) | prio. */
export function infoByte(sender = ROLE_APP, dest = ROLE_MCU, prio = PRIO_NORMAL) {
  return ((sender << 4) | (dest << 6) | prio) & 0xff;
}

// --- Sequence counter -----------------------------------------------------

let seqCounter = 0;

export function nextSeq() {
  seqCounter = (seqCounter + 1) & 0xffff;
  return seqCounter;
}

export function resetSeq() {
  seqCounter = 0;
}

// --- Frame assembly -------------------------------------------------------

/** Build a request frame. Returns { frame, seq }. */
export function buildFrame(
  cmdId,
  args = Buffer.alloc(0),
  seq = null,
  sender = ROLE_APP,
  dest = ROLE_MCU,
  prio = PRIO_NORMAL
) {
  const s = seq === null ? nextSeq() : seq;
  const frame = Buffer.concat([
    Buffer.from([infoByte(sender, dest, prio)]),
    u16(s),
    u16(cmdId),
    u16(args.length),
    args,
  ]);
  return { frame, seq: s };
}

// --- Argument builders per command ---------------------------------------

export function beepArgs(durationMs) {
  return u16(Math.max(0, Math.min(durationMs, MAX_BEEP_MS)));
}

/** All 12 LEDs one color (ledMask = 0x0FFF). color: name or hex string. */
export function ledAllArgs(color) {
  const hsv = colorHsv(color);
  if (!hsv) return null;
  return Buffer.concat([u16(0x0fff), u8(hsv[0]), u8(hsv[1]), u8(hsv[2])]);
}

/** Single LED (index 1..12) set. */
export function ledSingleArgs(color, index) {
  const hsv = colorHsv(color);
  if (!hsv) return null;
  const ledMask = 1 << (index - 1);
  return Buffer.concat([u16(ledMask), u8(hsv[0]), u8(hsv[1]), u8(hsv[2])]);
}

export function driveSpeedArgs(left, right) {
  return Buffer.concat([i8(left), i8(right)]);
}

export function driveDistanceArgs(distanceMm, left, right) {
  return Buffer.concat([u16(distanceMm), i8(left), i8(right)]);
}

export function driveTurnArgs(degree, speed) {
  return Buffer.concat([u16(degree), i8(speed)]);
}

// --- Response decoding -----------------------------------------------------

/** Interpret a response frame arriving on the notify channel. */
export function decodeResponse(data) {
  if (!data || data.length < RESPONSE_ARG_POS) return null;
  const replySeq = data.readUInt16LE(7);
  const cmd = data.readUInt16LE(3);
  const args = data.subarray(RESPONSE_ARG_POS);
  return { replySeq, cmd, args };
}

export function readU16(args, offset) {
  return args.readUInt16LE(offset);
}

export function readU8(args, offset) {
  return args[offset];
}
