// The content index: every unit the app can show, parsed and typed.
// Add each new unit file to `files`; the content test fails on one left out.
import everydayA0U1 from '../../content/everyday/a0/u1.json';
import everydayA0U2 from '../../content/everyday/a0/u2.json';
import everydayA0U3 from '../../content/everyday/a0/u3.json';
import everydayA0U4 from '../../content/everyday/a0/u4.json';
import everydayA0U5 from '../../content/everyday/a0/u5.json';
import everydayA1U6 from '../../content/everyday/a1/u6.json';
import everydayA1U7 from '../../content/everyday/a1/u7.json';
import everydayA1U8 from '../../content/everyday/a1/u8.json';
import everydayA1U9 from '../../content/everyday/a1/u9.json';
import everydayA1U10 from '../../content/everyday/a1/u10.json';
import workA0U1 from '../../content/work/a0/u1.json';
import workA0U2 from '../../content/work/a0/u2.json';
import workA0U3 from '../../content/work/a0/u3.json';
import workA1U4 from '../../content/work/a1/u4.json';
import workA1U5 from '../../content/work/a1/u5.json';
import workA1U6 from '../../content/work/a1/u6.json';
import kidsA0U1 from '../../content/kids/a0/u1.json';
import kidsA0U2 from '../../content/kids/a0/u2.json';
import kidsA0U3 from '../../content/kids/a0/u3.json';
import kidsA0U4 from '../../content/kids/a0/u4.json';
import kidsA0U5 from '../../content/kids/a0/u5.json';
import kidsA1U6 from '../../content/kids/a1/u6.json';
import kidsA1U7 from '../../content/kids/a1/u7.json';
import kidsA1U8 from '../../content/kids/a1/u8.json';

import { inTeachingOrder } from './check';
import { parseUnit, tracks, type Track, type Unit, type Word } from './schema';

export type { Exercise, ExerciseType, Level, Track, Unit, Word } from './schema';
export { isTemplate, levels, tracks } from './schema';

const files: unknown[] = [
  everydayA0U1,
  everydayA0U2,
  everydayA0U3,
  everydayA0U4,
  everydayA0U5,
  everydayA1U6,
  everydayA1U7,
  everydayA1U8,
  everydayA1U9,
  everydayA1U10,
  workA0U1,
  workA0U2,
  workA0U3,
  workA1U4,
  workA1U5,
  workA1U6,
  kidsA0U1,
  kidsA0U2,
  kidsA0U3,
  kidsA0U4,
  kidsA0U5,
  kidsA1U6,
  kidsA1U7,
  kidsA1U8,
];

function load(data: unknown): Unit {
  const result = parseUnit(data);
  if (!result.ok) throw new Error(`Invalid content unit:\n${result.errors.join('\n')}`);
  return result.unit;
}

const loaded = files.map(load);

/** Units of a track in teaching order (level, then number). */
export function unitsOf(track: Track): Unit[] {
  return inTeachingOrder(loaded.filter((u) => u.track === track));
}

/** All units, grouped by track in `tracks` order, each track in teaching order. */
export const units: readonly Unit[] = tracks.flatMap(unitsOf);

export function getUnit(id: string): Unit | undefined {
  return units.find((u) => u.id === id);
}

/** A word from any unit, e.g. the prompt of a choose_meaning exercise. */
export function getWord(id: string): Word | undefined {
  for (const unit of units) {
    const word = unit.words.find((w) => w.id === id);
    if (word) return word;
  }
  return undefined;
}
