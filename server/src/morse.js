/**
 * Morse code -> rhythm pattern for the Codie's fixed-frequency beeper.
 *
 * The Codie's speaker plays a single pitch, but the beep length and the
 * gaps are controllable — that's enough for Morse code.
 */

'use strict';

export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.',
  F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---',
  P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--',
  Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
  '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.', '-': '-....-', _: '..--.-', '"': '.-..-.',
  '@': '.--.-.',
};

/** Text -> [[beep_ms, gap_ms], ...] Morse rhythm.
 * Unknown characters are skipped; the final gap is 0.
 * @returns {Array<[number, number]>} */
export function textToRhythm(text, unitMs = 120) {
  const words = String(text)
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  const pattern = [];
  for (let wi = 0; wi < words.length; wi += 1) {
    const chars = [...words[wi]].filter((c) => MORSE[c] !== undefined);
    for (let ci = 0; ci < chars.length; ci += 1) {
      const code = MORSE[chars[ci]];
      for (let si = 0; si < code.length; si += 1) {
        const beep = unitMs * (code[si] === '-' ? 3 : 1);
        let gap;
        if (si < code.length - 1) gap = unitMs; // signals within a letter
        else if (ci < chars.length - 1) gap = unitMs * 3; // between letters
        else if (wi < words.length - 1) gap = unitMs * 7; // between words
        else gap = 0; // nothing after the end
        pattern.push([beep, gap]);
      }
    }
  }
  return pattern;
}
