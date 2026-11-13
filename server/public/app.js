/**
 * Codie Control — frontend application.
 *
 * Connects to the backend via socket.io and drives the control surface:
 * robot list, connect/disconnect, live telemetry, commands, scripts,
 * microphone meter, and an advanced console panel.
 */

'use strict';

const socket = io();
const isAdminPage = !!document.getElementById('admin-root');
const isAuthPage = !!document.getElementById('auth-form');

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
  // ---- auth navbar ----
  navSignin: document.getElementById('nav-signin'),
  logoutBtn: document.getElementById('logout-btn'),
  authUser: document.getElementById('auth-user'),
  authLinks: document.getElementById('auth-links'),
  authNav: document.getElementById('auth-nav'),
  // ---- Python editor ----
  codeSelect: document.getElementById('code-select'),
  codeSave: document.getElementById('code-save'),
  codeRun: document.getElementById('code-run'),
  codeDelete: document.getElementById('code-delete'),
  codeNew: document.getElementById('code-new'),
  pythonCode: document.getElementById('python-code'),
  editorOutput: document.getElementById('editor-output'),
  editorStatus: document.getElementById('editor-status'),
  // ---- code list ----
  codeList: document.getElementById('code-list'),
  codeListEmpty: document.getElementById('code-list-empty'),

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
/** Auth state. */
let authToken = localStorage.getItem('codie_token') || null;
let authUser = null;
let authPermissions = new Set();
let authIsGuest = false;
/** Editor state. */
let editorCodes = [];
let editingCodeId = null;

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
/** Auth headers with bearer token. */
function authHeaders() {
  const headers = {};
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
  return headers;
}

/** Fetch to /api with auth token and JSON handling. */
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers };
  const opts = { method: options.method || 'GET', headers };
  if (options.body) opts.body = JSON.stringify(options.body);
  const res = await fetch('/api' + path, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.message) || data || `Request failed (${res.status})`;
    throw new Error(String(msg));
  }
  return data;
}

/** POST /api/auth/login */
async function authLogin(username, password) {
  const data = await apiFetch('/auth/login', { method: 'POST', body: { username, password } });
  return data;
}

/** POST /api/auth/register */
async function authRegister(username, email, password) {
  const data = await apiFetch('/auth/register', { method: 'POST', body: { username, email, password } });
  return data;
}

/** POST /api/auth/logout */
async function authLogout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (error) {
    // ignore logout errors; clear local state regardless
  }
}

/** GET /api/auth/me — returns { user } or throws on 401 */
async function authMe() {
  return await apiFetch('/auth/me');
}

/** Store auth state in memory + localStorage, then refresh UI. */
function setAuth(token, user) {
  authToken = token;
  localStorage.setItem('codie_token', token);
  authUser = user || null;
  if (user) {
    localStorage.setItem('codie_user', JSON.stringify(user));
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    authPermissions = new Set(perms);
  } else {
    authPermissions = new Set();
  }
  updateAuthUI();
}

/** Clear auth state. */
function clearAuth() {
  authToken = null;
  authUser = null;
  authPermissions = new Set();
  authIsGuest = false;
  localStorage.removeItem('codie_token');
  localStorage.removeItem('codie_user');
  updateAuthUI();
}

/** Enter read-only guest mode. */
function setGuest() {
  authToken = null;
  authUser = { username: 'guest', role: 'guest', permissions: [] };
  authPermissions = new Set();
  authIsGuest = true;
  localStorage.removeItem('codie_token');
  localStorage.removeItem('codie_user');
  updateAuthUI();
}

/** True if the current user has the given permission. */
function hasPermission(perm) {
  if (authIsGuest) return false;
  return authPermissions.has(perm);
}

/** Update the navbar auth state (login links vs user + logout). */
function updateAuthUI() {
  const loggedIn = !!authUser && !authIsGuest;
  if (els.authLinks) els.authLinks.style.display = loggedIn ? 'none' : 'flex';
  if (els.authNav) els.authNav.style.display = loggedIn ? 'flex' : 'none';
  if (els.authUser) els.authUser.textContent = authUser ? (authUser.username || 'user') : '';
  if (els.navSignin) els.navSignin.href = 'auth.html';
  // Disable control buttons whose permission the user lacks.
  applyPermissions();
}

