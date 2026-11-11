/**
 * Built-in rhythm patterns for the Codie's fixed-pitch beeper.
 *
 * Each pattern is [[beep_ms, gap_ms], ...] — a sequence of beep/gap pairs
 * consumed by the beep/morse/tune command layer.
 */

'use strict';

export const TUNES = {
  // Shave and a haircut (two bits)
  shave_haircut: [
    [300, 150], [300, 150], [150, 150], [150, 150],
    [300, 150], [300, 150], [600, 300], [150, 0],
  ],
  // Charge! fanfare
  charge: [
    [200, 100], [200, 100], [200, 100], [400, 200],
    [200, 100], [400, 200], [600, 0],
  ],
  // Alert: three short beeps
  alert: [
    [200, 200], [200, 200], [200, 0],
  ],
  // Success: ascending
  success: [
    [150, 100], [200, 100], [300, 0],
  ],
  // Error: descending
  error: [
    [300, 100], [200, 100], [150, 0],
  ],
};

/** Tune names available to the frontend. */
export const TUNE_NAMES = Object.keys(TUNES);
