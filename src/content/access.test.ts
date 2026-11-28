import { catalogOf } from './access';
import type { Level, Track, Unit } from './schema';

function unit(track: Track, level: Level, number: number): Unit {
  return {
    id: `${track}-${level}-u${number}`,
    track,
    level,
    number,
    title: `Bài ${number}`,
    goals: [],
    source: 'original',
    words: [],
    exercises: [],
  };
}

describe('catalogOf', () => {
  it('makes the first 3 units of each track in teaching order free and the rest premium', () => {
    const shuffled = [
      unit('kids', 'a0', 2),
      unit('everyday', 'a1', 1),
      unit('everyday', 'a0', 3),
      unit('everyday', 'a0', 1),
      unit('everyday', 'a0', 4),
      unit('everyday', 'a0', 2),
    ];
    expect(catalogOf(shuffled).map((u) => [u.id, u.access])).toEqual([
      ['everyday-a0-u1', 'free'],
      ['everyday-a0-u2', 'free'],
      ['everyday-a0-u3', 'free'],
      ['everyday-a0-u4', 'premium'],
      ['everyday-a1-u1', 'premium'],
      ['kids-a0-u2', 'free'],
    ]);
  });

  it('keeps the title, level and number for listing a unit without its body', () => {
    expect(catalogOf([unit('work', 'a0', 1)])).toEqual([
      { id: 'work-a0-u1', track: 'work', level: 'a0', number: 1, title: 'Bài 1', access: 'free' },
    ]);
  });
});
