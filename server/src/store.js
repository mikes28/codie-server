/**
 * Small JSON file store for user/codie-user/code data.
 *
 * All files live in server/data/ and are rewritten atomically on each write.
 * The in-memory read is not cached so concurrent HTTP workers always see the
 * latest disk state (sufficient for the single-process dev server).
 */

'use strict';

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data');

/** Read a JSON data file, returning an empty array when missing or empty. */
export async function readJson(name) {
  try {
    const content = await readFile(path.join(dataDir, name), 'utf8');
    if (!content.trim()) return [];
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/** Write a JSON data file with stable formatting. */
export async function writeJson(name, data) {
  await writeFile(path.join(dataDir, name), JSON.stringify(data, null, 2) + '\n');
}

/** Data file names. */
export const USERS_FILE = 'users.json';
export const CODIE_USERS_FILE = 'codie-users.json';
export const CODES_FILE = 'codes.json';
