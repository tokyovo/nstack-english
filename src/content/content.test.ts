// The content test: every unit file in content/ follows the schema and the
// cross-unit rules, uses only sources listed in SOURCES.md, and is in the app's index.
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { checkContent } from './check';
import { unitFiles } from './files';
import { bundledUnits, getUnit, unitsOf } from './index';
import { parseUnit, type Unit } from './schema';

const contentDir = join(__dirname, '..', '..', 'content');

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

  it('lists every unit file in the app index by title, in teaching order per track', () => {
    const listed = (['everyday', 'work', 'kids'] as const).flatMap(unitsOf);
    expect(listed.map((u) => u.id).sort()).toEqual(valid.map((u) => u.id).sort());
    expect(unitsOf('everyday')[0]).toMatchObject({ id: 'everyday-a0-u1', title: 'Chào hỏi', access: 'free' });
    expect(unitsOf('everyday')[3]).toMatchObject({ id: 'everyday-a0-u4', access: 'premium' });
  });

  it('bundles the bodies of free units only', () => {
    expect(getUnit('everyday-a0-u1')?.words.length).toBeGreaterThan(0);
    expect(getUnit('everyday-a0-u4')).toBeUndefined();
    expect(bundledUnits.map((u) => u.id)).toEqual(
      expect.arrayContaining(['everyday-a0-u3', 'work-a0-u3', 'kids-a0-u3'])
    );
    expect(bundledUnits.map((u) => u.id)).not.toContain('kids-a0-u4');
  });
});
