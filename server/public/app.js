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
  statusLink: document.getElementById('status-link'),
  sUsb: document.getElementById('s-usb'),
  sBoot: document.getElementById('s-boot'),
  sLink: document.getElementById('s-link'),
  sFault: document.getElementById('s-fault'),
  sNfault: document.getElementById('s-nfault'),
  ledIndex: document.getElementById('led-index'),
  ledColor: document.getElementById('led-color'),
  ledSet: document.getElementById('led-set'),
  ledAll: document.getElementById('led-all'),
  ledOff: document.getElementById('led-off'),
  ledBrightness: document.getElementById('led-brightness'),
  ledBrightnessVal: document.getElementById('led-brightness-val'),
  brightnessSet: document.getElementById('brightness-set'),
  brightnessGet: document.getElementById('brightness-get'),
  ledAnimChase: document.getElementById('led-anim-chase'),
  ledAnimSine: document.getElementById('led-anim-sine'),
  ledAnimStop: document.getElementById('led-anim-stop'),
  ledStrip: document.getElementById('led-strip'),
  driveDist: document.getElementById('drive-dist'),
  driveDistSpeed: document.getElementById('drive-dist-speed'),
  driveDistGo: document.getElementById('drive-dist-go'),
  driveTurn: document.getElementById('drive-turn'),
  driveTurnSpeed: document.getElementById('drive-turn-speed'),
  driveTurnGo: document.getElementById('drive-turn-go'),
  driveLeft: document.getElementById('drive-left'),
  driveRight: document.getElementById('drive-right'),
  driveSpeedGo: document.getElementById('drive-speed-go'),
  driveStop: document.getElementById('drive-stop'),
  driveFault: document.getElementById('drive-fault'),
  driveNfault: document.getElementById('drive-nfault'),
  tTemp: document.getElementById('t-temp'),
  tBatt: document.getElementById('t-batt'),
  tSonar2: document.getElementById('t-sonar2'),
  tLight2: document.getElementById('t-light2'),
  tLineL2: document.getElementById('t-line-l2'),
  tLineR2: document.getElementById('t-line-r2'),
  tMic2: document.getElementById('t-mic2'),
  tLineBin: document.getElementById('t-line-bin'),
  sensorsAge: document.getElementById('sensors-age'),
  sensorsRefresh: document.getElementById('sensors-refresh'),
  proxyCmd: document.getElementById('proxy-cmd'),
  proxySend: document.getElementById('proxy-send'),
  greetingCmd: document.getElementById('greeting-cmd'),
  greetingSend: document.getElementById('greeting-send'),
  logLevel: document.getElementById('log-level'),
  logSet: document.getElementById('log-set'),
  commandOut: document.getElementById('command-out'),
  toast: document.getElementById('toast'),
  // ---- P6: MAC allowlist ----
  p6MacInput: document.getElementById('p6-mac-input'),
  p6MacAdd: document.getElementById('p6-mac-add'),
  p6MacOnly: document.getElementById('p6-mac-only'),
  p6MacList: document.getElementById('p6-mac-list'),
  // ---- P6: robot filter ----
  p6NameFilter: document.getElementById('p6-name-filter'),
  p6UuidFilter: document.getElementById('p6-uuid-filter'),
  p6MacAllow: document.getElementById('p6-mac-allow'),
  p6MacBlock: document.getElementById('p6-mac-block'),
  p6FilterApply: document.getElementById('p6-filter-apply'),
  // ---- P6: auto-connect ----
  p6AutoconnectMacs: document.getElementById('p6-autoconnect-macs'),
  p6AutoconnectSave: document.getElementById('p6-autoconnect-save'),
  // ---- P9: admin ----
  p9BtScan: document.getElementById('p9-bt-scan'),
  p9BtToggle: document.getElementById('p9-bt-toggle'),
  p9ConnectedList: document.getElementById('p9-connected-list'),
  p9MacInput: document.getElementById('p9-mac-input'),
  p9MacAdd: document.getElementById('p9-mac-add'),
  p9MacOnly: document.getElementById('p9-mac-only'),
  p9MacList: document.getElementById('p9-mac-list'),
  p9AutoconnectMacs: document.getElementById('p9-autoconnect-macs'),
  p9AutoconnectSave: document.getElementById('p9-autoconnect-save'),
  p9InventoryTbody: document.querySelector('#p9-inventory-table tbody'),
  p9DefaultFilter: document.getElementById('p9-default-filter'),
  p9DefaultLed: document.getElementById('p9-default-led'),
  p9DefaultSpeed: document.getElementById('p9-default-speed'),
  p9LogLevel: document.getElementById('p9-log-level'),
  p9SettingsSave: document.getElementById('p9-settings-save'),
  p9OpFwReset: document.getElementById('p9-op-fw-reset'),
  p9OpBootloader: document.getElementById('p9-op-bootloader'),
  p9OpPowerOn: document.getElementById('p9-op-power-on'),
  p9OpPowerOff: document.getElementById('p9-op-power-off'),
  p9BroadcastCmd: document.getElementById('p9-broadcast-cmd'),
  p9BroadcastSend: document.getElementById('p9-broadcast-send'),
};

