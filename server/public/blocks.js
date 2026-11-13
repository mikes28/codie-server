/**
 * Codie Block Editor — Scratch-like block-based programming interface.
 *
 * Vanilla JS (no heavy deps). Works alongside the existing app.js; it is a
 * separate page (blocks.html) so the control surface is untouched.
 *
 * Features:
 *  - Drag-and-drop block palette, workspace stacking and statement nesting
 *  - Block -> Python code generation (robot command set via ctx)
 *  - Python text -> block visualization sync (two-way, supported subset)
 *  - Run (POST /api/code/run) and save (localStorage) buttons
 */

'use strict';

const socket = io();

/* ---------------- configuration ---------------- */

const SNAP_DIST = 24; // px for stack snap
const STACK_GAP = 8; // px between stacked blocks

// Python function used for line-sensor conditionals (best-effort, valid Python).
const LINE_SENSOR_FN = 'line_sensor';

/* ---------------- block definitions ----------------

Each definition:
  type      unique block id
  category  movement|sound|led|control  (colour)
  title     label shown on the block
  fields    editable fields: {name, type, label, default, options}
            type: number|text|select|color
  stmt      name of statement input ('do') or null
  toPython  (el, ctx) -> string line for this block (no indent)
  parse     (line) -> {fields} or null  (Python text -> block)

Code generation uses the robot script Context (ctx):
  ctx.robot.forward/backward/turn/stop/beep/led/led_single/tune
  ctx.wait(ms)
  ctx.robot.api.command("driveSpeed"/"ledAnim", {...})
*/
const BLOCKS = {
  move_forward: {
    category: 'movement',
    title: 'Move forward',
    fields: [
      { name: 'cm', type: 'number', label: 'cm', default: 20, min: 0, max: 200 },
      { name: 'speed', type: 'number', label: 'speed', default: 40, min: -100, max: 100 },
    ],
    stmt: null,
    toPython: (el) => {
      const f = fieldValues(el);
      return `ctx.robot.forward(${f.cm}, ${f.speed})`;
    },
    parse: (line) => {
      const m = line.match(/ctx\.robot\.forward\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/);
      if (!m) return null;
      return { cm: m[1], speed: m[2] };
    },
  },
  move_backward: {
    category: 'movement',
    title: 'Move backward',
    fields: [
      { name: 'cm', type: 'number', label: 'cm', default: 20, min: 0, max: 200 },
      { name: 'speed', type: 'number', label: 'speed', default: -40, min: -100, max: 100 },
    ],
    stmt: null,
    toPython: (el) => {
      const f = fieldValues(el);
      return `ctx.robot.backward(${f.cm}, ${f.speed})`;
    },
    parse: (line) => {
      const m = line.match(/ctx\.robot\.backward\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/);
      if (!m) return null;
      return { cm: m[1], speed: m[2] };
    },
  },
  turn: {
    category: 'movement',
    title: 'Turn',
    fields: [
      { name: 'deg', type: 'number', label: 'deg', default: 90, min: -360, max: 360 },
      { name: 'speed', type: 'number', label: 'speed', default: 40, min: -100, max: 100 },
    ],
    stmt: null,
    toPython: (el) => {
      const f = fieldValues(el);
      return `ctx.robot.turn(${f.deg}, ${f.speed})`;
    },
    parse: (line) => {
      const m = line.match(/ctx\.robot\.turn\(\s*([0-9.-]+)\s*,\s*([0-9.]+)\s*\)/);
      if (!m) return null;
      return { deg: m[1], speed: m[2] };
    },
  },
  set_speed: {
    category: 'movement',
    title: 'Set speed',
    fields: [
      { name: 'left', type: 'number', label: 'left %', default: 40, min: -100, max: 100 },
      { name: 'right', type: 'number', label: 'right %', default: 40, min: -100, max: 100 },
    ],
    stmt: null,
    toPython: (el) => {
      const f = fieldValues(el);
      return `ctx.robot.api.command("driveSpeed", {"left": ${f.left}, "right": ${f.right}})`;
    },
    parse: (line) => {
      const m = line.match(/ctx\.robot\.api\.command\("driveSpeed",\s*\{\s*"left"\s*:\s*([0-9.-]+)\s*,\s*"right"\s*:\s*([0-9.-]+)\s*\}\s*\)/);
      if (!m) return null;
      return { left: m[1], right: m[2] };
    },
  },
  stop: {
    category: 'movement',
    title: 'Stop',
    fields: [],
    stmt: null,
    toPython: () => 'ctx.robot.stop()',
    parse: (line) => (line === 'ctx.robot.stop()' ? {} : null),
  },
  beep: {
    category: 'sound',
    title: 'Beep',
    fields: [
      { name: 'ms', type: 'number', label: 'ms', default: 500, min: 0, max: 5000 },
    ],
    stmt: null,
    toPython: (el) => `ctx.robot.beep(${fieldValues(el).ms})`,
    parse: (line) => {
      const m = line.match(/ctx\.robot\.beep\(\s*([0-9.]+)\s*\)/);
      if (!m) return null;
      return { ms: m[1] };
    },
  },
  led_all: {
    category: 'led',
    title: 'Set LED color (all)',
    fields: [
      { name: 'color', type: 'color', label: 'color', default: '#22c3aa' },
    ],
    stmt: null,
    toPython: (el) => `ctx.robot.led("${fieldValues(el).color}")`,
    parse: (line) => {
      const m = line.match(/ctx\.robot\.led\(\s*"([^"]+)"\s*\)/);
      if (!m) return null;
      return { color: hexFromCss(m[1]) };
    },
  },
  led_single: {
    category: 'led',
    title: 'Set LED color (index)',
    fields: [
      { name: 'index', type: 'number', label: 'index', default: 1, min: 1, max: 12 },
      { name: 'color', type: 'color', label: 'color', default: '#22c3aa' },
    ],
    stmt: null,
    toPython: (el) => {
      const f = fieldValues(el);
      return `ctx.robot.led_single("${f.color}", ${f.index})`;
    },
    parse: (line) => {
      const m = line.match(/ctx\.robot\.led_single\(\s*"([^"]+)"\s*,\s*([0-9]+)\s*\)/);
      if (!m) return null;
      return { color: hexFromCss(m[1]), index: m[2] };
    },
  },
  led_brightness: {
    category: 'led',
    title: 'LED brightness',
    fields: [
      { name: 'level', type: 'number', label: '0-255', default: 128, min: 0, max: 255 },
    ],
    stmt: null,
    toPython: (el) => `set_led_brightness(${fieldValues(el).level})`,
    parse: (line) => {
      const m = line.match(/set_led_brightness\(\s*([0-9.]+)\s*\)/);
      if (!m) return null;
      return { level: m[1] };
    },
  },
  led_animation: {
    category: 'led',
    title: 'LED animation',
    fields: [
      {
        name: 'mode',
        type: 'select',
        label: 'animation',
        default: 'chase',
        options: [
          { label: 'Stop', value: 'stop' },
          { label: 'Chase', value: 'chase' },
          { label: 'Sine', value: 'sine' },
        ],
      },
    ],
    stmt: null,
    toPython: (el) => {
      const f = fieldValues(el);
      const anim = { stop: 0, chase: 1, sine: 2 }[f.mode] ?? 0;
      return `ctx.robot.api.command("ledAnim", {"animation": ${anim}})`;
    },
    parse: (line) => {
      const m = line.match(/ctx\.robot\.api\.command\("ledAnim",\s*\{\s*"animation"\s*:\s*([0-9]+)\s*\}\s*\)/);
      if (!m) return null;
      const mode = { '0': 'stop', '1': 'chase', '2': 'sine' }[m[1]] ?? 'stop';
      return { mode };
    },
  },
  wait: {
    category: 'control',
    title: 'Wait',
    fields: [
      { name: 'ms', type: 'number', label: 'ms', default: 500, min: 0, max: 60000 },
    ],
    stmt: null,
    toPython: (el) => `ctx.wait(${fieldValues(el).ms})`,
    parse: (line) => {
      const m = line.match(/ctx\.wait\(\s*([0-9.]+)\s*\)/);
      if (!m) return null;
      return { ms: m[1] };
    },
  },
  tune: {
    category: 'sound',
    title: 'Play tune',
    fields: [
      {
        name: 'name',
        type: 'select',
        label: 'tune',
        default: 'alert',
        options: [
          { label: 'Alert', value: 'alert' },
          { label: 'Success', value: 'success' },
          { label: 'Error', value: 'error' },
          { label: 'Charge', value: 'charge' },
          { label: 'Shave & haircut', value: 'shave_haircut' },
        ],
      },
    ],
    stmt: null,
    toPython: (el) => `ctx.robot.tune("${fieldValues(el).name}")`,
    parse: (line) => {
      const m = line.match(/ctx\.robot\.tune\(\s*"([^"]+)"\s*\)/);
      if (!m) return null;
      return { name: m[1] };
    },
  },
  repeat: {
    category: 'control',
    title: 'Repeat',
    fields: [
      { name: 'times', type: 'number', label: 'times', default: 10, min: 1, max: 1000 },
    ],
    stmt: 'do',
    toPython: (el) => `for _ in range(${fieldValues(el).times}):`,
    parse: (line) => {
      const m = line.match(/for _ in range\(\s*([0-9.]+)\s*\):/);
      if (!m) return null;
      return { times: m[1] };
    },
  },
  if_line: {
    category: 'control',
    title: 'If line sensor',
    fields: [
      {
        name: 'side',
        type: 'select',
        label: 'side',
        default: 'left',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
    ],
    stmt: 'do',
    toPython: (el) => `${LINE_SENSOR_FN}("${fieldValues(el).side}"):`,
    parse: (line) => {
      const m = line.match(`${LINE_SENSOR_FN}\\(\\s*"(left|right)"\\s*\\):`);
      if (!m) return null;
      return { side: m[1] };
    },
  },
};

/* ---------------- state ---------------- */

let nextBlockId = 1;
let updating = false; // re-entrancy guard for block <-> text sync
let dirty = false;
let activeAddress = null;

const els = {
  palette: document.getElementById('block-palette'),
  workspace: document.getElementById('blocks-workspace'),
  trash: document.getElementById('blocks-trash'),
  code: document.getElementById('blocks-code'),
  status: document.getElementById('code-status'),
  blockCount: document.getElementById('block-count'),
  robotPill: document.getElementById('robot-pill'),
  socketPill: document.getElementById('socket-pill'),
  runBtn: document.getElementById('blocks-run'),
  saveBtn: document.getElementById('blocks-save'),
  copyBtn: document.getElementById('code-copy'),
  clearBtn: document.getElementById('blocks-clear'),
  toast: document.getElementById('toast'),
};

/* ---------------- palette rendering ---------------- */

function fieldHtml(def, value) {
  switch (def.type) {
    case 'number':
      return `<input type="number" data-field="${def.name}" value="${escapeHtml(
        value ?? def.default
      )}" ${def.min !== undefined ? `min="${def.min}"` : ''} ${
        def.max !== undefined ? `max="${def.max}"` : ''
      } />`;
    case 'text':
      return `<input type="text" data-field="${def.name}" value="${escapeHtml(
        value ?? def.default
      )}" />`;
    case 'color':
      return `<input type="color" data-field="${def.name}" value="${escapeHtml(
        value ?? def.default
      )}" />`;
    case 'select': {
      const opts = def.options
        .map(
          (o) =>
            `<option value="${escapeHtml(o.value)}" ${
              (value ?? def.default) == o.value ? 'selected' : ''
            }>${escapeHtml(o.label)}</option>`
        )
        .join('');
      return `<select data-field="${def.name}">${opts}</select>`;
    }
    default:
      return '';
  }
}

function renderBlockEl(type, values = {}, x = 10, y = 10) {
  const def = BLOCKS[type];
  const id = `block-${nextBlockId++}`;
  const fieldRows = def.fields
    .map((f) => {
      const v = values[f.name] !== undefined ? values[f.name] : f.default;
      return `<div class="field"><label style="font-size:10px;color:var(--muted);display:block;margin-bottom:2px;">${escapeHtml(
        f.label
      )}</label>${fieldHtml(f, v)}</div>`;
    })
    .join('');
  const stmt = def.stmt
    ? `<div class="stmt-input"><div class="stmt-empty">&#9656; drag blocks here</div></div>`
    : '';
  const el = document.createElement('div');
  el.className = `block c-${def.category}`;
  el.dataset.type = type;
  el.dataset.id = id;
  el.id = id;
  el.style.position = 'absolute';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.innerHTML = `<div class="handle" style="display:flex;align-items:center;gap:6px;"><span class="ic">${iconFor(
    def.category
  )}</span><span class="block-title">${escapeHtml(def.title)}</span></div>${fieldRows}${stmt}`;
  els.workspace.appendChild(el);
  bindBlockHandlers(el);
  return el;
}

function iconFor(category) {
  return { movement: '&#9654;', sound: '&#127929;', led: '&#128165;', control: '&#9998;' }[category] || '&#9881;';
}

function fieldValues(el) {
  const out = {};
  el.querySelectorAll('[data-field]').forEach((input) => {
    out[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value;
  });
  return out;
}

/* ---------------- workspace handlers ---------------- */

function bindBlockHandlers(el) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const handle = e.target.closest('.handle');
    if (!handle) return;
    if (e.target.closest('input,select,button')) return;
    e.preventDefault();
    startDrag(el, e.clientX, e.clientY);
  });
}