/** Disable/enable buttons based on user permissions. */
function applyPermissions() {
  document.querySelectorAll('button[data-permission]').forEach((button) => {

    const perm = button.dataset.permission;
    const ok = hasPermission(perm);
    if (!ok) {
      button.classList.add('disabled-perm');
      button.disabled = true;
      button.title = 'Permission required: ' + perm;
    } else {
      button.classList.remove('disabled-perm');
      button.disabled = false;
      button.title = '';
    }
  });
  // Editor run/save/delete buttons
  if (els.codeRun) {
    if (!hasPermission('code:run')) {
      els.codeRun.classList.add('disabled-perm');
      els.codeRun.disabled = true;
    } else {
      els.codeRun.classList.remove('disabled-perm');
      els.codeRun.disabled = false;
    }
  }
  if (els.codeSave) {
    if (!hasPermission('code:write')) {
      els.codeSave.classList.add('disabled-perm');
      els.codeSave.disabled = true;
    } else {
      els.codeSave.classList.remove('disabled-perm');
      els.codeSave.disabled = false;
    }
  }
  if (els.codeDelete) {
    if (!hasPermission('code:write')) {
      els.codeDelete.classList.add('disabled-perm');
      els.codeDelete.disabled = true;
    } else {
      els.codeDelete.classList.remove('disabled-perm');
      els.codeDelete.disabled = false;
    }
  }
}

/** Append a line to the editor output panel. */
function editorLog(text, kind = 'info') {
  if (!els.editorOutput) return;
  const line = document.createElement('div');
  line.className = 'line ' + (kind === 'ok' ? 'ok' : kind === 'err' ? 'err' : '');
  line.textContent = text;
  els.editorOutput.appendChild(line);
  els.editorOutput.scrollTop = els.editorOutput.scrollHeight;
}

/** Clear the editor output panel. */
function editorClearLog() {
  if (els.editorOutput) els.editorOutput.innerHTML = '';
}

/** Load the list of saved Python codes from GET /api/code. */
async function loadCodeList() {
  if (!els.codeList || !els.codeSelect) return;
  editorClearLog();
  els.codeList.innerHTML = '';
  if (els.codeListEmpty) els.codeListEmpty.style.display = 'none';
  let codes = [];
  try {
    const data = await apiFetch('/code');
    codes = Array.isArray(data) ? data : (data.codes || []);
  } catch (error) {
    // Not authenticated or endpoint not available yet — show empty state.
    if (els.codeListEmpty) els.codeListEmpty.style.display = 'block';
    els.codeListEmpty.textContent = 'Unable to load saved code: ' + error.message;
    return;
  }
  editorCodes = codes;
  // Populate the <select> dropdown.
  if (els.codeSelect) {
    els.codeSelect.innerHTML = '<option value="">-- Load saved code --</option>';
    for (const c of codes) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.title || ('Code #' + c.id);
      els.codeSelect.appendChild(opt);
    }
  }
  // Render the code list panel.
  if (codes.length === 0) {
    if (els.codeListEmpty) els.codeListEmpty.style.display = 'block';
  } else {
    for (const c of codes) {
      const item = document.createElement('div');
      item.className = 'code-item';
      item.dataset.id = c.id;
      const updated = c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '';
      item.innerHTML =
        '<div><div class="code-title">' + escapeHtml(String(c.title || '')) + '</div>' +
        '<div class="code-meta">' + escapeHtml(updated) + '</div></div>' +
        '<button class="btn btn-sm" data-action="load">Load</button> ' +
        '<button class="btn btn-sm btn-danger" data-action="delete">Delete</button>';
      item.querySelector('[data-action="load"]').addEventListener('click', () => loadCode(c.id));
      item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteCode(c.id));
      item.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') return;
        loadCode(c.id);
      });
      els.codeList.appendChild(item);
    }
  }
}

/** Load a single code into the editor. */
async function loadCode(id) {
  if (!els.pythonCode) return;
  editorClearLog();
  editorStatusText('loading…');
  let data;
  try {
    data = await apiFetch('/code/' + encodeURIComponent(id));
  } catch (error) {
    editorLog('Failed to load code: ' + error.message, 'err');
    editorStatusText('error');
    return;
  }
  const code = data.code || data;
  editingCodeId = code.id;
  if (els.pythonCode) els.pythonCode.value = code.code || '';
  if (els.codeSelect) els.codeSelect.value = code.id;
  editorStatusText('loaded');
}

