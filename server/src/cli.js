/**
 * Small CLI helper utilities — argument parsing and table printing.
 * (No external dependency — the scripts run offline.)
 */

'use strict';

/** Parse `--flag`, `--key value`, `--key=value` and positional arguments. */
export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        flags[arg.slice(2)] = argv[i + 1];
        i += 1;
      } else {
        flags[arg.slice(2)] = true;
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      for (let j = 1; j < arg.length; j += 1) {
        flags[arg[j]] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { _: positional, flags };
}

/** True when the flag is enabled (`--flag`, `--flag=1`, `--flag=true`). */
export function flagEnabled(value) {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  return /^(1|true|yes|on)$/i.test(value);
}

/** Print the robot list as a table. */
export function formatRobotTable(robots) {
  if (!robots.length) return '(none)';
  const pad = (s, w) => String(s).padEnd(w, ' ');
  const rows = [
    pad('ADDRESS', 20) + pad('NAME', 14) + pad('VARIANT', 14) + 'REASONS',
    pad('-'.repeat(20), 20) + pad('-'.repeat(14), 14) + pad('-'.repeat(14), 14) + '-',
  ];
  for (const r of robots) {
    rows.push(
      pad(r.address, 20) +
        pad(r.name || '(unnamed)', 14) +
        pad(r.variant || 'unknown', 14) +
        (r.matchReasons ? r.matchReasons.join(',') : '')
    );
  }
  return rows.join('\n');
}

/** Format a line-sensor value — generation-dependent shape:
 *  - routing: { left, right } (12-bit values);
 *  - no-routing: single fixed-point value (level + onLine). */
export function formatLine(line) {
  if (!line) return '-';
  if (line.left !== undefined || line.right !== undefined) {
    return `L=${line.left ?? '-'} R=${line.right ?? '-'}`;
  }
  return `value=${line.value ?? '-'} level=${line.level ?? '-'}% onLine=${line.onLine}`;
}

/** Print telemetry readably. */
export function formatTelemetry(telemetry) {
  const parts = [];
  if (telemetry.battery !== undefined) parts.push(`battery=${telemetry.battery}%`);
  if (telemetry.sonar !== undefined) parts.push(`sonar=${telemetry.sonar}mm`);
  if (telemetry.light !== undefined) parts.push(`light=${telemetry.light}`);
  if (telemetry.line !== undefined) parts.push(`line=${formatLine(telemetry.line)}`);
  if (telemetry.mic !== undefined) parts.push(`mic=${telemetry.mic}`);
  return parts.join('  ');
}

/** Clean exit: stdout writes may be async, so don't call process.exit()
 * immediately (it would drop unflushed output). Close the BLE connection
 * and pass the exit code through. */
export function finish(code = 0, noble = null) {
  if (noble) {
    try {
      noble.stopScanningAsync();
    } catch (e) {
      // ignore
    }
  }
  process.exit(code);
}