function startDrag(block, clientX, clientY) {
  const isTemplate = block.closest('#block-palette') !== null;
  let dragEl;
  if (isTemplate) {
    dragEl = renderBlockEl(block.dataset.type, fieldValues(block), clientX - 10, clientY - 10);
    dragEl.style.left = clientX - 10 + 'px';
    dragEl.style.top = clientY - 10 + 'px';
  } else {
    dragEl = block;
    // bring to front
    dragEl.style.zIndex = 50;
  }

  const rect = dragEl.getBoundingClientRect();
  const offsetX = clientX - rect.left;
  const offsetY = clientY - rect.top;

  const dragState = {
    block: dragEl,
    offsetX,
    offsetY,
    startX: parseFloat(dragEl.style.left) || 0,
    startY: parseFloat(dragEl.style.top) || 0,
    isTemplate,
  };

  dragEl.classList.add('dragging');
  els.trash.classList.add('over');

  const move = (e) => {
    dragState.block.style.left = e.clientX - dragState.offsetX + 'px';
    dragState.block.style.top = e.clientY - dragState.offsetY + 'px';
    updateDragHover(e.clientX, e.clientY);
  };

  const up = (e) => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    dragEl.classList.remove('dragging');
    els.trash.classList.remove('over');
    clearHover();
    finishDrag(dragState, e.clientX, e.clientY);
  };

  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