/** Save the current editor code via POST/PUT /api/code. */
async function saveCode() {
  if (!els.pythonCode) return;
  const title = prompt('Code title:', '');
  if (title === null) return;
  const body = { title: title.trim() || 'Untitled', code: els.pythonCode.value };
  let data;
  try {
    if (editingCodeId) {
      data = await apiFetch('/code/' + encodeURIComponent(editingCodeId), { method: 'PUT', body });
    } else {
      data = await apiFetch('/code', { method: 'POST', body });
    }
  } catch (error) {
    editorLog('Save failed: ' + error.message, 'err');
    editorStatusText('save failed');
    toast('Save failed: ' + error.message, 'error');
    return;
  }
  const saved = data.code || data;
  editingCodeId = saved.id;
  if (els.codeSelect) els.codeSelect.value = saved.id;
  editorLog('Saved: ' + escapeHtml(String(saved.title || '')));
  editorStatusText('saved');
  toast('Code saved');
  await loadCodeList();
}

/** Run the current code on the robot via POST /api/code/:id/run. */
async function runCode() {
  if (!els.pythonCode) return;
  if (!hasPermission('code:run')) {
    toast('Permission required: code:run', 'error');
    return;
  }
  const codeId = editingCodeId;
  if (!codeId) {
    toast('Save the code before running', 'error');
    return;
  }
  editorClearLog();
  editorStatusText('running…');
  try {
    const data = await apiFetch('/code/' + encodeURIComponent(codeId) + '/run', { method: 'POST' });
    editorLog(JSON.stringify(data));
    editorStatusText('done');
    toast('Code ran');
  } catch (error) {
    editorLog('Run failed: ' + error.message, 'err');
    editorStatusText('run failed');
    toast('Run failed: ' + error.message, 'error');
  }
}

/** Delete a saved code. */
async function deleteCode(id) {
  if (!confirm('Delete this code?')) return;
  try {
    await apiFetch('/code/' + encodeURIComponent(id), { method: 'DELETE' });
    if (editingCodeId === id) {
      editingCodeId = null;
      if (els.pythonCode) els.pythonCode.value = '';
      if (els.codeSelect) els.codeSelect.value = '';
      editorStatusText('—');
    }
    editorLog('Code deleted');
    toast('Code deleted');
    await loadCodeList();
  } catch (error) {
    editorLog('Delete failed: ' + error.message, 'err');
    toast('Delete failed: ' + error.message, 'error');
  }
}

/** Start a new (empty) code. */
function newCode() {
  editingCodeId = null;
  if (els.pythonCode) els.pythonCode.value = '';
  if (els.codeSelect) els.codeSelect.value = '';
  editorClearLog();
  editorStatusText('new');
}

/** Set the editor status badge text. */
function editorStatusText(text) {
  if (els.editorStatus) els.editorStatus.textContent = text;
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
  const cmdPerms = { beep: 'buzzer', morse: 'buzzer', tune: 'buzzer', led: 'led', ledSingle: 'led', ledsOff: 'led', ledAnim: 'led', forward: 'drive', backward: 'drive', turn: 'drive', stop: 'drive', driveSpeed: 'drive' };
  const perm = cmdPerms[name];
  if (perm && !hasPermission(perm)) {
    toast('Permission required: ' + perm, 'error');
    return;
  }
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

if (isAdminPage) {
  initAdmin();
} else {
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

}

// ---- Auth page (auth.html) ----
if (isAuthPage) {
  const authForm = document.getElementById('auth-form');
  const guestBtn = document.getElementById('guest-btn');
  const loginFields = document.getElementById('auth-fields-login');
  const registerFields = document.getElementById('auth-fields-register');
  const registerHint = document.getElementById('auth-hint-register');
  const loginHint = document.getElementById('auth-hint');
  const submitBtn = document.getElementById('auth-submit');
  const errorEl = document.getElementById('auth-error');
  const titleEl = document.getElementById('auth-title');

  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const show = tab.dataset.tab;
      if (loginFields) loginFields.style.display = show === 'login' ? '' : 'none';
      if (registerFields) registerFields.style.display = show === 'register' ? '' : 'none';
      if (loginHint) loginHint.style.display = show === 'login' ? 'none' : '';
      if (registerHint) registerHint.style.display = show === 'register' ? 'none' : '';
      document.querySelectorAll('.auth-tab').forEach((t) => {
        t.classList.toggle('active', t.dataset.tab === show);
      });
      if (titleEl) titleEl.textContent = show === 'register' ? 'Create account' : 'Sign in';
      if (submitBtn) submitBtn.textContent = show === 'register' ? 'Create account' : 'Sign in';
      if (errorEl) errorEl.textContent = '';
    });
  });

  if (authForm) {
    authForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (errorEl) errorEl.textContent = '';
      const formData = new FormData(authForm);
      const username = formData.get('username');
      const email = formData.get('email');
      const password = formData.get('password');
      const isRegister = document.getElementById('auth-fields-register').style.display !== 'none';
      try {
        if (isRegister) {
          await authRegister(username, email, password);
          toast('Account created. Please sign in.', 'info');
          document.querySelector('.auth-tab[data-tab="login"]').click();
        } else {
          const data = await authLogin(username, password);
          setAuth(data.token, data.user);
          location.replace('/');
        }
      } catch (error) {
        if (errorEl) errorEl.textContent = error.message || 'Authentication failed';
        toast(error.message || 'Authentication failed', 'error');
      }
    });
  }

  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      setGuest();
      location.replace('/');
    });
  }
}

