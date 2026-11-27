import AsyncStorage from '@react-native-async-storage/async-storage';

import { createProgressStore, isLessonCompleted, LOCAL_PROFILE_ID } from '@/progress';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

/** A fake clock that returns each given time in turn, then keeps returning the last one. */
function clockAt(...isoTimes: string[]) {
  let calls = 0;
  return () => new Date(isoTimes[Math.min(calls++, isoTimes.length - 1)]);
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('progress store', () => {
  it('starts a new profile with no completed lessons and no answers', async () => {
    const progress = await createProgressStore().load(LOCAL_PROFILE_ID);

    expect(progress.lessons).toEqual({});
    expect(progress.answers).toEqual({});
    expect(isLessonCompleted(progress, 'everyday-a0-u1')).toBe(false);
  });

  it('keeps a completed lesson after the app is closed and opened again', async () => {
    const firstRun = createProgressStore({ now: clockAt('2026-11-27T08:00:00.000Z') });
    await firstRun.completeLesson(LOCAL_PROFILE_ID, {
      unitId: 'everyday-a0-u1',
      correct: 9,
      total: 10,
    });

    const progress = await createProgressStore().load(LOCAL_PROFILE_ID);

    expect(isLessonCompleted(progress, 'everyday-a0-u1')).toBe(true);
    expect(isLessonCompleted(progress, 'everyday-a0-u2')).toBe(false);
    expect(progress.lessons['everyday-a0-u1']).toEqual({
      firstCompletedAt: '2026-11-27T08:00:00.000Z',
      lastCompletedAt: '2026-11-27T08:00:00.000Z',
      bestCorrect: 9,
      total: 10,
      timesCompleted: 1,
    });
  });

  it('keeps every answer to an item, oldest first, with the time it was given', async () => {
    const store = createProgressStore({
      now: clockAt('2026-11-27T08:00:00.000Z', '2026-11-27T08:01:00.000Z', '2026-11-28T07:30:00.000Z'),
    });
    await store.recordAnswer(LOCAL_PROFILE_ID, { itemId: 'everyday-a0-u1-3', correct: false });
    await store.recordAnswer(LOCAL_PROFILE_ID, { itemId: 'everyday-a0-u1-4', correct: true });
    await store.recordAnswer(LOCAL_PROFILE_ID, { itemId: 'everyday-a0-u1-3', correct: true });

    const progress = await createProgressStore().load(LOCAL_PROFILE_ID);

    expect(progress.answers).toEqual({
      'everyday-a0-u1-3': [
        { at: '2026-11-27T08:00:00.000Z', correct: false },
        { at: '2026-11-28T07:30:00.000Z', correct: true },
      ],
      'everyday-a0-u1-4': [{ at: '2026-11-27T08:01:00.000Z', correct: true }],
    });
  });

  it('updates a lesson finished again but keeps when it was first finished', async () => {
    const store = createProgressStore({
      now: clockAt('2026-11-27T08:00:00.000Z', '2026-11-29T20:15:00.000Z', '2026-11-30T06:00:00.000Z'),
    });
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'kids-a0-u1', correct: 6, total: 10 });
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'kids-a0-u1', correct: 10, total: 10 });
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'kids-a0-u1', correct: 8, total: 10 });

    const progress = await createProgressStore().load(LOCAL_PROFILE_ID);

    expect(progress.lessons['kids-a0-u1']).toEqual({
      firstCompletedAt: '2026-11-27T08:00:00.000Z',
      lastCompletedAt: '2026-11-30T06:00:00.000Z',
      bestCorrect: 10,
      total: 10,
      timesCompleted: 3,
    });
  });

  it('keeps each profile separate', async () => {
    const store = createProgressStore();
    await store.completeLesson('child-1', { unitId: 'kids-a0-u2', correct: 10, total: 10 });

    expect(isLessonCompleted(await store.load('child-1'), 'kids-a0-u2')).toBe(true);
    expect(isLessonCompleted(await store.load(LOCAL_PROFILE_ID), 'kids-a0-u2')).toBe(false);
  });
});