let hoverTarget = null; // {kind:'stack', block} | {kind:'stmt', el} | null
let hoverMarker = null;

function updateDragHover(cx, cy) {
  const dragged = dragStateBlock();
  if (!dragged) return;
  dragged.style.display = 'none';
  const under = document.elementFromPoint(cx, cy);
  dragged.style.display = '';
  clearHover();

  const blockUnder = under ? under.closest('.block') : null;
  const stmtUnder = under ? under.closest('.stmt-input') : null;

  // nesting into a statement input takes precedence
  if (stmtUnder && stmtUnder.closest('.block') !== dragged && !isInside(dragged, stmtUnder)) {
    const parentBlock = stmtUnder.closest('.block');
    hoverTarget = { kind: 'stmt', el: stmtUnder, block: parentBlock };
    stmtUnder.classList.add('insert-marker');
    return;
  }

  // stack snap: hover near bottom of another block -> attach below
  if (blockUnder && blockUnder !== dragged && !isInside(dragged, blockUnder)) {
    const bRect = blockUnder.getBoundingClientRect();
    const dRect = dragged.getBoundingClientRect();
    // near bottom edge of blockUnder and vertically aligned-ish
    if (cy >= bRect.bottom - SNAP_DIST && cy <= bRect.bottom + SNAP_DIST && Math.abs(cx - (bRect.left + bRect.width / 2)) < bRect.width / 2 + 40) {
      // avoid creating a cycle: dragged must not be an ancestor of blockUnder
      if (!isAncestor(blockUnder, dragged)) {
        hoverTarget = { kind: 'stack', block: blockUnder };
        blockUnder.classList.add('insert-marker');
      }
    }
  }
}

