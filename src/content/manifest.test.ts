// The app's manifest (src/content/manifest.ts) is generated from content/ and must match it:
// after changing content, run `npm run content:manifest`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readUnits } from './files';
import { manifestSource } from './manifest-source';
import type { Unit } from './schema';

const contentDir = join(__dirname, '..', '..', 'content');

function unit(id: string, title: string): Unit {
  const [track, level, n] = id.split('-');
  return {
    id,
    track: track as Unit['track'],
    level: level as Unit['level'],
    number: Number(n.slice(1)),
    title,
    goals: [],
    source: 'original',
    words: [],
    exercises: [],
  };
}

describe('manifestSource', () => {
  const source = manifestSource(
    ['u1', 'u2', 'u3', 'u4'].map((u, i) => unit(`kids-a0-${u}`, `Bài ${i + 1}`))
  );

  it('bundles only the free units', () => {
    expect(source).toContain("import kidsA0U3 from '../../content/kids/a0/u3.json';");
    expect(source).toContain('export const bundledFiles: unknown[] = [kidsA0U1, kidsA0U2, kidsA0U3];');
    expect(source).not.toContain('u4.json');
  });

  it('lists every unit by title with its access', () => {
    expect(source).toContain(
      '{"id":"kids-a0-u4","track":"kids","level":"a0","number":4,"title":"Bài 4","access":"premium"}'
    );
  });
});

describe('the generated manifest', () => {
  it('matches content/ (run `npm run content:manifest` after changing content)', () => {
    const committed = readFileSync(join(__dirname, 'manifest.ts'), 'utf8');
    expect(committed).toBe(manifestSource(readUnits(contentDir)));
  });
});
