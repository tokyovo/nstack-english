import type { Unit } from '@/content';
import { mergeProgress } from '@/progress/merge';
import { emptyProgress, type AnswerRecord, type Progress } from '@/progress/schema';
import { dueWords, learnedWords } from '@/review/schedule';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

function unit(id: string, wordIds: string[]): Unit {
  const [track] = id.split('-');
  return {
    id,
    track: track === 'kids' || track === 'work' ? track : 'everyday',
    level: 'a0',
    number: Number(id.slice(id.lastIndexOf('u') + 1)),
    title: id,
    goals: [],
    source: 'original',
    words: wordIds.map((word) => ({ id: `${id}-${word}`, en: word, vi: word })),
    exercises: [],
  };
}

const u1 = unit('everyday-a0-u1', ['hello', 'goodbye', 'thank-you']);
const u2 = unit('everyday-a0-u2', ['one', 'two']);
const units = [u1, u2];

const COMPLETED = '2026-11-27T08:00:00.000Z';
const completedAt = Date.parse(COMPLETED);

function at(offset: number): string {
  return new Date(completedAt + offset).toISOString();
}

function progressWith(lessons: Record<string, string>, answers: Record<string, AnswerRecord[]> = {}): Progress {
  const progress = emptyProgress('local');
  for (const [unitId, time] of Object.entries(lessons)) {
    progress.lessons[unitId] = {
      firstCompletedAt: time,
      lastCompletedAt: time,
      bestCorrect: 10,
      total: 10,
      timesCompleted: 1,
    };
  }
  return { ...progress, answers };
}

function dueIds(progress: Progress, now: number): string[] {
  return dueWords(progress, units, new Date(now)).map((entry) => entry.word.id);
}

function scheduleOf(progress: Progress, wordId: string) {
  const entry = learnedWords(progress, units).find((e) => e.word.id === wordId);
  if (!entry) throw new Error(`${wordId} is not learned`);
  return { box: entry.box, dueAt: entry.dueAt.toISOString() };
}