function clearHover() {
  if (hoverMarker) hoverMarker.remove();
  hoverMarker = null;
  document.querySelectorAll('.block.insert-marker, .stmt-input.insert-marker').forEach((el) =>
    el.classList.remove('insert-marker')
  );
  hoverTarget = null;
}

function dragStateBlock() {
  return document.querySelector('.block.dragging');
}

function isInside(a, b) {
  return b.contains(a);
}

function isAncestor(possibleAncestor, node) {
  let cur = node.parentElement;
  while (cur) {
    if (cur === possibleAncestor) return true;
    cur = cur.parentElement;
  }
  return false;
}

function finishDrag(dragState, cx, cy) {
  clearHover();
  const { block: dragEl, isTemplate } = dragState;
  const wasTemplate = dragEl.closest('#block-palette') !== null || isTemplate;

  // trash?
  const trashRect = els.trash.getBoundingClientRect();
  const inTrash = cx >= trashRect.left && cx <= trashRect.right && cy >= trashRect.top && cy <= trashRect.bottom;

  if (inTrash) {
    removeBlockSubtree(dragEl);
    dirty = true;
    syncAll();
    return;
  }

  if (wasTemplate) {
    // already appended to workspace in startDrag; just finalize position
    snapIntoPlace(dragEl, cx, cy);
    dirty = true;
    syncAll();
    return;
  }

  // workspace block moved
  snapIntoPlace(dragEl, cx, cy);
  dirty = true;
  syncAll();
}

