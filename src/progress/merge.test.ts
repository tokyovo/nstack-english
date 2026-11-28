import { mergeProgress } from './merge';
import type { Progress } from './schema';

const PROFILE = 'p1';

function progress(lessons: Progress['lessons'], answers: Progress['answers'] = {}): Progress {
  return { schemaVersion: 1, profileId: PROFILE, lessons, answers };
}

const phone = progress(
  {
    'everyday-a0-u1': {
      firstCompletedAt: '2026-11-20T08:00:00.000Z',
      lastCompletedAt: '2026-11-25T08:00:00.000Z',
      bestCorrect: 7,
      total: 10,
      timesCompleted: 2,
    },
    'everyday-a0-u2': {
      firstCompletedAt: '2026-11-26T08:00:00.000Z',
      lastCompletedAt: '2026-11-26T08:00:00.000Z',
      bestCorrect: 10,
      total: 10,
      timesCompleted: 1,
    },
  },
  {
    'everyday-a0-u1-1': [
      { at: '2026-11-20T08:01:00.000Z', correct: false },
      { at: '2026-11-25T08:01:00.000Z', correct: true },
    ],
  }
);

const web = progress(
  {
    'everyday-a0-u1': {
      firstCompletedAt: '2026-11-22T08:00:00.000Z',
      lastCompletedAt: '2026-11-27T08:00:00.000Z',
      bestCorrect: 9,
      total: 10,
      timesCompleted: 1,
    },
    'work-a0-u1': {
      firstCompletedAt: '2026-11-27T09:00:00.000Z',
      lastCompletedAt: '2026-11-27T09:00:00.000Z',
      bestCorrect: 4,
      total: 12,
      timesCompleted: 1,
    },
  },
  {
    'everyday-a0-u1-1': [
      { at: '2026-11-22T08:01:00.000Z', correct: true },
      { at: '2026-11-25T08:01:00.000Z', correct: true },
    ],
    'work-a0-u1-2': [{ at: '2026-11-27T09:01:00.000Z', correct: false }],
  }
);

describe('mergeProgress', () => {
  it('keeps the earliest first completion, the latest last completion and the best score of a lesson', () => {
    const merged = mergeProgress(phone, web);

    expect(merged.lessons['everyday-a0-u1']).toEqual({
      firstCompletedAt: '2026-11-20T08:00:00.000Z',
      lastCompletedAt: '2026-11-27T08:00:00.000Z',
      bestCorrect: 9,
      total: 10,
      timesCompleted: 2,
    });
  });

  it('keeps lessons completed on only one side', () => {
    const merged = mergeProgress(phone, web);

    expect(Object.keys(merged.lessons).sort()).toEqual(['everyday-a0-u1', 'everyday-a0-u2', 'work-a0-u1']);
    expect(merged.lessons['everyday-a0-u2']).toEqual(phone.lessons['everyday-a0-u2']);
    expect(merged.lessons['work-a0-u1']).toEqual(web.lessons['work-a0-u1']);
  });

  it('unions the answers to each item, oldest first, keeping an answer both sides have once', () => {
    const merged = mergeProgress(phone, web);

    expect(merged.answers).toEqual({
      'everyday-a0-u1-1': [
        { at: '2026-11-20T08:01:00.000Z', correct: false },
        { at: '2026-11-22T08:01:00.000Z', correct: true },
        { at: '2026-11-25T08:01:00.000Z', correct: true },
      ],
      'work-a0-u1-2': [{ at: '2026-11-27T09:01:00.000Z', correct: false }],
    });
  });

  it('keeps a right and a wrong answer given at the same time as two answers', () => {
    const a = progress({}, { item: [{ at: '2026-11-20T08:00:00.000Z', correct: true }] });
    const b = progress({}, { item: [{ at: '2026-11-20T08:00:00.000Z', correct: false }] });

    expect(mergeProgress(a, b).answers.item).toEqual([
      { at: '2026-11-20T08:00:00.000Z', correct: false },
      { at: '2026-11-20T08:00:00.000Z', correct: true },
    ]);
  });

  it('is idempotent: merging a document with itself, or merging the same one twice, changes nothing', () => {
    expect(mergeProgress(phone, phone)).toEqual(phone);

    const once = mergeProgress(phone, web);
    expect(mergeProgress(once, web)).toEqual(once);
  });

  it('is commutative: the order of the two documents does not matter', () => {
    expect(mergeProgress(web, phone)).toEqual(mergeProgress(phone, web));
  });

  it('is associative: three devices converge whichever syncs first', () => {
    const tablet = progress(
      {
        'everyday-a0-u1': {
          firstCompletedAt: '2026-11-19T08:00:00.000Z',
          lastCompletedAt: '2026-11-19T08:00:00.000Z',
          bestCorrect: 5,
          total: 10,
          timesCompleted: 3,
        },
      },
      { 'everyday-a0-u1-1': [{ at: '2026-11-19T08:01:00.000Z', correct: false }] }
    );

    expect(mergeProgress(mergeProgress(phone, web), tablet)).toEqual(
      mergeProgress(phone, mergeProgress(web, tablet))
    );
  });

  it('merging with an empty document returns the same progress', () => {
    expect(mergeProgress(progress({}), web)).toEqual(web);
  });

  it('keeps a unit or item whose id is __proto__ as an ordinary entry', () => {
    const saved = JSON.parse(
      '{"schemaVersion":1,"profileId":"p1","lessons":{},"answers":{"__proto__":[{"at":"2026-11-20T08:00:00.000Z","correct":true}]}}'
    ) as Progress;

    const merged = mergeProgress(progress({}), saved);

    expect(Object.keys(merged.answers)).toEqual(['__proto__']);
    expect(Object.getPrototypeOf(merged.answers)).toBe(Object.prototype);
  });
});