// telemetry value elements
const tEls = {
  battery: document.getElementById('t-battery'),
  sonar: document.getElementById('t-sonar'),
  light: document.getElementById('t-light'),
  lineL: document.getElementById('t-line-l'),
  lineR: document.getElementById('t-line-r'),
  mic: document.getElementById('t-mic'),
  temp: document.getElementById('t-temp'),
  batt2: document.getElementById('t-batt'),
  sonar2: document.getElementById('t-sonar2'),
  light2: document.getElementById('t-light2'),
  lineL2: document.getElementById('t-line-l2'),
  lineR2: document.getElementById('t-line-r2'),
  mic2: document.getElementById('t-mic2'),
  lineBin: document.getElementById('t-line-bin'),
  fault: document.getElementById('s-fault'),
  nFault: document.getElementById('s-nfault'),
  usb: document.getElementById('s-usb'),
  boot: document.getElementById('s-boot'),
  link: document.getElementById('s-link'),
  brightness: document.getElementById('led-brightness-val'),
};

/** State. */
let robots = [];
let activeAddress = null;
let lastTelemetryTs = 0;
let micActive = false;
let micAnimationFrame = null;
let stripColors = new Array(12).fill(0);
/** P6 / P9 BLE config state, synced with GET/POST /api/config. */
let config = {
  ble: {
    nameFilter: 'Codie',
    serviceUuids: [],
    macAllowlist: [],
    macOnly: false,
  },
};
/** Client-side MAC blocklist (not a backend field; applied in renderRobots). */
let blockedMacs = new Set();
/** Auto-connect MAC addresses. */
let autoConnectMacs = [];
/** Last-seen timestamp per robot address. */
let lastSeen = new Map();
/** Latest RSSI per robot address. */
let robotRssi = new Map();
/** Escape HTML to prevent injection in robot/MAC rendered content. */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

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

  const visible = robots.filter((r) => !blockedMacs.has(normalizeMac(r.address)));
  count.textContent = visible.length;
  if (visible.length === 0) {
    empty.style.display = 'block';
    list.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  list.style.display = '';

  for (const robot of visible) {
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
    set(tEls.lineBin, ((t.line.left ? 1 : 0) << 1) | (t.line.right ? 1 : 0));
  } else {
    set(tEls.lineL, '—');
    set(tEls.lineR, '—');
    set(tEls.lineBin, '—');
  }
  set(tEls.mic, t.mic);
  // sensors panel mirrors
  set(tEls.temp, t.temp, '°C');
  set(tEls.batt2, t.battery, '%');
  set(tEls.sonar2, t.sonar, 'mm');
  set(tEls.light2, t.light);
  set(tEls.lineL2, t.line ? t.line.left : '—');
  set(tEls.lineR2, t.line ? t.line.right : '—');
  set(tEls.mic2, t.mic);
  // status panel fields (filled by telemetry when the robot reports them)
  set(tEls.fault, t.fault);
  set(tEls.nFault, t.nFault);
  set(tEls.usb, t.usb);
  set(tEls.boot, t.boot);
  set(tEls.link, t.link);
  set(tEls.brightness, t.brightness);

  els.telemetryAge.textContent = 'updated ' + formatTimeAgo(now);
  els.sensorsAge.textContent = els.telemetryAge.textContent;
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

/** Render the 12-LED ARGB strip visual. */
function renderStrip() {
  els.ledStrip.innerHTML = '';
  for (let i = 0; i < 12; i += 1) {
    const led = document.createElement('div');
    led.className = 'strip-led';
    const rgb = stripColors[i];
    led.style.background =
      'rgb(' + ((rgb >> 16) & 255) + ', ' + ((rgb >> 8) & 255) + ', ' + (rgb & 255) + ')';
    led.title = 'LED ' + (i + 1);
    els.ledStrip.appendChild(led);
  }
}

/** Update BLE link status badge from robot connection state. */
function updateLinkStatus() {
  const robot = activeAddress ? robots.find((r) => r.address === activeAddress) : null;
  const on = Boolean(robot && robot.connected);
  els.statusLink.textContent = on ? 'link connected' : 'link —';
}
/** Normalize a MAC address for comparison/storage. */
function normalizeMac(mac) {
  return String(mac || '').trim().toUpperCase();
}

/** Parse a comma/space/sep separated MAC list into normalized unique array. */
function parseMacList(text) {
  return String(text || '')
    .split(/[,;\\s]+/)
    .map((m) => normalizeMac(m))
    .filter((m, i, arr) => m !== '' && arr.indexOf(m) === i);
}

/** Load BLE config from GET /api/config and populate P6/P9 inputs. */
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('config load failed');
    const data = await res.json();
    const ble = data && data.ble ? data.ble : {};
    config = { ble: { ...config.ble, ...ble } };
    config.ble.macAllowlist = Array.isArray(ble.macAllowlist) ? ble.macAllowlist : [];
    const b = config.ble;
    if (els.p6NameFilter) els.p6NameFilter.value = b.nameFilter || '';
    if (els.p9DefaultFilter) els.p9DefaultFilter.value = b.nameFilter || '';
    if (els.p6UuidFilter) els.p6UuidFilter.value = Array.isArray(b.serviceUuids) ? b.serviceUuids.join(', ') : '';
    if (els.p6MacAllow) els.p6MacAllow.value = Array.isArray(b.macAllowlist) ? b.macAllowlist.join(', ') : '';
    if (els.p6MacOnly) els.p6MacOnly.checked = Boolean(b.macOnly);
    if (els.p9MacOnly) els.p9MacOnly.checked = Boolean(b.macOnly);
    autoConnectMacs = parseMacList(els.p6AutoconnectMacs ? els.p6AutoconnectMacs.value : '');
    if (els.p6AutoconnectMacs) els.p6AutoconnectMacs.value = autoConnectMacs.join(', ');
    if (els.p9AutoconnectMacs) els.p9AutoconnectMacs.value = autoConnectMacs.join(', ');
    renderAllowlist();
  } catch (error) {
    toast('Failed to load config', 'error');
  }
}

