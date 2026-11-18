/**
 * CodieClient — one robot's BLE connection.
 *
 * Handles connect/retry, notify subscription, SEQ↔REQSEQ pairing,
 * actuator and sensor methods, generation detection from the GATT layout,
 * and graceful error handling (a bad packet never kills the server).
 */

'use strict';

import { EventEmitter } from 'node:events';

import * as p from './protocol.js';
import * as np from './protocol-norrouting.js';
import { normalizeAddress } from './noble.js';
import * as m from '../morse.js';
import * as t from '../tunes.js';

/** How many reply frames the client keeps (debug only). */
const NOTIFICATION_HISTORY = 100;

/** General response timeout (ms) waiting for a command ack. */
const RESPONSE_TIMEOUT_MS = 2500;

/** GATT write duration guard. */
const WRITE_TIMEOUT_MS = 3000;

/** Full status fetch (4 sensors) must finish within this. */
const STATUS_TIMEOUT_MS = 10000;

/** Single sensor request timeout. The robot answers ~100 ms live, so
 * 1.2 s is plenty and a lost request won't stall the whole fetch. */
const QUERY_TIMEOUT_MS = 1200;

/** Mandatory gap between two BLE messages. The no-routing firmware drops
 * a message that follows too fast. */
const MIN_WRITE_GAP_MS = 150;

/** Mandatory gap between fire-and-forget (unacked) messages. */
const FIRE_AND_FORGET_GAP_MS = 150;

/** Beeper base frequency (~2483 Hz, measured in MEMORY.md). */
const DEFAULT_BEEP_FREQUENCY = 2483;
const DEFAULT_BEEP_VOLUME = 100;

export class CodieClient extends EventEmitter {
  constructor({ noble, address, variant = null, ...opts } = {}) {
    super();
    this.noble = noble;
    this.address = normalizeAddress(address);
    this.variant = variant; // 'routing' | 'no-routing' | null
    this.opts = {
      responseTimeoutMs: RESPONSE_TIMEOUT_MS,
      writeTimeoutMs: WRITE_TIMEOUT_MS,
      queryTimeoutMs: QUERY_TIMEOUT_MS,
      statusTimeoutMs: STATUS_TIMEOUT_MS,
      writeGapMs: MIN_WRITE_GAP_MS,
      fireAndForgetGapMs: FIRE_AND_FORGET_GAP_MS,
      ...opts,
    };

    this._peripheral = null;
    this._client = null;
    this._writeChar = null;
    this._notifyChar = null;
    this._reqChar = null;
    this._reqReplyChar = null;
    this._actionChar = null;
    this._actionReplyChar = null;

    this._connected = false;
    this._connecting = false;
    this._closing = false;

    this._pending = new Map(); // seq -> { resolve, reject, timer }
    this._notifications = [];
    this._lastWriteMs = 0;
    this._writeLock = Promise.resolve();

    this._reconnectAttempts = 0;
    this._autoReconnect = true;
    this._reconnecting = false;

    this._micStreaming = false;
    this._micTimer = null;

    this._telemetryTimer = null;
    this._telemetryMs = 0;

    this._sensors = {
      battery: null,
      sonar: null,
      light: null,
      line: null,
      mic: null,
    };
    this._rhythmDepth = 0;
  }

  // ------------------------------------------------------------------
  // connection
  // ------------------------------------------------------------------

  get connected() {
    return this._connected;
  }

  get connecting() {
    return this._connecting;
  }

  get reconnecting() {
    return this._reconnecting;
  }

  get micStreaming() {
    return this._micStreaming;
  }

  get sensors() {
    return { ...this._sensors };
  }

  async connect(peripheral) {
    if (this._connected || this._connecting) return this._connected;
    this._peripheral = peripheral;
    this._connecting = true;

    try {
      await this._peripheral.connectAsync();
      this._connected = true;
      this._connecting = false;
      this._reconnectAttempts = 0;
      this._setupCharacteristics();
      await this._subscribeNotify();
      this.emit('connect', { address: this.address, variant: this.variant });
      return true;
    } catch (error) {
      this._connecting = false;
      this.emit('error', { address: this.address, message: error.message });
      throw error;
    }
  }