function snapIntoPlace(dragEl, cx, cy) {
  if (!hoverTarget) return;
  if (hoverTarget.kind === 'stmt') {
    // nest into statement input (as first child of the stack inside stmt)
    const stmt = hoverTarget.el;
    const empty = stmt.querySelector('.stmt-empty');
    if (empty) empty.remove();
    // clear any previous next on the moved block's old position handled by detach
    detachBlock(dragEl);
    stmt.appendChild(dragEl);
    dragEl.style.position = 'static';
    dragEl.style.left = '';
    dragEl.style.top = '';
    layoutStmt(stmt.closest('.block'));
    return;
  }
  if (hoverTarget.kind === 'stack') {
    const target = hoverTarget.block;
    // insert dragEl below target in the stack chain
    detachBlock(dragEl);
    const oldNext = target.dataset.next;
    target.dataset.next = dragEl.dataset.id;
    dragEl.dataset.next = oldNext ?? '';
    // position below target
    layoutStackFrom(target);
    return;
  }
}

/* detach a block from its stack parent (clear parent's next pointer to it) */
function detachBlock(el) {
  const parent = findStackParent(el);
  if (parent) {
    if (parent.dataset.next === el.dataset.id) parent.dataset.next = '';
  }
  // also remove from any statement input (re-parented by caller)
}

function findStackParent(el) {
  const all = els.workspace.querySelectorAll('.block');
  for (const p of all) {
    if (p.dataset.next === el.dataset.id) return p;
  }
  // also check nested inside statements
  const nested = els.workspace.querySelectorAll('.stmt-input');
  for (const stmt of nested) {
    const first = stmt.querySelector(':scope > .block');
    if (first && first.dataset.id === el.dataset.id) return null; // handled by stmt reparent
  }
  return null;
}

function removeBlockSubtree(el) {
  // clear stack parent pointer
  const parent = findStackParent(el);
  if (parent && parent.dataset.next === el.dataset.id) parent.dataset.next = '';
  // remove nested statement blocks too
  const stmt = el.querySelector('.stmt-input');
  if (stmt) {
    stmt.querySelectorAll('.block').forEach((b) => removeBlockSubtree(b));
    stmt.innerHTML = '<div class="stmt-empty">&#9656; drag blocks here</div>';
  }
  el.remove();
}

/* layout a stack starting at top block, positioning each next block below */
function layoutStackFrom(top) {
  let cur = top;
  let y = parseFloat(cur.style.top || '0');
  while (cur) {
    const nextId = cur.dataset.next;
    const h = cur.getBoundingClientRect().height;
    cur.style.top = y + 'px';
    y += h + STACK_GAP;
    cur = nextId ? document.getElementById('block-' + nextId) : null;
  }
}

function layoutStmt(blockEl) {
  const stmt = blockEl.querySelector('.stmt-input');
  if (!stmt) return;
  const empty = stmt.querySelector('.stmt-empty');
  if (empty) {
    // keep empty placeholder if no children
    if (!stmt.querySelector(':scope > .block')) return;
    empty.remove();
  }
  let cur = stmt.querySelector(':scope > .block');
  let y = 6;
  while (cur) {
    cur.style.position = 'static';
    cur.style.left = '';
    cur.style.top = y + 'px';
    const h = cur.getBoundingClientRect().height;
    y += h + STACK_GAP;
    const nextId = cur.dataset.next;
    cur = nextId ? document.getElementById('block-' + nextId) : null;
  }
  stmt.style.display = '';
}