/** Save BLE config via POST /api/config. */
async function saveConfig() {
  try {
    const b = config.ble;
    b.nameFilter = (els.p6NameFilter ? els.p6NameFilter.value : els.p9DefaultFilter ? els.p9DefaultFilter.value : '') || 'Codie';
    b.serviceUuids = parseMacList(els.p6UuidFilter ? els.p6UuidFilter.value : '');
    b.macOnly = els.p6MacOnly ? els.p6MacOnly.checked : (els.p9MacOnly ? els.p9MacOnly.checked : false);
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ble: { nameFilter: b.nameFilter, serviceUuids: b.serviceUuids, macAllowlist: b.macAllowlist, macOnly: b.macOnly } }),
    });
    if (!res.ok) throw new Error('config save failed');
    const data = await res.json();
    if (data && data.ble) config.ble = { ...config.ble, ...data.ble };
    renderAllowlist();
    toast('Config saved');
  } catch (error) {
    toast('Failed to save config', 'error');
  }
}

/** Render the MAC allowlist into both P6 and P9 containers. */
function renderAllowlist() {
  const list = config.ble.macAllowlist || [];
  const render = (container) => {
    if (!container) return;
    container.innerHTML = '';
    for (const mac of list) {
      const li = document.createElement('li');
      li.className = '';
      li.innerHTML = `<span class="addr">${escapeHtml(mac)}</span><button class="btn btn-danger" data-remove="${escapeHtml(mac)}">Remove</button>`;
      li.querySelector('button').addEventListener('click', () => removeMac(mac));
      container.appendChild(li);
    }
  };
  render(els.p6MacList);
  render(els.p9MacList);
}

