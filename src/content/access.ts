// Which units are free and which need Premium. Shared by the app, the server and the
// manifest script, which load it by path, so it imports by path with the extension.
import { inTeachingOrder } from './check.ts';
import { tracks, type Unit } from './schema.ts';

/** Free units at the start of every track; the rest need Premium (a business decision, see needs-human.md). */
export const FREE_UNITS_PER_TRACK = 3;

export type Access = 'free' | 'premium';

/** What the app knows of every unit, free or premium, without its words and exercises. */
export type UnitSummary = Pick<Unit, 'id' | 'track' | 'level' | 'number' | 'title'> & { access: Access };

/** Summaries of `units`, grouped by track in `tracks` order, each track in teaching order. */
export function catalogOf(units: readonly Unit[]): UnitSummary[] {
  return tracks.flatMap((track) =>
    inTeachingOrder(units.filter((unit) => unit.track === track)).map(
      ({ id, level, number, title }, i): UnitSummary => ({
        id,
        track,
        level,
        number,
        title,
        access: i < FREE_UNITS_PER_TRACK ? 'free' : 'premium',
      })
    )
  );
}