/* get top-level blocks (direct children of workspace, not a next target) */
function getTopBlocks() {
  const direct = Array.from(els.workspace.children).filter((c) => c.classList.contains('block'));
  const nextTargets = new Set();
  els.workspace.querySelectorAll('.block').forEach((b) => {
    if (b.dataset.next) nextTargets.add(b.dataset.next);
  });
  return direct.filter((b) => !nextTargets.has(b.dataset.id));
}

/* ---------------- code generation ---------------- */

function generatePython() {
  const lines = ['def run(ctx):'];
  const tops = getTopBlocks();
  if (tops.length === 0) {
    lines.push('    pass');
  } else {
    for (const top of tops) {
      emitBlock(top, lines, 1);
    }
  }
  return lines.join('\n');
}

function emitBlock(el, lines, indent) {
  const def = BLOCKS[el.dataset.type];
  if (!def) return;
  lines.push('    '.repeat(indent) + def.toPython(el));
  const stmt = el.querySelector('.stmt-input');
  if (stmt) {
    let cur = stmt.querySelector(':scope > .block');
    while (cur) {
      emitBlock(cur, lines, indent + 1);
      const nextId = cur.dataset.next;
      cur = nextId ? document.getElementById('block-' + nextId) : null;
    }
  }
  const nextId = el.dataset.next;
  if (nextId) {
    const next = document.getElementById('block-' + nextId);
    if (next) emitBlock(next, lines, indent);
  }
}

/* ---------------- Python -> blocks (text sync) ---------------- */

function parsePythonToBlocks(code) {
  const lines = code.split('\n');
  // strip leading 'def run(ctx):'
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*def\s+run\s*\(/.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  const body = lines.slice(start);
  const structure = [];
  consumeBlock(body, 0, 0, structure);
  return structure;
}

// Consuming recursive parser: parses blocks at `baseIndent` starting at index i,
// pushes into `result`, returns index of first unconsumed line.
function consumeBlock(lines, i, baseIndent, result) {
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'pass' || trimmed.startsWith('#')) {
      i++;
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent < baseIndent) return i;
    if (indent > baseIndent) {
      i++; // orphan
      continue;
    }
    const block = parseLine(trimmed);
    if (!block) {
      i++;
      continue;
    }
    i++;
    // parse children at baseIndent+4
    const children = [];
    i = consumeBlock(lines, i, baseIndent + 4, children);
    block.children = children;
    result.push(block);
  }
  return i;
}

function parseLine(trimmed) {
  for (const type of Object.keys(BLOCKS)) {
    const def = BLOCKS[type];
    const fields = def.parse(trimmed);
    if (fields !== null) return { type, fields, children: [] };
  }
  return null;
}

function renderStructure(structure, containerEl, baseX, baseY) {
  // containerEl: a block whose stmt-input we fill, or the workspace
  let y = baseY;
  let prevId = null;
  for (const blk of structure) {
    const el = renderBlockEl(blk.type, blk.fields, baseX, y);
    if (prevId) {
      const prev = document.getElementById('block-' + prevId);
      if (prev) prev.dataset.next = el.dataset.id;
    }
    el.dataset.next = '';
    prevId = el.dataset.id;
    y += el.getBoundingClientRect().height + STACK_GAP;
    if (blk.children && blk.children.length) {
      const stmt = el.querySelector('.stmt-input');
      const empty = stmt.querySelector('.stmt-empty');
      if (empty) empty.remove();
      renderStructure(blk.children, el, 0, 6);
      layoutStmt(el);
    }
  }
}

function rebuildWorkspaceFromStructure(structure) {
  els.workspace.querySelectorAll('.block').forEach((b) => b.remove());
  let y = 10;
  let prevId = null;
  for (const blk of structure) {
    const el = renderBlockEl(blk.type, blk.fields, 10, y);
    if (prevId) {
      const prev = document.getElementById('block-' + prevId);
      if (prev) prev.dataset.next = el.dataset.id;
    }
    el.dataset.next = '';
    prevId = el.dataset.id;
    y += el.getBoundingClientRect().height + STACK_GAP;
    if (blk.children && blk.children.length) {
      const stmt = el.querySelector('.stmt-input');
      const empty = stmt.querySelector('.stmt-empty');
      if (empty) empty.remove();
      renderIntoStmt(el, blk.children, 0, 6);
    }
  }
}