/** Add a MAC to the allowlist and persist. */
function addMac(mac) {
  const m = normalizeMac(mac);
  if (!m) return;
  if (config.ble.macAllowlist.includes(m)) { toast('MAC already allowlisted'); return; }
  config.ble.macAllowlist.push(m);
  renderAllowlist();
  saveConfig();
}

/** Remove a MAC from the allowlist and persist. */
function removeMac(mac) {
  config.ble.macAllowlist = (config.ble.macAllowlist || []).filter((m) => m !== mac);
  renderAllowlist();
  saveConfig();
}

/** Render the P9 connected robots list (status/RSSI/last seen/firmware). */
function renderP9Connected() {
  const tbody = els.p9ConnectedList;
  if (!tbody) return;
  tbody.innerHTML = '';
  const connected = robots.filter((r) => r.connected);
  if (connected.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7" class="empty">No connected robots.</td>';
    tbody.appendChild(tr);
    return;
  }
  for (const r of connected) {
    const tr = document.createElement('tr');
    const addr = escapeHtml(r.address);
    const name = escapeHtml(r.name || '(unnamed)');
    const rssi = robotRssi.get(r.address) !== undefined ? robotRssi.get(r.address) : (r.rssi !== undefined ? r.rssi : '—');
    const seen = lastSeen.has(r.address) ? formatTimeAgo(lastSeen.get(r.address)) : '—';
    const fw = (r.telemetry && r.telemetry.firmware) || '—';
    tr.innerHTML = `
      <td class="addr">${addr}</td>
      <td>${name}</td>
      <td><span class="status-chip connected">connected</span></td>
      <td>${rssi}</td>
      <td>${seen}</td>
      <td>${escapeHtml(fw)}</td>
      <td>
        <button class="btn btn-danger btn-sm" data-op="disconnect" data-addr="${addr}">Disconnect</button>
      </td>
    `;
    tr.querySelector('[data-op="disconnect"]').addEventListener('click', () => disconnectRobot(r.address));
    tbody.appendChild(tr);
  }
}

/** Render the P9 robot inventory table (all known robots). */
function renderP9Inventory() {
  const tbody = els.p9InventoryTbody;
  if (!tbody) return;
  tbody.innerHTML = '';
  if (robots.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7" class="empty">No robots discovered. Scan from Bluetooth Management.</td>';
    tbody.appendChild(tr);
    return;
  }
  const blocked = blockedMacs;
  for (const r of robots) {
    if (blocked.has(normalizeMac(r.address))) continue;
    const tr = document.createElement('tr');
    const addr = escapeHtml(r.address);
    const name = escapeHtml(r.name || '(unnamed)');
    const variant = escapeHtml(r.variant || '—');
    const connected = Boolean(r.connected);
    const rssi = robotRssi.get(r.address) !== undefined ? robotRssi.get(r.address) : (r.rssi !== undefined ? r.rssi : '—');
    const seen = lastSeen.has(r.address) ? formatTimeAgo(lastSeen.get(r.address)) : '—';
    const fw = (r.telemetry && r.telemetry.firmware) || '—';
    tr.innerHTML = `
      <td class="addr">${addr}</td>
      <td>${name}</td>
      <td>${variant}</td>
      <td><span class="status-chip ${connected ? 'connected' : 'disconnected'}">${connected ? 'connected' : 'disconnected'}</span></td>
      <td>${rssi}</td>
      <td>${seen}</td>
      <td>${escapeHtml(fw)}</td>
    `;
    tbody.appendChild(tr);
  }
}

/** Send a proxy console command to a single connected robot. */
function sendProxyToRobot(address, cmd) {
  socket.emit('advanced:command', { address, cmd });
}

/** Robot operation proxy commands. */
const OP_COMMANDS = {
  'fw-reset': 'call sys reset',
  bootloader: 'call boot enter',
  'power-on': 'set hwiPower hold 1',
  'power-off': 'set hwiPower hold 0',
};

