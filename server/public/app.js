/**
 * Codie Control — frontend application.
 *
 * Connects to the backend via socket.io and drives the control surface:
 * robot list, connect/disconnect, live telemetry, commands, scripts,
 * microphone meter, and an advanced console panel.
 */

'use strict';

const socket = io();

/** DOM elements. */
const els = {
  socketPill: document.getElementById('socket-pill'),
  brandLine: document.getElementById('brand-line'),
  scanBtn: document.getElementById('scan-btn'),
  robotList: document.getElementById('robot-list'),
  robotEmpty: document.getElementById('robots-empty'),
  robotCount: document.getElementById('robot-count'),
  robotBadge: document.getElementById('robot-badge'),
  scriptName: document.getElementById('script-name'),
  scriptRun: document.getElementById('script-run'),
  scriptStop: document.getElementById('script-stop'),
  scriptLog: document.getElementById('script-log'),
  cmdName: document.getElementById('cmd-name'),
  cmdParams: document.getElementById('cmd-params'),
  cmdSend: document.getElementById('cmd-send'),
  morseText: document.getElementById('morse-text'),
  morseSend: document.getElementById('morse-send'),
  consoleCmd: document.getElementById('console-cmd'),
  consoleSend: document.getElementById('console-send'),
  consoleOut: document.getElementById('console-out'),
  micToggle: document.getElementById('mic-toggle'),
  micPanel: document.getElementById('mic-panel'),
  micBar: document.getElementById('mic-bar'),
  micReading: document.getElementById('mic-reading'),
  telemetryAge: document.getElementById('telemetry-age'),
  toast: document.getElementById('toast'),
};

// telemetry value elements
const tEls = {
  battery: document.getElementById('t-battery'),
  sonar: document.getElementById('t-sonar'),
  light: document.getElementById('t-light'),
  lineL: document.getElementById('t-line-l'),
  lineR: document.getElementById('t-line-r'),
  mic: document.getElementById('t-mic'),
};

/** State. */
let robots = [];
let activeAddress = null;
let lastTelemetryTs = 0;
let micActive = false;
let micAnimationFrame = null;

/** Status toast. */
function toast(message, kind = 'info') {
  const el = els.toast;
  el.textContent = message;
  el.className = 'toast show' + (kind === 'error' ? ' error' : '');
  setTimeout(() => { el.classList.remove('show'); }, 3000);
}

/** Socket connection status. */
function setSocket(on) {
  const el = els.socketPill;
  el.className = 'pill ' + (on ? 'on' : 'off');
  el.textContent = on ? 'socket \u25cf connected' : 'socket \u25cf disconnected';
}

/** Update the robot list rendering. */
function renderRobots() {
  const list = els.robotList;
  list.innerHTML = '';
  const empty = els.robotEmpty;
  const count = els.robotCount;

  count.textContent = robots.length;
  if (robots.length === 0) {
    empty.style.display = 'block';
    list.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  list.style.display = '';

  for (const robot of robots) {
    const item = document.createElement('li');
    item.className = 'robot-item' + (robot.address === activeAddress ? ' active' : '');
    item.dataset.address = robot.address;

    const connected = robot.connected;
    const variant = robot.variant ?? 'unknown';

    item.innerHTML = `
      <div class="robot-info">
        <div class="robot-addr">${escapeHtml(robot.address)}</div>
        <div class="robot-meta">
          <span>${escapeHtml(robot.name || '(unnamed)')}</span>
          <span>\u2022</span>
          <span>${escapeHtml(variant)}</span>
          <span>\u2022</span>
          <span>${connected ? 'connected' : 'disconnected'}</span>
        </div>
      </div>
      <div class="robot-actions">
        <button class="btn btn-sm ${connected ? 'btn-danger' : 'btn-primary'}" data-action="${connected ? 'disconnect' : 'connect'}">
          ${connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
    `;

    item.querySelector('button').addEventListener('click', (ev) => {
      ev.stopPropagation();
      const action = item.querySelector('button').dataset.action;
      if (action === 'connect') connectRobot(robot.address);
      else disconnectRobot(robot.address);
    });

    item.addEventListener('click', () => selectRobot(robot.address));
    list.appendChild(item);
  }
}

/** Select the active robot (highlight + show telemetry badge). */
function selectRobot(address) {
  activeAddress = address;
  els.robotBadge.textContent = address;
  renderRobots();
}

/** Connect to a robot. */
async function connectRobot(address) {
  try {
    const payload = await socketRequest('robot:connect', { address });
    if (payload) selectRobot(address);
    toast(`Connected to ${address}`);
  } catch (error) {
    toast(error.message || 'Connect failed', 'error');
  }
}

/** Disconnect the active robot. */
async function disconnectRobot(address) {
  try {
    await socketRequest('robot:disconnect', { address });
    if (activeAddress === address) {
      activeAddress = null;
      els.robotBadge.textContent = '—';
    }
    renderRobots();
    toast('Disconnected');
  } catch (error) {
    toast(error.message || 'Disconnect failed', 'error');
  }
}

/** Send a socket request and wait for the matching result. */
function socketRequest(type, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('request timed out'));
    }, 10000);

    const handler = (data) => {
      clearTimeout(timeout);
      socket.off(type + ':result', handler);
      resolve(data);
    };

    socket.on(type + ':result', handler);
    socket.emit(type, payload);
  });
}

