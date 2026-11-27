// The content test: every unit file in content/ follows the schema and the
// cross-unit rules, uses only sources listed in SOURCES.md, and is in the app's index.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { checkContent } from './check';
import { getUnit, units, unitsOf } from './index';
import { parseUnit, type Unit } from './schema';

const contentDir = join(__dirname, '..', '..', 'content');

function unitFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return unitFiles(path);
    return entry.name.endsWith('.json') ? [path] : [];
  });
}

/** Source ids are the first column of the table in SOURCES.md, written as `id`. */
function listedSources(): string[] {
  const markdown = readFileSync(join(contentDir, 'SOURCES.md'), 'utf8');
  return [...markdown.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((match) => match[1]);
}

const files = unitFiles(contentDir);
const parsed = files.map((path) => ({
  path: relative(contentDir, path),
  result: parseUnit(JSON.parse(readFileSync(path, 'utf8'))),
}));
const valid: Unit[] = parsed.flatMap(({ result }) => (result.ok ? [result.unit] : []));

describe('content files', () => {
  it('has unit files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(parsed)('$path follows the unit schema', ({ result }) => {
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it.each(parsed)('$path sits at content/<track>/<level>/u<number>.json', ({ path, result }) => {
    if (!result.ok) return;
    const { track, level, number } = result.unit;
    expect(path).toBe(join(track, level, `u${number}.json`));
  });

  it('passes the cross-unit checks with the sources listed in SOURCES.md', () => {
    expect(checkContent(valid, listedSources())).toEqual([]);
  });

  it('lists every unit file in the app index, in teaching order per track', () => {
    expect(units.map((u) => u.id).sort()).toEqual(valid.map((u) => u.id).sort());
    expect(getUnit('everyday-a0-u1')?.title).toBe('Chào hỏi');
    expect(unitsOf('everyday')[0].id).toBe('everyday-a0-u1');
  });
});