/** Run a robot operation on the active robot. */
function runRobotOperation(op) {
  if (!activeAddress) { toast('No robot selected', 'error'); return; }
  const cmd = OP_COMMANDS[op];
  if (!cmd) return;
  sendProxyToRobot(activeAddress, cmd);
  toast(`Operation ${op} -> ${activeAddress}`);
}

/** Broadcast a proxy command to all connected robots. */
function broadcastCommand(cmd) {
  const connected = robots.filter((r) => r.connected);
  if (connected.length === 0) { toast('No connected robots', 'error'); return; }
  for (const r of connected) sendProxyToRobot(r.address, cmd);
  toast(`Broadcast to ${connected.length} robot${connected.length === 1 ? '' : 's'}`);
}

/** Append a line to the command output panel. */
function appendCommandOutput(text, kind = 'info') {
  const line = document.createElement('div');
  line.className = 'line' + (kind === 'error' ? ' error' : '');
  line.textContent = text;
  els.commandOut.appendChild(line);
  els.commandOut.scrollTop = els.commandOut.scrollHeight;
}

/** Query robot status fields via proxy/console commands. */
async function queryStatus() {
  if (!activeAddress) {
    toast('No robot selected', 'error');
    return;
  }
  const queries = [
    { key: 'usb', cmd: 'get hwiUsb state' },
    { key: 'boot', cmd: 'get hwiBoot mode' },
    { key: 'fault', cmd: 'get hwiFault state' },
    { key: 'nFault', cmd: 'get hwiNfault state' },
    { key: 'temp', cmd: 'get hwiTemp value' },
    { key: 'brightness', cmd: 'get hwiLed argb brightness' },
  ];
  for (const q of queries) {
    try {
      const result = await socketRequest('robot:command', {
        address: activeAddress,
        name: 'proxy',
        params: { text: q.cmd },
      });
      const value = (result && result.reply) ? String(result.reply).trim() : '—';
      els[q.key].textContent = value;
    } catch (error) {
      // best-effort; leave as —
    }
  }
  updateLinkStatus();
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

socket.on('connect', () => { setSocket(true); updateLinkStatus(); });
socket.on('disconnect', () => { setSocket(false); updateLinkStatus(); });

function touchRobot(robot) {
  if (!robot || !robot.address) return;
  lastSeen.set(robot.address, Date.now());
  if (robot.rssi !== null && robot.rssi !== undefined) robotRssi.set(robot.address, robot.rssi);
}

socket.on('robots', (payload) => {
  robots = payload.robots || [];
  for (const r of robots) touchRobot(r);
  renderRobots();
  renderP9Connected();
  renderP9Inventory();
});

socket.on('scan', (payload) => {
  robots = payload.robots || [];
  for (const r of robots) touchRobot(r);
  renderRobots();
  renderP9Connected();
  renderP9Inventory();
  toast(`Found ${robots.length} robot${robots.length === 1 ? '' : 's'}`);
});

socket.on('robot', (robot) => {
  touchRobot(robot);
  const idx = robots.findIndex((r) => r.address === robot.address);
  if (idx !== -1) robots[idx] = robot;
  else robots.push(robot);
  renderRobots();
  renderP9Connected();
  renderP9Inventory();
  updateLinkStatus();
});

socket.on('telemetry', (robot) => {
  touchRobot(robot);
  renderP9Connected();
  renderP9Inventory();
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

// ---- status panel ----
els.statusRefresh.addEventListener('click', () => queryStatus());

function hexToRgbInt(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 0;
  return (parseInt(m[1], 16) << 16) | (parseInt(m[2], 16) << 8) | parseInt(m[3], 16);
}

// ---- LED panel ----
els.ledSet.addEventListener('click', () => {
  const index = Number(els.ledIndex.value);
  const color = els.ledColor.value;
  if (!Number.isFinite(index) || index < 1 || index > 12) {
    toast('LED index must be 1-12', 'error');
    return;
  }
  sendCommand('ledSingle', { color, index });
  stripColors[index - 1] = hexToRgbInt(color);
  renderStrip();
});

els.ledAll.addEventListener('click', () => {
  const color = els.ledColor.value;
  sendCommand('led', { color, ledMask: 0x0fff });
  for (let i = 0; i < 12; i += 1) stripColors[i] = hexToRgbInt(color);
  renderStrip();
});

els.ledOff.addEventListener('click', () => {
  sendCommand('ledsOff', {});
  stripColors = new Array(12).fill(0);
  renderStrip();
});

els.ledBrightness.addEventListener('input', () => {
  els.ledBrightnessVal.textContent = els.ledBrightness.value;
});

els.brightnessSet.addEventListener('click', () => {
  if (!activeAddress) { toast('No robot selected', 'error'); return; }
  socket.emit('advanced:command', {
    address: activeAddress,
    cmd: 'set hwiLed argb brightness ' + els.ledBrightness.value,
  });
});

els.brightnessGet.addEventListener('click', async () => {
  if (!activeAddress) { toast('No robot selected', 'error'); return; }
  try {
    const result = await advancedRequest('console:command', 'get hwiLed argb brightness');
    const value = (result && result.reply) ? String(result.reply).trim() : '—';
    els.ledBrightnessVal.textContent = value;
    els.ledBrightness.value = value;
  } catch (error) {
    toast('Brightness read failed', 'error');
  }
});

els.ledAnimChase.addEventListener('click', () => {
  if (!activeAddress) { toast('No robot selected', 'error'); return; }
  socket.emit('advanced:command', { address: activeAddress, cmd: 'call led anim 5' });
});

els.ledAnimSine.addEventListener('click', () => {
  if (!activeAddress) { toast('No robot selected', 'error'); return; }
  socket.emit('advanced:command', { address: activeAddress, cmd: 'call led anim 6' });
});

els.ledAnimStop.addEventListener('click', () => {
  sendCommand('ledAnim', { animation: 0 });
});

// ---- drive panel ----
els.driveDistGo.addEventListener('click', () => {
  sendCommand('forward', { cm: Number(els.driveDist.value), speed: Number(els.driveDistSpeed.value) });
});
els.driveTurnGo.addEventListener('click', () => {
  sendCommand('turn', { deg: Number(els.driveTurn.value), speed: Number(els.driveTurnSpeed.value) });
});
els.driveSpeedGo.addEventListener('click', () => {
  sendCommand('driveSpeed', { left: Number(els.driveLeft.value), right: Number(els.driveRight.value) });
});
els.driveStop.addEventListener('click', () => {
  sendCommand('stop', {});
});

// ---- sensors panel ----
els.sensorsRefresh.addEventListener('click', () => queryStatus());

// ---- command panel ----
function advancedRequest(eventName, cmd) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.off('command-result', handler);
      reject(new Error('request timed out'));
    }, 10000);
    const handler = (payload) => {
      if ((payload.address && payload.address !== activeAddress) || payload.action !== 'proxy') return;
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.off('command-result', handler);
      resolve(payload);
    };
    socket.on('command-result', handler);
    socket.emit(eventName, { address: activeAddress, cmd });
  });
}