/** Send a robot command. */
async function sendCommand(name, params = {}) {
  if (!activeAddress) {
    toast('No robot selected', 'error');
    return;
  }
  try {
    const result = await socketRequest('robot:command', { address: activeAddress, name, params });
    toast(`OK: ${name}`);
    renderTelemetry(result);
  } catch (error) {
    toast(error.message || `Command ${name} failed`, 'error');
  }
}

/** Render telemetry values. */
function renderTelemetry(payload) {
  const t = payload.telemetry || payload;
  const now = Date.now();
  lastTelemetryTs = now;

  const set = (el, value, unit) => {
    if (el && value !== undefined && value !== null) {
      el.textContent = unit ? value + ' ' + unit : value;
    }
  };

  set(tEls.battery, t.battery, '%');
  set(tEls.sonar, t.sonar, 'mm');
  set(tEls.light, t.light);
  if (t.line) {
    set(tEls.lineL, t.line.left);
    set(tEls.lineR, t.line.right);
  } else {
    set(tEls.lineL, '—');
    set(tEls.lineR, '—');
  }
  set(tEls.mic, t.mic);

  els.telemetryAge.textContent = 'updated ' + formatTimeAgo(now);
}

/** Refresh the telemetry age display every second. */
setInterval(() => {
  if (!lastTelemetryTs) return;
  const sec = Math.floor((Date.now() - lastTelemetryTs) / 1000);
  els.telemetryAge.textContent = sec > 60 ? 'stale' : `updated ${sec}s ago`;
  if (sec > 60) {
    for (const key of Object.keys(tEls)) {
      tEls[key].textContent = '—';
    }
  }
}, 1000);

function formatTimeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  return sec < 0 ? 'just now' : `${sec}s ago`;
}

/** Append a line to the script log. */
function appendScriptLog(event) {
  const div = document.createElement('div');
  div.className = 'line';
  const cls = {
    start: 'ev-start', step: 'ev-step', log: 'ev-log',
    done: 'ev-done', stopped: 'ev-stopped', error: 'ev-error',
    exit: 'ev-error',
  }[event.event] || '';
  div.classList.add(cls);

  let text = '';
  if (event.event === 'start') text = `▶ start "${event.name}"`;
  else if (event.event === 'step') text = `   step ${JSON.stringify(event.args || {})}`;
  else if (event.event === 'log') text = `   ${event.text || ''}`;
  else if (event.event === 'done') text = `✔ done "${event.name}"`;
  else if (event.event === 'stopped') text = `■ stopped "${event.name}"`;
  else if (event.event === 'error') text = `✖ error: ${event.text || event.message || ''}`;
  else if (event.event === 'exit') text = `⚐ exit code ${event.code}`;
  else text = JSON.stringify(event);

  div.textContent = text;
  els.scriptLog.appendChild(div);
  els.scriptLog.scrollTop = els.scriptLog.scrollHeight;
}