  _setupCharacteristics() {
    const service = this._peripheral.services.find((s) =>
      p.sameUuid(s.uuid, p.SERVICE_UUID) ||
      (this.variant === 'no-routing' &&
        np.sameUuid(s.uuid, np.SERVICE_UUID))
    );
    if (!service) {
      throw new Error(`Codie service not found on ${this.address}`);
    }

    // routing generation: one write + one notify
    this._writeChar = service.characteristics.find((c) =>
      p.sameUuid(c.uuid, p.WRITE_UUID)
    );
    this._notifyChar = service.characteristics.find((c) =>
      p.sameUuid(c.uuid, p.NOTIFY_UUID)
    );

    // no-routing generation: request + action (+ two replies)
    if (this.variant === 'no-routing' || !this._writeChar) {
      this._reqChar = service.characteristics.find((c) =>
        np.sameUuid(c.uuid, np.REQUEST_UUID)
      );
      this._reqReplyChar = service.characteristics.find((c) =>
        np.sameUuid(c.uuid, np.REQUEST_REPLY_UUID)
      );
      this._actionChar = service.characteristics.find((c) =>
        np.sameUuid(c.uuid, np.ACTION_UUID)
      );
      this._actionReplyChar = service.characteristics.find((c) =>
        np.sameUuid(c.uuid, np.ACTION_REPLY_UUID)
      );
      if (!this._writeChar) this.variant = 'no-routing';
    }

    if (!this._writeChar && !this._actionChar) {
      throw new Error(`No writable characteristic on ${this.address}`);
    }
  }

  async _subscribeNotify() {
    if (this._notifyChar) {
      await this._notifyChar.subscribeAsync();
      this._notifyChar.on('data', (data) => this._onNotify(data));
    }
    if (this._reqReplyChar) {
      await this._reqReplyChar.subscribeAsync();
      this._reqReplyChar.on('data', (data) => this._onNotify(data));
    }
    if (this._actionReplyChar) {
      await this._actionReplyChar.subscribeAsync();
      this._actionReplyChar.on('data', (data) => this._onNotify(data));
    }
    this._peripheral.on('disconnect', () => this._onDisconnect());
  }

  _onNotify(data) {
    this._notifications.push(data);
    if (this._notifications.length > NOTIFICATION_HISTORY) {
      this._notifications.shift();
    }

    // routing generation: decode reply, match by SEQ
    const decoded = p.decodeResponse(data);
    if (decoded) {
      const { replySeq, cmd, args } = decoded;
      const pending = this._pending.get(replySeq);
      if (pending) {
        clearTimeout(pending.timer);
        this._pending.delete(replySeq);
        pending.resolve({ cmd, args });
        return;
      }
      // unmatched reply -> sensor telemetry
      this._handleSensorReply(cmd, args);
      return;
    }

    // no-routing generation: decode reply
    const ndecoded = np.decodeReply(data);
    if (ndecoded) {
      const { seq, cmd, args } = ndecoded;
      const pending = this._pending.get(seq);
      if (pending) {
        clearTimeout(pending.timer);
        this._pending.delete(seq);
        pending.resolve({ cmd, args });
        return;
      }
      this._handleSensorReply(cmd, args);
      return;
    }
  }

  _handleSensorReply(cmd, args) {
    // routing command IDs -> sensor
    if (cmd === p.CMD_BATTERY && args.length >= 1) {
      this._setSensor('battery', args[0]);
    } else if (cmd === p.CMD_SONAR && args.length >= 2) {
      this._setSensor('sonar', args.readUInt16LE(0));
    } else if (cmd === p.CMD_LIGHT && args.length >= 2) {
      this._setSensor('light', args.readUInt16LE(0));
    } else if (cmd === p.CMD_LINE && args.length >= 4) {
      this._setSensor('line', {
        left: args.readUInt16LE(0),
        right: args.readUInt16LE(2),
      });
    } else if (cmd === p.CMD_MIC && args.length >= 2) {
      this._setSensor('mic', args.readUInt16LE(0));
    }
    // no-routing command IDs -> sensor
    else if (cmd === np.QUERY_BATTERY && args.length >= 1) {
      this._setSensor('battery', np.normalizeBattery(args[0]));
    } else if (cmd === np.QUERY_DISTANCE && args.length >= 2) {
      this._setSensor('sonar', np.normalizeDistance(args.readUInt16LE(0)));
    } else if (cmd === np.QUERY_SOUND && args.length >= 2) {
      this._setSensor('mic', args.readUInt16LE(0));
    } else if (cmd === np.QUERY_LIGHT && args.length >= 2) {
      this._setSensor('light', args.readUInt16LE(0));
    } else if (cmd === np.QUERY_LINE && args.length >= 4) {
      this._setSensor('line', np.decodeLine(args));
    }
  }