els.proxySend.addEventListener('click', async () => {
  const cmd = els.proxyCmd.value.trim();
  if (!cmd) return;
  const line = document.createElement('div');
  line.className = 'line';
  line.textContent = '> ' + cmd;
  els.commandOut.appendChild(line);
  els.commandOut.scrollTop = els.commandOut.scrollHeight;
  els.proxyCmd.value = '';
  try {
    const result = await advancedRequest('advanced:command', cmd);
    appendCommandOutput((result && result.reply) ? String(result.reply) : String(result), 'info');
  } catch (error) {
    appendCommandOutput('error: ' + (error.message || error), 'error');
  }
});

els.greetingSend.addEventListener('click', async () => {
  if (!activeAddress) { toast('No robot selected', 'error'); return; }
  const cmd = els.greetingCmd.value.trim() || 'get appSys ver';
  try {
    const result = await advancedRequest('console:command', cmd);
    appendCommandOutput((result && result.reply) ? String(result.reply) : String(result), 'info');
  } catch (error) {
    appendCommandOutput('error: ' + (error.message || error), 'error');
  }
});

els.logSet.addEventListener('click', () => {
  if (!activeAddress) { toast('No robot selected', 'error'); return; }
  socket.emit('console:command', { address: activeAddress, cmd: 'log ' + els.logLevel.value });
  toast('Log level ' + els.logLevel.value);
});
// ---- P6 / P9 admin controls ----

