// The content index: every unit the app can list, and the bodies of the free units it bundles.
// Both come from the generated manifest (`npm run content:manifest`); premium bodies are on the server.
import type { UnitSummary } from './access';
import { bundledFiles, catalog } from './manifest';
import { parseUnit, type Track, type Unit, type Word } from './schema';

export type { Access, UnitSummary } from './access';
export type { Exercise, ExerciseType, Level, Track, Unit, Word } from './schema';
export { isTemplate, levels, tracks } from './schema';

function load(data: unknown): Unit {
  const result = parseUnit(data);
  if (!result.ok) throw new Error(`Invalid content unit:\n${result.errors.join('\n')}`);
  return result.unit;
}

/** Every unit of a track, free and premium, in teaching order (level, then number), without bodies. */
export function unitsOf(track: Track): UnitSummary[] {
  return catalog.filter((u) => u.track === track);
}

/** The units whose words and exercises are in the app (the free ones), grouped like `unitsOf`. */
export const bundledUnits: readonly Unit[] = bundledFiles.map(load);

/** A bundled unit; undefined for a premium unit, whose body the app does not have. */
export function getUnit(id: string): Unit | undefined {
  return bundledUnits.find((u) => u.id === id);
}

/** A word from any unit, e.g. the prompt of a choose_meaning exercise. */
export function getWord(id: string): Word | undefined {
  for (const unit of bundledUnits) {
    const word = unit.words.find((w) => w.id === id);
    if (word) return word;
  }
  return undefined;
}