/** Start/stop microphone streaming. */
els.micToggle.addEventListener('click', () => {
  if (!activeAddress) {
    toast('No robot selected', 'error');
    return;
  }
  if (!micActive) {
    socket.emit('mic:start', { address: activeAddress });
    micActive = true;
    els.micToggle.textContent = 'Stop listening';
    els.micPanel.style.display = 'block';
  } else {
    socket.emit('mic:stop', { address: activeAddress });
    micActive = false;
    els.micToggle.textContent = 'Start listening';
    if (micAnimationFrame) cancelAnimationFrame(micAnimationFrame);
    els.micBar.style.setProperty('--fill', '0%');
    els.micReading.textContent = '0';
  }
});

socket.on('mic', (payload) => {
  if (payload.address !== activeAddress) return;
  const level = Math.min(100, Math.round((payload.level ?? 0) / 2048 * 100));
  els.micBar.style.setProperty('--fill', level + '%');
  els.micReading.textContent = payload.level ?? 0;
  if (micAnimationFrame) cancelAnimationFrame(micAnimationFrame);
  micAnimationFrame = requestAnimationFrame(() => {
    els.micReading.textContent = payload.level ?? 0;
  });
});

// ---- socket.io events ----

socket.on('connect', () => setSocket(true));
socket.on('disconnect', () => setSocket(false));

socket.on('robots', (payload) => {
  robots = payload.robots || [];
  renderRobots();
});

socket.on('scan', (payload) => {
  robots = payload.robots || [];
  renderRobots();
  toast(`Found ${robots.length} robot${robots.length === 1 ? '' : 's'}`);
});

socket.on('robot', (robot) => {
  const idx = robots.findIndex((r) => r.address === robot.address);
  if (idx !== -1) robots[idx] = robot;
  else robots.push(robot);
  renderRobots();
});

socket.on('telemetry', (robot) => {
  if (robot.address === activeAddress) {
    renderTelemetry(robot);
  }
});

socket.on('command-result', (payload) => {
  if (payload.address === activeAddress || !payload.address) {
    renderTelemetry(payload);
  }
});

socket.on('error', (payload) => {
  toast(payload.message || 'Error', 'error');
});

socket.on('robot-error', (payload) => {
  toast(`Robot ${payload.address}: ${payload.message}`, 'error');
});

socket.on('script:event', (payload) => {
  if (payload.address && payload.address !== activeAddress) return;
  appendScriptLog(payload.event || {});
});

// ---- controls ----

els.scanBtn.addEventListener('click', () => {
  socket.emit('scan:request', { durationMs: 15000 });
});

document.querySelectorAll('[data-cmd]').forEach((button) => {
  button.addEventListener('click', () => {
    const name = button.dataset.cmd;
    let params = {};
    try {
      params = JSON.parse(button.dataset.param || '{}');
    } catch (e) {
      // ignore
    }
    sendCommand(name, params);
  });
});

els.cmdSend.addEventListener('click', () => {
  const name = els.cmdName.value;
  let params = {};
  try {
    params = JSON.parse(els.cmdParams.value || '{}');
  } catch (e) {
    toast('Invalid JSON params', 'error');
    return;
  }
  sendCommand(name, params);
});

els.morseSend.addEventListener('click', () => {
  const text = els.morseText.value.trim();
  if (!text) return;
  sendCommand('morse', { text });
});

els.scriptRun.addEventListener('click', () => {
  const name = els.scriptName.value.trim();
  if (!name) {
    toast('Enter a script name', 'error');
    return;
  }
  els.scriptLog.innerHTML = '';
  socket.emit('script:start', { address: activeAddress, name });
});

els.scriptStop.addEventListener('click', () => {
  if (!activeAddress) {
    toast('No robot selected', 'error');
    return;
  }
  socket.emit('script:stop', { address: activeAddress });
});

els.consoleSend.addEventListener('click', () => {
  const cmd = els.consoleCmd.value.trim();
  if (!cmd) return;
  const line = document.createElement('div');
  line.className = 'line';
  line.textContent = '> ' + cmd;
  els.consoleOut.appendChild(line);
  els.consoleOut.scrollTop = els.consoleOut.scrollHeight;
  sendCommand('console', { cmd });
  els.consoleCmd.value = '';
});

// ---- advanced panel toggle ----
document.querySelector('.brand').addEventListener('dblclick', () => {
  const panel = document.getElementById('advanced-panel');
  const hidden = panel.style.display === 'none';
  panel.style.display = hidden ? 'block' : 'none';
});

// ---- init ----
els.socketPill.textContent = 'socket connecting…';

renderRobots();