  _setSensor(key, value) {
    const prev = this._sensors[key];
    this._sensors[key] = value;
    if (prev !== value) {
      this.emit('sensor', { address: this.address, sensor: key, value });
    }
  }

  _onDisconnect() {
    if (this._closing) return;
    this._connected = false;
    this._clearPending(new Error('disconnected'));
    this._stopTelemetry();
    this._stopMic();
    this.emit('disconnect', { address: this.address });
    if (this._autoReconnect && !this._reconnecting) {
      this._reconnecting = true;
      this.emit('reconnecting', { address: this.address });
      this._attemptReconnect();
    }
  }

  async _attemptReconnect() {
    let attempts = 0;
    while (attempts < this.opts.reconnectAttempts && !this._connected) {
      attempts += 1;
      this._reconnectAttempts = attempts;
      try {
        await sleep(this.opts.reconnectDelayMs);
        if (this._closing) return;
        await this.connect(this._peripheral);
        return;
      } catch (error) {
        // keep trying
      }
    }
    this._reconnecting = false;
    this.emit('reconnect-failed', { address: this.address });
  }

  async disconnect() {
    this._closing = true;
    this._autoReconnect = false;
    this._reconnecting = false;
    this._stopTelemetry();
    this._stopMic();
    this._clearPending(new Error('disconnecting'));
    if (this._peripheral) {
      try {
        await this._peripheral.disconnectAsync();
      } catch (e) {
        // ignore
      }
    }
    this._connected = false;
    this._peripheral = null;
    this.emit('disconnect', { address: this.address });
  }

  _clearPending(reason) {
    for (const [, pending] of this._pending) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    this._pending.clear();
  }

  // ------------------------------------------------------------------
  // writing with gap enforcement
  // ------------------------------------------------------------------

  async _withWriteGap(fn, fireAndForget = false) {
    await this._writeLock;
    this._writeLock = (async () => {
      const now = Date.now();
      const elapsed = now - this._lastWriteMs;
      const minGap = fireAndForget ? this.opts.fireAndForgetGapMs : this.opts.writeGapMs;
      if (elapsed < minGap) await sleep(minGap - elapsed);
      try {
        await fn();
      } finally {
        this._lastWriteMs = Date.now();
      }
    })();
    return this._writeLock;
  }

  async _writeBuffer(buffer, fireAndForget = false) {
    const char = fireAndForget ? this._writeChar : this._writeChar;
    if (!char) throw new Error(`No write characteristic for ${this.address}`);
    return this._withWriteGap(async () => {
      await char.writeAsync(buffer, !fireAndForget);
    }, fireAndForget);
  }

  // ------------------------------------------------------------------
  // command request/response
  // ------------------------------------------------------------------

  async sendCommand(frame, timeoutMs = null) {
    if (!this._connected) throw new Error(`Robot ${this.address} not connected`);
    const { frame: f, seq } = p.buildFrame(frame.cmdId, frame.args);
    return this._sendFrameWithSeq(f, seq, timeoutMs);
  }