function renderIntoStmt(blockEl, children, baseX, baseY) {
  const stmt = blockEl.querySelector('.stmt-input');
  if (!stmt) return;
  const empty = stmt.querySelector('.stmt-empty');
  if (empty) empty.remove();
  let y = baseY;
  let prevId = null;
  for (const blk of children) {
    const el = renderBlockEl(blk.type, blk.fields, baseX, y);
    el.style.position = 'static';
    el.style.left = '';
    el.style.top = y + 'px';
    if (prevId) {
      const prev = document.getElementById('block-' + prevId);
      if (prev) prev.dataset.next = el.dataset.id;
    }
    el.dataset.next = '';
    prevId = el.dataset.id;
    y += el.getBoundingClientRect().height + STACK_GAP;
    if (blk.children && blk.children.length) {
      renderIntoStmt(el, blk.children, 0, 6);
    }
  }
  layoutStmt(blockEl);
}

/* ---------------- sync ---------------- */

function blockChanged() {
  updateBlockCount();
  if (updating) return;
  dirty = true;
  setStatus('Generated Python');
  scheduleGenerate();
}

let genTimer = null;
function scheduleGenerate() {
  clearTimeout(genTimer);
  genTimer = setTimeout(() => {
    genTimer = null;
    if (updating) return;
    updating = true;
    try {
      const code = generatePython();
      if (els.code.value !== code) els.code.value = code;
    } finally {
      updating = false;
    }
  }, 150);
}

function syncTextToBlocks() {
  if (updating) return;
  const code = els.code.value.trim();
  if (!code) return;
  updating = true;
  try {
    const structure = parsePythonToBlocks(code);
    rebuildWorkspaceFromStructure(structure);
    blockChanged();
  } finally {
    updating = false;
  }
}

function updateBlockCount() {
  const n = els.workspace.querySelectorAll('.block').length;
  els.blockCount.textContent = n;
}

function setStatus(msg) {
  els.status.textContent = msg;
  setTimeout(() => { if (els.status.textContent === msg) els.status.textContent = 'Ready'; }, 1500);
}

/* ---------------- I/O: run / save / copy ---------------- */

function robotSelectHtml() {
  return `<label style="font-size:11px;color:var(--muted);margin-right:6px;">Robot</label>
    <select id="robot-select" style="font-size:11px;padding:2px 6px;border-radius:3px;background:var(--bg);border:1px solid var(--panel-border);color:var(--text);"><option value="">select robot</option></select>
    <input type="text" id="robot-address" placeholder="address" style="font-size:11px;padding:2px 6px;border-radius:3px;background:var(--bg);border:1px solid var(--panel-border);color:var(--text);width:130px;" />`;
}

async function loadRobots() {
  try {
    const res = await fetch('/api/robots');
    const data = await res.json();
    const select = document.getElementById('robot-select');
    if (!select) return;
    select.innerHTML = '<option value="">select robot</option>';
    (data.robots || []).forEach((r) => {
      const addr = r.address || r.mac || r.id;
      if (!addr) return;
      const o = document.createElement('option');
      o.value = addr;
      o.textContent = addr;
      select.appendChild(o);
    });
    select.addEventListener('change', () => {
      activeAddress = select.value;
      const input = document.getElementById('robot-address');
      if (input) input.value = activeAddress;
      els.robotPill.textContent = activeAddress ? `robot: ${activeAddress}` : 'robot: —';
    });
  } catch (e) {
    // robots endpoint may not be available; fall back to manual input
  }
}

async function runCode() {
  const code = els.code.value.trim();
  if (!code) {
    toast('No code to run', 'error');
    return;
  }
  const addr = activeAddress || document.getElementById('robot-address')?.value.trim();
  if (!addr) {
    toast('Select or enter a robot address', 'error');
    return;
  }
  activeAddress = addr;
  els.runBtn.disabled = true;
  els.runBtn.textContent = 'Running…';
  setStatus('Running on ' + addr);
  try {
    const res = await fetch('/api/code/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: addr, code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `run failed (${res.status})`);
    }
    const result = await res.json();
    toast('Script started on ' + addr, 'success');
    setStatus('Started: ' + (result.name || '__codie_blocks__'));
  } catch (err) {
    toast(err.message || 'Run failed', 'error');
    setStatus('Run failed');
  } finally {
    els.runBtn.disabled = false;
    els.runBtn.textContent = 'Run on robot';
  }
}