// ---- Python editor handlers ----
if (els.codeSave) els.codeSave.addEventListener('click', saveCode);
if (els.codeRun) els.codeRun.addEventListener('click', runCode);
if (els.codeDelete) els.codeDelete.addEventListener('click', () => {
  if (editingCodeId) deleteCode(editingCodeId);
});
if (els.codeNew) els.codeNew.addEventListener('click', newCode);
if (els.codeSelect) els.codeSelect.addEventListener('change', (event) => {
  if (event.target.value) loadCode(event.target.value);
});

// ---- Admin UI (fetch-backed REST; runs only on admin.html) ----
async function adminFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const opts = { method: options.method || 'GET', headers };
  if (options.body) opts.body = JSON.stringify(options.body);
  const res = await fetch('/api' + path, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.message) || data || `Request failed (${res.status})`;
    throw new Error(String(msg));
  }
  return data;
}

async function ensureAdmin() {
  const pill = document.getElementById('admin-auth-pill');
  try {
    const me = await adminFetch('/auth/me');
    if (!me || me.role !== 'admin') {
      if (pill) { pill.textContent = 'not authorized'; pill.className = 'pill off'; }
      location.replace('/');
      return false;
    }
    if (pill) { pill.textContent = 'admin: ' + (me.username || me.id || ''); pill.className = 'pill on'; }
    return true;
  } catch (error) {
    if (pill) { pill.textContent = 'auth failed'; pill.className = 'pill off'; }
    location.replace('/');
    return false;
  }
}

function renderSection(sectionId) {
  document.querySelectorAll('#admin-root .section').forEach((s) => { s.classList.remove('current'); });
  document.querySelectorAll('.admin-nav .nav-link').forEach((a) => { a.classList.remove('current'); });
  const section = document.getElementById(sectionId);
  const link = document.querySelector('.admin-nav .nav-link[data-section="' + sectionId + '"]');
  if (section) section.classList.add('current');
  if (link) link.classList.add('current');
}

/* ---------- state ---------- */
let users = [];
let codieUsers = [];
let editingCodieId = null;

/* ---------- Users: GET/DELETE/PUT /api/users ---------- */
async function loadUsers() {
  let data = [];
  try {
    data = await adminFetch('/users');
  } catch (error) {
    data = [];
    toast('Failed to load users: ' + error.message, 'error');
  }
  users = Array.isArray(data) ? data : (data.users || []);
  const tbody = document.getElementById('admin-users-tbody');
  tbody.innerHTML = '';
  for (const user of users) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + escapeHtml(String(user.id)) + '</td>' +
      '<td>' + escapeHtml(String(user.username)) + '</td>' +
      '<td>' + escapeHtml(String(user.email)) + '</td>' +
      '<td><select class="admin-role-select" data-id="' + escapeHtml(String(user.id)) + '">' +
      '<option value="user"' + (user.role === 'user' ? ' selected' : '') + '>user</option>' +
      '<option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>admin</option>' +
      '</select> ' +
      '<button class="btn btn-sm btn-primary admin-save-role" data-id="' + escapeHtml(String(user.id)) + '">Save</button></td>' +
      '<td>' + escapeHtml(String(user.createdAt || '')) + '</td>' +
      '<td><button class="btn btn-sm btn-danger admin-delete-user" data-id="' + escapeHtml(String(user.id)) + '">Delete</button></td>';
    tbody.appendChild(tr);
  }
  const userSelect = document.getElementById('admin-codie-user');
  if (userSelect) {
    const current = userSelect.value;
    userSelect.innerHTML = '<option value="">— none —</option>';
    for (const user of users) {
      const opt = document.createElement('option');
      opt.value = user.id;
      opt.textContent = user.username || user.id;
      if (String(user.id) === current) opt.selected = true;
      userSelect.appendChild(opt);
    }
  }
}

