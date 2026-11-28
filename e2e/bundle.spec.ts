// The exported web app (dist/, built by the drive server global setup starts) must not carry
// premium units' words or exercises: those come only from GET /api/units/:id. Reads content/,
// so units added later are covered without editing this file.
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { expect, test } from '@playwright/test';

import { catalogOf } from '../src/content/access.ts';
import { readUnits } from '../src/content/files.ts';

const root = join(import.meta.dirname, '..');
const textExtensions = new Set(['.js', '.html', '.json', '.css', '.map', '.txt']);

function textFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return textFiles(path);
    return textExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

const units = readUnits(join(root, 'content'));
const access = new Map(catalogOf(units).map((unit) => [unit.id, unit.access]));
/** Ids of each unit's words and exercises, quoted as they appear in bundled JSON. */
function itemIds(which: 'free' | 'premium'): string[] {
  return units
    .filter((unit) => access.get(unit.id) === which)
    .flatMap((unit) => [...unit.words, ...unit.exercises].map((item) => `"${item.id}"`));
}
const bundle = textFiles(join(root, 'dist'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

test('the web bundle has every free unit item, so the search below reads the real bundle', () => {
  expect(itemIds('free').length).toBeGreaterThan(0);
  expect(itemIds('free').filter((id) => !bundle.includes(id))).toEqual([]);
});

test('the web bundle has no premium unit word or exercise', () => {
  expect(itemIds('premium').length).toBeGreaterThan(0);
  expect(itemIds('premium').filter((id) => bundle.includes(id))).toEqual([]);
});