describe('review schedule', () => {
  it('has nothing to review before any lesson is finished', () => {
    const progress = emptyProgress('local');

    expect(learnedWords(progress, units)).toEqual([]);
    expect(dueIds(progress, completedAt + 365 * DAY)).toEqual([]);
  });

  it('never brings back a word from a unit that is not finished', () => {
    const progress = progressWith({ 'everyday-a0-u1': COMPLETED });

    const due = dueIds(progress, completedAt + 365 * DAY);

    expect(due).toEqual(['everyday-a0-u1-hello', 'everyday-a0-u1-goodbye', 'everyday-a0-u1-thank-you']);
    expect(due).not.toContain('everyday-a0-u2-one');
  });

  it('puts the words of a finished unit in box 1, due 10 minutes later', () => {
    const progress = progressWith({ 'everyday-a0-u1': COMPLETED });

    expect(scheduleOf(progress, 'everyday-a0-u1-hello')).toEqual({
      box: 1,
      dueAt: '2026-11-27T08:10:00.000Z',
    });
    expect(dueIds(progress, completedAt + 9 * MINUTE)).toEqual([]);
    expect(dueIds(progress, completedAt + 10 * MINUTE)).toHaveLength(3);
  });

  it('waits 1, 3, 7, 16 and 35 days after each right answer in a row, then stays at 35 days', () => {
    const answers: AnswerRecord[] = [];
    const expected = [
      { box: 2, dueAt: '2026-11-28T08:00:00.000Z' },
      { box: 3, dueAt: '2026-11-30T08:00:00.000Z' },
      { box: 4, dueAt: '2026-12-04T08:00:00.000Z' },
      { box: 5, dueAt: '2026-12-13T08:00:00.000Z' },
      { box: 6, dueAt: '2027-01-01T08:00:00.000Z' },
      { box: 6, dueAt: '2027-01-01T08:00:00.000Z' },
    ];
    const seen = expected.map((_, i) => {
      answers.push({ at: COMPLETED, correct: true });
      return scheduleOf(
        progressWith({ 'everyday-a0-u1': COMPLETED }, { 'everyday-a0-u1-hello': [...answers] }),
        'everyday-a0-u1-hello',
      );
    });

    expect(seen).toEqual(expected);
  });

  it('counts each interval from the last answer', () => {
    const progress = progressWith(
      { 'everyday-a0-u1': COMPLETED },
      {
        'everyday-a0-u1-hello': [
          { at: at(10 * MINUTE), correct: true },
          { at: at(2 * DAY), correct: true },
        ],
      },
    );

    expect(scheduleOf(progress, 'everyday-a0-u1-hello')).toEqual({
      box: 3,
      dueAt: '2026-12-02T08:00:00.000Z',
    });
  });

  it('sends a word answered wrongly back to box 1, due 10 minutes later', () => {
    const progress = progressWith(
      { 'everyday-a0-u1': COMPLETED },
      {
        'everyday-a0-u1-hello': [
          { at: at(10 * MINUTE), correct: true },
          { at: at(1 * DAY), correct: true },
          { at: at(4 * DAY), correct: false },
        ],
      },
    );

    expect(scheduleOf(progress, 'everyday-a0-u1-hello')).toEqual({
      box: 1,
      dueAt: '2026-12-01T08:10:00.000Z',
    });
  });

  it('brings a word answered wrongly back before the same word answered rightly', () => {
    const answeredAt = at(10 * MINUTE);
    const progress = progressWith(
      { 'everyday-a0-u1': COMPLETED },
      {
        'everyday-a0-u1-hello': [{ at: answeredAt, correct: false }],
        'everyday-a0-u1-goodbye': [{ at: answeredAt, correct: true }],
        'everyday-a0-u1-thank-you': [{ at: answeredAt, correct: true }],
      },
    );

    expect(dueIds(progress, completedAt + 30 * MINUTE)).toEqual(['everyday-a0-u1-hello']);
    expect(dueIds(progress, completedAt + 2 * DAY)).toEqual([
      'everyday-a0-u1-hello',
      'everyday-a0-u1-goodbye',
      'everyday-a0-u1-thank-you',
    ]);
  });

  it('lists the longest-waiting word first', () => {
    const progress = progressWith(
      { 'everyday-a0-u1': COMPLETED, 'everyday-a0-u2': at(1 * DAY) },
      { 'everyday-a0-u1-hello': [{ at: at(2 * DAY), correct: false }] },
    );

    expect(dueIds(progress, completedAt + 3 * DAY)).toEqual([
      'everyday-a0-u1-goodbye',
      'everyday-a0-u1-thank-you',
      'everyday-a0-u2-one',
      'everyday-a0-u2-two',
      'everyday-a0-u1-hello',
    ]);
  });

  it('ignores answers given before the unit was finished', () => {
    const progress = progressWith(
      { 'everyday-a0-u1': COMPLETED },
      { 'everyday-a0-u1-hello': [{ at: at(-1 * DAY), correct: true }] },
    );

    expect(scheduleOf(progress, 'everyday-a0-u1-hello')).toEqual({
      box: 1,
      dueAt: '2026-11-27T08:10:00.000Z',
    });
  });

  it('reads the clock it is given, never the system clock', () => {
    const progress = progressWith({ 'everyday-a0-u1': COMPLETED });
    const spy = jest.spyOn(Date, 'now').mockReturnValue(completedAt + 365 * DAY);

    expect(dueIds(progress, completedAt)).toEqual([]);
    spy.mockRestore();
  });

  it('tells which unit and track each word comes from', () => {
    const progress = progressWith({ 'everyday-a0-u2': COMPLETED });

    expect(learnedWords(progress, units).map((e) => [e.word.en, e.unitId, e.track])).toEqual([
      ['one', 'everyday-a0-u2', 'everyday'],
      ['two', 'everyday-a0-u2', 'everyday'],
    ]);
  });
});

describe('review schedule with answer histories cut to the last 7', () => {
  /** A seeded generator (mulberry32), so every run checks the same histories. */
  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('gives every word the same box and due time as its full history, over 2000 random histories', () => {
    const next = random(20261128);
    const wordId = 'everyday-a0-u1-hello';
    for (let run = 0; run < 2000; run += 1) {
      const length = Math.floor(next() * 30);
      // Answers from a day before the lesson (ignored by the schedule) to 60 days after.
      let time = completedAt - DAY;
      const answers: AnswerRecord[] = Array.from({ length }, () => {
        time += Math.floor(next() * 4 * DAY);
        return { at: new Date(time).toISOString(), correct: next() < 0.75 };
      });
      const full = progressWith({ 'everyday-a0-u1': COMPLETED }, { [wordId]: answers });

      const cut = mergeProgress(full, emptyProgress('local'));

      expect(cut.answers[wordId].length).toBeLessThanOrEqual(7);
      expect(scheduleOf(cut, wordId)).toEqual(scheduleOf(full, wordId));
    }
  });
});