async function saveUserRole(id, role) {
  await adminFetch('/users/' + encodeURIComponent(id), { method: 'PUT', body: { role } });
  toast('Role updated');
  await loadUsers();
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  await adminFetch('/users/' + encodeURIComponent(id), { method: 'DELETE' });
  toast('User deleted');
  await loadUsers();
}

/* ---------- Codie users: GET/POST/PUT/DELETE /api/codie-users ---------- */
async function loadCodieUsers() {
  let data = [];
  try {
    data = await adminFetch('/codie-users');
  } catch (error) {
    data = [];
    toast('Failed to load codie users: ' + error.message, 'error');
  }
  codieUsers = Array.isArray(data) ? data : (data.codieUsers || []);
  const tbody = document.getElementById('admin-codie-users-tbody');
  tbody.innerHTML = '';
  for (const c of codieUsers) {
    const perms = [];
    if (c.led) perms.push('LED');
    if (c.buzzer) perms.push('Buzzer');
    if (c.maxSpeed != null) perms.push('MaxSpeed ' + c.maxSpeed);
    const assigned = c.robotAddress ? 'robot:' + c.robotAddress : (c.userId ? 'user:' + c.userId : '—');
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + escapeHtml(String(c.id)) + '</td>' +
      '<td>' + escapeHtml(String(c.name)) + '</td>' +
      '<td>' + (perms.length ? perms.join(', ') : '—') + '</td>' +
      '<td>' + escapeHtml(String(assigned)) + '</td>' +
      '<td>' +
      '<button class="btn btn-sm admin-edit-codie" data-id="' + escapeHtml(String(c.id)) + '">Edit</button> ' +
      '<button class="btn btn-sm btn-danger admin-delete-codie" data-id="' + escapeHtml(String(c.id)) + '">Delete</button>' +
      '</td>';
    tbody.appendChild(tr);
  }
}

function openCodieForm(c) {
  editingCodieId = c ? c.id : null;
  const title = document.getElementById('admin-codie-form-title');
  const nameInput = document.getElementById('admin-codie-name');
  const ledInput = document.getElementById('admin-codie-led');
  const buzzerInput = document.getElementById('admin-codie-buzzer');
  const speedInput = document.getElementById('admin-codie-speed');
  const robotSelect = document.getElementById('admin-codie-robot');
  const form = document.getElementById('admin-codie-form');
  if (form.reset) form.reset();
  nameInput.value = c ? c.name : '';
  ledInput.checked = !!c && !!c.led;
  buzzerInput.checked = !!c && !!c.buzzer;
  speedInput.value = c && c.maxSpeed != null ? c.maxSpeed : '';
  if (robotSelect) robotSelect.value = c && c.robotAddress ? c.robotAddress : '';
  title.textContent = c ? 'Edit Codie User' : 'Create Codie User';
  document.getElementById('admin-codie-form-section').style.display = 'block';
  renderSection('section-codie-users');
}

function closeCodieForm() {
  editingCodieId = null;
  document.getElementById('admin-codie-form-section').style.display = 'none';
}

async function saveCodieUser() {
  const nameInput = document.getElementById('admin-codie-name');
  const ledInput = document.getElementById('admin-codie-led');
  const buzzerInput = document.getElementById('admin-codie-buzzer');
  const speedInput = document.getElementById('admin-codie-speed');
  const userSelect = document.getElementById('admin-codie-user');
  const robotSelect = document.getElementById('admin-codie-robot');
  const body = {
    name: nameInput.value.trim(),
    led: ledInput.checked,
    buzzer: buzzerInput.checked,
    maxSpeed: speedInput.value === '' ? null : Number(speedInput.value),
    userId: userSelect.value || null,
    robotAddress: robotSelect.value || null,
  };
  if (!body.name) { toast('Name is required', 'error'); return; }
  try {
    if (editingCodieId) {
      await adminFetch('/codie-users/' + encodeURIComponent(editingCodieId), { method: 'PUT', body });
    } else {
      await adminFetch('/codie-users', { method: 'POST', body });
    }
  } catch (error) {
    toast('Save failed: ' + error.message, 'error');
    return;
  }
  toast('Codie user saved');
  closeCodieForm();
  await loadCodieUsers();
}

