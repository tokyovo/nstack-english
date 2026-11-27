// The content index: every unit the app can show, parsed and typed.
// Add each new unit file to `files`; the content test fails on one left out.
import everydayA0U1 from '../../content/everyday/a0/u1.json';

import { inTeachingOrder } from './check';
import { parseUnit, tracks, type Track, type Unit, type Word } from './schema';

export type { Exercise, ExerciseType, Level, Track, Unit, Word } from './schema';
export { levels, tracks } from './schema';

const files: unknown[] = [everydayA0U1];

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
