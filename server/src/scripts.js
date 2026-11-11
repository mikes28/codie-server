/**
 * Robot scripts — launch the Python communication script and forward its
 * events.
 *
 * The BLE layer lives in the Node backend, so the scripts talk to the robot
 * through the backend's REST API. The Python side (`python/codie_comm.py`)
 * executes the steps and writes JSON-line events to stdout; those are read
 * here and forwarded to the browser.
 *
 * One script at a time per robot — a new start returns 409.
 */

'use strict';

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Where the Python layer lives (codie_comm.py + scripts/). */
export const pythonDir = path.join(here, '..', 'python');
/** The script runner entry point. */
export const enginePath = path.join(pythonDir, 'codie_comm.py');
/** Default location of the robot scripts. */
export const defaultScriptDir = path.join(pythonDir, 'scripts');

/**
 * List the available scripts by asking the runner (`--list`), so the
 * Node side doesn't have to parse Python files.
 */
export async function listScripts({
  python = 'python3',
  scriptDir = defaultScriptDir,
} = {}) {
  const { stdout } = await runProcess(python, [enginePath, '--list', `--script-dir=${scriptDir}`]);
  try {
    return JSON.parse(stdout);
  } catch (e) {
    return [];
  }
}

/** The firmware interface register (the robot's real command surface). */
export async function firmwareSurface({ python = 'python3' } = {}) {
  const { stdout } = await runProcess(python, [enginePath, '--firmware']);
  try {
    return JSON.parse(stdout);
  } catch (e) {
    return {};
  }
}

/** Run a process and collect its output. */
async function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(command, args);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr, code });
      else reject(new Error(`${command} exited ${code}: ${stderr}`));
    });
    child.on('error', reject);
  });
}

/** The script runner — one script at a time per robot. */
export class ScriptRunner extends EventEmitter {
  constructor({ python = 'python3', scriptDir = defaultScriptDir, timeoutMs = 120000 } = {}) {
    super();
    this.python = python;
    this.scriptDir = scriptDir;
    this.timeoutMs = timeoutMs;
    this._running = new Map(); // address -> { child, name, startTime, timer }
    this._apiUrl = 'http://127.0.0.1:3000';
  }

  setApiUrl(url) {
    this._apiUrl = url;
  }

  async list() {
    return listScripts({ python: this.python, scriptDir: this.scriptDir });
  }

  async firmware() {
    return firmwareSurface({ python: this.python });
  }

  async start(address, name) {
    if (this._running.has(address)) {
      const err = new Error(`Script already running on ${address}`);
      err.status = 409;
      throw err;
    }

    const child = spawn(this.python, [enginePath, '--address', address, '--api', this._apiUrl, '--script', name], {
      env: { ...process.env, PYTHONPATH: [path.join(path.dirname(this.enginePath), '..', '..'), path.join(path.dirname(this.enginePath), '..', '..', 'codie-api')].join(path.delimiter) },
    });

    const entry = { child, name, startTime: Date.now(), timer: null };
    this._running.set(address, entry);

    child.stdout.on('data', (d) => {
      const text = d.toString();
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          this.emit('event', { address, event });
          if (event.event === 'done' || event.event === 'error' || event.event === 'exit' || event.event === 'stopped') {
            this.stop(address);
          }
        } catch (e) {
          // non-JSON line — forward as log
          this.emit('event', { address, event: { event: 'log', text: line } });
        }
      }
    });

    child.stderr.on('data', (d) => {
      this.emit('event', { address, event: { event: 'error', text: d.toString() } });
    });

    child.on('close', (code) => {
      this._running.delete(address);
      this.emit('event', { address, event: { event: 'exit', code } });
    });

    // timeout
    entry.timer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch (e) {
        // ignore
      }
    }, this.timeoutMs);

    this.emit('event', { address, event: { event: 'start', name } });
    return { address, name };
  }

  async stop(address) {
    const entry = this._running.get(address);
    if (!entry) return false;
    clearTimeout(entry.timer);
    try {
      entry.child.kill('SIGTERM');
    } catch (e) {
      // ignore
    }
    this._running.delete(address);
    this.emit('event', { address, event: { event: 'stopped' } });
    return true;
  }

  status(address) {
    const entry = this._running.get(address);
    if (!entry) return null;
    return { address, name: entry.name, running: true, elapsed: Date.now() - entry.startTime };
  }

  get enginePath() {
    return enginePath;
  }
}