async function deleteCodieUser(id) {
  if (!confirm('Delete this codie user?')) return;
  await adminFetch('/codie-users/' + encodeURIComponent(id), { method: 'DELETE' });
  toast('Codie user deleted');
  await loadCodieUsers();
}

/* ---------- Robots: GET /api/robots (assignment dropdown source) ---------- */
async function loadRobots() {
  let data = [];
  try {
    data = await adminFetch('/robots');
  } catch (error) {
    data = [];
    toast('Failed to load robots: ' + error.message, 'error');
  }
  robots = Array.isArray(data) ? data : (data.robots || []);
  const tbody = document.getElementById('admin-robots-tbody');
  tbody.innerHTML = '';
  for (const r of robots) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + escapeHtml(String(r.address || r.id || '')) + '</td>' +
      '<td>' + escapeHtml(String(r.name || '')) + '</td>' +
      '<td>' + escapeHtml(String(r.variant || '')) + '</td>' +
      '<td>' + (r.connected ? 'connected' : 'disconnected') + '</td>' +
      '<td>' + escapeHtml(String(r.rssi !== undefined ? r.rssi : '')) + '</td>' +
      '<td>' + escapeHtml(String(r.firmware || '')) + '</td>';
    tbody.appendChild(tr);
  }
  const robotSelect = document.getElementById('admin-codie-robot');
  if (robotSelect) {
    const current = robotSelect.value;
    robotSelect.innerHTML = '<option value="">— none —</option>';
    for (const r of robots) {
      const addr = r.address || r.id;
      const opt = document.createElement('option');
      opt.value = addr;
      opt.textContent = (r.name || addr) + ' (' + addr + ')';
      if (String(addr) === current) opt.selected = true;
      robotSelect.appendChild(opt);
    }
  }
}

/* ---------- init ---------- */
async function initAdmin() {
  const ok = await ensureAdmin();
  if (!ok) return;

  document.getElementById('admin-sign-out').addEventListener('click', () => {
    location.replace('/');
  });

  document.querySelectorAll('.admin-nav .nav-link').forEach((a) => {
    a.addEventListener('click', (event) => {
      event.preventDefault();
      renderSection(a.getAttribute('data-section'));
    });
  });

  document.getElementById('admin-new-codie').addEventListener('click', () => openCodieForm(null));
  document.getElementById('admin-cancel-codie').addEventListener('click', closeCodieForm);
  document.getElementById('admin-codie-form').addEventListener('submit', (event) => {
    event.preventDefault();
    saveCodieUser();
  });

  document.getElementById('admin-users-tbody').addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;
    if (btn.classList.contains('admin-save-role')) {
      const row = btn.closest('tr');
      const select = row.querySelector('.admin-role-select');
      saveUserRole(id, select.value);
    } else if (btn.classList.contains('admin-delete-user')) {
      deleteUser(id);
    }
  });

  document.getElementById('admin-codie-users-tbody').addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;
    if (btn.classList.contains('admin-edit-codie')) {
      const c = codieUsers.find((x) => String(x.id) === id);
      openCodieForm(c || null);
    } else if (btn.classList.contains('admin-delete-codie')) {
      deleteCodieUser(id);
    }
  });

  await loadUsers();
  await loadCodieUsers();
  await loadRobots();
  renderSection('section-users');
}
/* ---------- app init ---------- */
(async function init() {
  // Restore auth state from localStorage + validate with the backend.
  if (authToken) {
    try {
      const data = await authMe();
      setAuth(authToken, data.user);
      if (isAuthPage) location.replace('/');

    } catch (error) {
      // Token invalid/expired — clear it.
      clearAuth();
    }
  } else if (isAuthPage) {
    // On auth page, no need to do anything special.
  }

  if (isAdminPage) {
    await initAdmin();
    return;
  }

  // index.html: load saved code list and refresh permission UI.
  await loadCodeList();
  updateAuthUI();

  // Logout button (shown on index after login).
  if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      await authLogout();
      clearAuth();
      location.replace('/');
    });
  }
})();