els.p6MacAdd.addEventListener('click', () => {
  addMac(els.p6MacInput.value);
  els.p6MacInput.value = '';
});

els.p6MacOnly.addEventListener('change', () => {
  config.ble.macOnly = els.p6MacOnly.checked;
  if (els.p9MacOnly) els.p9MacOnly.checked = els.p6MacOnly.checked;
  saveConfig();
});

els.p6FilterApply.addEventListener('click', () => {
  config.ble.nameFilter = els.p6NameFilter.value.trim() || 'Codie';
  config.ble.serviceUuids = parseMacList(els.p6UuidFilter.value);
  const allow = parseMacList(els.p6MacAllow.value);
  config.ble.macAllowlist = allow;
  const block = parseMacList(els.p6MacBlock.value);
  block.forEach((m) => blockedMacs.add(m));
  if (els.p9DefaultFilter) els.p9DefaultFilter.value = config.ble.nameFilter;
  if (els.p9MacOnly) els.p9MacOnly.checked = config.ble.macOnly;
  renderAllowlist();
  renderRobots();
  saveConfig();
  toast('Filter applied');
});

els.p6AutoconnectSave.addEventListener('click', () => {
  autoConnectMacs = parseMacList(els.p6AutoconnectMacs.value);
  if (els.p9AutoconnectMacs) els.p9AutoconnectMacs.value = autoConnectMacs.join(', ');
  toast('Auto-connect saved (' + autoConnectMacs.length + ' MACs)');
});

// ---- P9: Bluetooth management ----

els.p9BtScan.addEventListener('click', () => {
  socket.emit('scan:request', { durationMs: 15000 });
  toast('Scanning…');
});

els.p9BtToggle.addEventListener('click', () => {
  // Best-effort: no backend toggle endpoint; surface intent via toast.
  toast('Bluetooth toggle: best-effort (no backend toggle endpoint)', 'warning');
});

els.p9MacAdd.addEventListener('click', () => {
  addMac(els.p9MacInput.value);
  els.p9MacInput.value = '';
});

els.p9MacOnly.addEventListener('change', () => {
  config.ble.macOnly = els.p9MacOnly.checked;
  if (els.p6MacOnly) els.p6MacOnly.checked = els.p9MacOnly.checked;
  saveConfig();
});

els.p9AutoconnectSave.addEventListener('click', () => {
  autoConnectMacs = parseMacList(els.p9AutoconnectMacs.value);
  if (els.p6AutoconnectMacs) els.p6AutoconnectMacs.value = autoConnectMacs.join(', ');
  toast('Auto-connect saved (' + autoConnectMacs.length + ' MACs)');
});

// ---- P9: global settings ----

els.p9SettingsSave.addEventListener('click', () => {
  config.ble.nameFilter = els.p9DefaultFilter.value.trim() || 'Codie';
  if (els.p6NameFilter) els.p6NameFilter.value = config.ble.nameFilter;
  saveConfig();
  toast('Global settings saved');
});

// ---- P9: robot operations ----

els.p9OpFwReset.addEventListener('click', () => runRobotOperation('fw-reset'));
els.p9OpBootloader.addEventListener('click', () => runRobotOperation('bootloader'));
els.p9OpPowerOn.addEventListener('click', () => runRobotOperation('power-on'));
els.p9OpPowerOff.addEventListener('click', () => runRobotOperation('power-off'));

els.p9BroadcastSend.addEventListener('click', () => {
  const cmd = els.p9BroadcastCmd.value.trim();
  if (!cmd) return;
  broadcastCommand(cmd);
  els.p9BroadcastCmd.value = '';
});

// ---- advanced panel toggle ----
document.querySelector('.brand').addEventListener('dblclick', () => {
  const panel = document.getElementById('advanced-panel');
  const hidden = panel.style.display === 'none';
  panel.style.display = hidden ? 'block' : 'none';
});

// ---- init ----
els.socketPill.textContent = 'socket connecting…';
updateLinkStatus();
renderStrip();
loadConfig();

renderRobots();