  async _sendFrameWithSeq(buffer, timeoutMs = null) {
    if (!this._connected) throw new Error(`Robot ${this.address} not connected`);
    const seq = buffer.readUInt16LE(1);
    const timeout = timeoutMs ?? this.opts.responseTimeoutMs;
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(seq);
        reject(new Error(`Command ${seq.toString(16)} timeout`));
      }, timeout);
      this._pending.set(seq, { resolve, reject, timer });
    });

    await this._writeBuffer(buffer);
    return promise;
  }

  // ------------------------------------------------------------------
  // high-level commands (routing generation)
  // ------------------------------------------------------------------

  async beep(durationMs) {
    if (!this._connected) throw new Error(`Robot ${this.address} not connected`);
    const args = p.beepArgs(durationMs);
    const { frame } = p.buildFrame(p.CMD_SPEAK_BEEP, args);
    return this._sendFrameWithSeq(frame);
  }

  async led(color, mask = 0x0fff) {
    const hsv = p.colorHsv(color);
    if (!hsv) throw new Error(`Unknown color: ${color}`);
    const args = Buffer.concat([p.u16(mask), p.u8(hsv[0]), p.u8(hsv[1]), p.u8(hsv[2])]);
    const { frame } = p.buildFrame(p.CMD_LED_SET_COLOR, args);
    return this._sendFrameWithSeq(frame);
  }

  async ledSingle(color, index) {
    const args = p.ledSingleArgs(color, index);
    if (!args) throw new Error(`Unknown color: ${color}`);
    const { frame } = p.buildFrame(p.CMD_LED_SET_COLOR, args);
    return this._sendFrameWithSeq(frame);
  }

  async driveSpeed(left, right) {
    const args = p.driveSpeedArgs(left, right);
    const { frame } = p.buildFrame(p.CMD_DRIVE_SPEED, args);
    return this._sendFrameWithSeq(frame);
  }

  async driveDistance(distanceMm, left, right) {
    const args = p.driveDistanceArgs(distanceMm, left, right);
    const { frame } = p.buildFrame(p.CMD_DRIVE_DISTANCE, args);
    return this._sendFrameWithSeq(frame);
  }

  async driveTurn(degree, speed) {
    const args = p.driveTurnArgs(degree, speed);
    const { frame } = p.buildFrame(p.CMD_DRIVE_TURN, args);
    return this._sendFrameWithSeq(frame);
  }

  async proxyCommand(text) {
    if (!this._connected) throw new Error(`Robot ${this.address} not connected`);
    const args = Buffer.from(text, 'utf8');
    const { frame } = p.buildFrame(p.CMD_CONSOLE, args);
    return this._sendFrameWithSeq(frame);
  }

  // ------------------------------------------------------------------
  // sensor reads
  // ------------------------------------------------------------------

  async readSensor(cmdId, timeoutMs = null) {
    const { frame } = p.buildFrame(cmdId);
    return this._sendFrameWithSeq(frame, timeoutMs);
  }

  async battery() {
    const res = await this.readSensor(p.CMD_BATTERY, this.opts.queryTimeoutMs);
    return res.args.length >= 1 ? res.args[0] : null;
  }

  async sonar() {
    const res = await this.readSensor(p.CMD_SONAR, this.opts.queryTimeoutMs);
    return res.args.length >= 2 ? res.args.readUInt16LE(0) : null;
  }

  async light() {
    const res = await this.readSensor(p.CMD_LIGHT, this.opts.queryTimeoutMs);
    return res.args.length >= 2 ? res.args.readUInt16LE(0) : null;
  }

  async line() {
    const res = await this.readSensor(p.CMD_LINE, this.opts.queryTimeoutMs);
    return res.args.length >= 4
      ? { left: res.args.readUInt16LE(0), right: res.args.readUInt16LE(2) }
      : null;
  }

  async mic() {
    const res = await this.readSensor(p.CMD_MIC, this.opts.queryTimeoutMs);
    return res.args.length >= 2 ? res.args.readUInt16LE(0) : null;
  }

  async status() {
    const t0 = Date.now();
    const results = {};
    const remaining = () => this.opts.statusTimeoutMs - (Date.now() - t0);
    try {
      results.battery = await this.battery();
      if (remaining() <= 0) throw new Error('status timeout');
      results.sonar = await this.sonar();
      if (remaining() <= 0) throw new Error('status timeout');
      results.light = await this.light();
      if (remaining() <= 0) throw new Error('status timeout');
      results.line = await this.line();
    } catch (error) {
      throw new Error(`status fetch failed: ${error.message}`);
    }
    return results;
  }

  // ------------------------------------------------------------------
  // telemetry polling
  // ------------------------------------------------------------------

  startTelemetry(ms = null) {
    this._stopTelemetry();
    this._telemetryMs = ms ?? this.opts.telemetryMs ?? 250;
    if (this._telemetryMs <= 0) return;
    this._pollTelemetry();
  }

  _pollTelemetry() {
    if (!this._connected || this._telemetryMs <= 0) return;
    this._fetchTelemetry()
      .then(() => {
        this._telemetryTimer = setTimeout(() => this._pollTelemetry(), this._telemetryMs);
      })
      .catch(() => {
        this._telemetryTimer = setTimeout(() => this._pollTelemetry(), this._telemetryMs);
      });
  }

  async _fetchTelemetry() {
    if (this._micStreaming) return;
    const results = {};
    results.battery = await this.battery();
    results.sonar = await this.sonar();
    results.light = await this.light();
    results.line = await this.line();
    this.emit('telemetry', { address: this.address, ...results });
  }

  _stopTelemetry() {
    clearTimeout(this._telemetryTimer);
    this._telemetryTimer = null;
  }

  // ------------------------------------------------------------------
  // microphone stream
  // ------------------------------------------------------------------

  startMic(ms = null) {
    this._stopMic();
    this._micStreaming = true;
    const period = ms ?? this.opts.micMs ?? 200;
    this._micTimer = setInterval(() => {
      this.mic()
        .then((level) => this.emit('mic', { address: this.address, raw: level, level }))
        .catch(() => {});
    }, period);
    this._micTimer.ref ? this._micTimer.ref() : null;
    // immediate first read
    this.mic()
      .then((level) => this.emit('mic', { address: this.address, raw: level, level }))
      .catch(() => {});
  }

  _stopMic() {
    this._micStreaming = false;
    if (this._micTimer) {
      clearInterval(this._micTimer);
      this._micTimer = null;
    }
  }

  // ------------------------------------------------------------------
  // no-routing generation commands
  // ------------------------------------------------------------------

  async nrSendRequest(queryId) {
    if (!this._connected) throw new Error(`Robot ${this.address} not connected`);
    if (!this._reqChar) throw new Error(`No request characteristic`);
    const buffer = np.buildFrame(np.CMD_ECHO, [queryId], p.nextSeq());
    return this._sendFrameNoRouting(buffer, this._reqChar, this.opts.queryTimeoutMs);
  }

  async nrSendAction(params) {
    if (!this._connected) throw new Error(`Robot ${this.address} not connected`);
    if (!this._actionChar) throw new Error(`No action characteristic`);
    const buffer = np.buildFrame(np.CMD_SET_COLOR, params, p.nextSeq());
    return this._sendFrameNoRouting(buffer, this._actionChar, this.opts.responseTimeoutMs);
  }

  async _sendFrameNoRouting(buffer, char, timeoutMs) {
    const seq = buffer.readUInt16LE(0);
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(seq);
        reject(new Error(`No-routing command ${seq.toString(16)} timeout`));
      }, timeoutMs);
      this._pending.set(seq, { resolve, reject, timer });
    });
    await this._writeBuffer(buffer, true);
    return promise;
  }

  async nrBeep(durationMs, volume = DEFAULT_BEEP_VOLUME, frequency = DEFAULT_BEEP_FREQUENCY) {
    const params = [volume, ...np.u16(frequency), ...np.u16(durationMs)];
    const { frame } = p.buildFrame(np.CMD_BEEP, params);
    return this._sendFrameWithSeq(frame);
  }

  async nrLed(color) {
    const cp = np.colorParams(color);
    if (!cp) throw new Error(`Unknown color: ${color}`);
    const params = [cp.hue, cp.sat, cp.val];
    const { frame } = p.buildFrame(np.CMD_SET_COLOR, params);
    return this._sendFrameWithSeq(frame);
  }

  async nrMove(distanceMm, left, right) {
    const params = [...np.u16(distanceMm), np.i8(left), np.i8(right)];
    const { frame } = p.buildFrame(np.CMD_MOVE, params);
    return this._sendFrameWithSeq(frame);
  }

  async nrTurn(degree, speed) {
    const params = [...np.u16(degree), np.i8(speed)];
    const { frame } = p.buildFrame(np.CMD_TURN, params);
    return this._sendFrameWithSeq(frame);
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