function saveCode() {
  try {
    localStorage.setItem('codie_blocks_code', els.code.value);
    toast('Saved to browser', 'success');
    setStatus('Saved');
    dirty = false;
  } catch (e) {
    toast('Save failed', 'error');
  }
}

function loadSavedCode() {
  try {
    const saved = localStorage.getItem('codie_blocks_code');
    if (saved) els.code.value = saved;
  } catch (e) {
    // ignore
  }
}

function copyCode() {
  els.code.select();
  try {
    document.execCommand('copy');
    toast('Copied Python', 'success');
  } catch (e) {
    toast('Copy failed', 'error');
  }
}

function toast(message, kind = 'info') {
  els.toast.textContent = message;
  els.toast.className = 'toast show ' + (kind === 'error' ? 'error' : kind === 'success' ? 'success' : '');
  setTimeout(() => { els.toast.className = els.toast.className.replace(/\bshow\b/, '').trim(); }, 2000);
}

function clearWorkspace() {
  if (!confirm('Clear all blocks?')) return;
  els.workspace.querySelectorAll('.block').forEach((b) => b.remove());
  dirty = true;
  syncAll();
}

/* ---------------- init ---------------- */

function syncAll() {
  // blocks -> text
  clearTimeout(genTimer);
  genTimer = setTimeout(() => {
    genTimer = null;
    if (updating) return;
    updating = true;
    try {
      const code = generatePython();
      if (els.code.value !== code) els.code.value = code;
    } finally {
      updating = false;
    }
  }, 100);
}

els.code.addEventListener('input', () => {
  if (updating) return;
  dirty = true;
  setStatus('Editing Python…');
  clearTimeout(genTimer);
  genTimer = setTimeout(syncTextToBlocks, 400);
});

els.runBtn.addEventListener('click', runCode);
els.saveBtn.addEventListener('click', saveCode);
els.copyBtn.addEventListener('click', copyCode);
els.clearBtn.addEventListener('click', clearWorkspace);

// Escape helper
function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hexFromCss(css) {
  // css color like #rgb or #rrggbb -> #rrggbb
  const c = String(css);
  if (/^#([0-9a-fA-F]{3})$/.test(c)) {
    return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
  }
  return c;
}

// Render palette categories with draggable template blocks
function renderPalette() {
  const byCategory = {};
  Object.keys(BLOCKS).forEach((type) => {
    const cat = BLOCKS[type].category;
    (byCategory[cat] = byCategory[cat] || []).push(type);
  });
  els.palette.innerHTML = '';
  Object.entries(byCategory).forEach(([category, types]) => {
    const div = document.createElement('div');
    div.className = 'palette-category';
    div.textContent = '';
    const label = document.createElement('strong');
    label.textContent = category[0].toUpperCase() + category.slice(1);
    div.appendChild(label);
    types.forEach((type) => {
      const def = BLOCKS[type];
      const tpl = renderBlockEl(type, {}, 0, 0);
      tpl.style.position = 'static';
      tpl.style.margin = '6px 8px';
      tpl.style.width = 'fit-content';
      tpl.style.cursor = 'grab';
      tpl.dataset.template = '1';
      div.appendChild(tpl);
    });
    els.palette.appendChild(div);
  });
}

socket.on('connect', () => {
  els.socketPill.textContent = 'socket ●';
  els.socketPill.className = 'pill on';
  loadRobots();
});
socket.on('disconnect', () => {
  els.socketPill.textContent = 'socket ●';
  els.socketPill.className = 'pill off';
});

// Insert robot selector into workspace actions after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const actions = document.querySelector('.workspace-actions');
  if (actions) {
    actions.innerHTML = robotSelectHtml() + '<span class="pill" id="robot-pill">robot: —</span>';
    els.robotPill = document.getElementById('robot-pill');
  }
  renderPalette();
  loadSavedCode();
  syncAll();
});
