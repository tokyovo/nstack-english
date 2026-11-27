import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createProgressStore,
  isLessonCompleted,
  LOCAL_PROFILE_ID,
  PROGRESS_SCHEMA_VERSION,
  upgradeProgress,
} from '@/progress';

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

  it('loses no answer when several are saved at the same moment', async () => {
    const store = createProgressStore({ now: clockAt('2026-11-27T08:00:00.000Z') });

    await Promise.all([
      store.recordAnswer(LOCAL_PROFILE_ID, { itemId: 'everyday-a0-u1-1', correct: true }),
      store.recordAnswer(LOCAL_PROFILE_ID, { itemId: 'everyday-a0-u1-2', correct: false }),
      store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 1, total: 2 }),
    ]);

    const progress = await createProgressStore().load(LOCAL_PROFILE_ID);
    expect(Object.keys(progress.answers).sort()).toEqual(['everyday-a0-u1-1', 'everyday-a0-u1-2']);
    expect(isLessonCompleted(progress, 'everyday-a0-u1')).toBe(true);
  });

  it('keeps each profile separate', async () => {
    const store = createProgressStore();
    await store.completeLesson('child-1', { unitId: 'kids-a0-u2', correct: 10, total: 10 });

    expect(isLessonCompleted(await store.load('child-1'), 'kids-a0-u2')).toBe(true);
    expect(isLessonCompleted(await store.load(LOCAL_PROFILE_ID), 'kids-a0-u2')).toBe(false);
  });

  it('saves the schema version with the progress', async () => {
    await createProgressStore().completeLesson(LOCAL_PROFILE_ID, {
      unitId: 'everyday-a0-u1',
      correct: 10,
      total: 10,
    });

    const saved = JSON.parse((await AsyncStorage.getItem('hocenglish.progress.local')) ?? 'null');
    expect(saved.schemaVersion).toBe(1);
    expect(PROGRESS_SCHEMA_VERSION).toBe(1);
  });

  it.each([
    ['not JSON', '{"lessons": {'],
    ['the wrong shape', '{"schemaVersion":1,"profileId":"local","lessons":[],"answers":{}}'],
    ['no schema version', '{"profileId":"local","lessons":{},"answers":{}}'],
    ['a newer schema version', '{"schemaVersion":99,"profileId":"local","lessons":{},"answers":{}}'],
  ])('starts fresh but keeps a backup copy when the saved progress is %s', async (_, saved) => {
    await AsyncStorage.setItem('hocenglish.progress.local', saved);
    const store = createProgressStore({
      now: clockAt('2026-11-27T08:00:00.000Z', '2026-11-27T08:05:00.000Z'),
    });

    const progress = await store.load(LOCAL_PROFILE_ID);
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'work-a0-u1', correct: 7, total: 10 });

    expect(progress.lessons).toEqual({});
    expect(await AsyncStorage.getItem('hocenglish.progress.local.unreadable.2026-11-27T08:00:00.000Z')).toBe(saved);
    expect(isLessonCompleted(await store.load(LOCAL_PROFILE_ID), 'work-a0-u1')).toBe(true);
  });
});

describe('upgradeProgress', () => {
  const steps = {
    1: (doc: Record<string, unknown>) => ({ ...doc, streak: 0 }),
    2: (doc: Record<string, unknown>) => ({ ...doc, streakDays: doc.streak, streak: undefined }),
  };

  it('runs each step from the saved version up to the current one', () => {
    expect(upgradeProgress({ schemaVersion: 1, lessons: {} }, steps, 3)).toEqual({
      schemaVersion: 3,
      lessons: {},
      streakDays: 0,
      streak: undefined,
    });
  });

  it('returns progress already at the current version unchanged', () => {
    expect(upgradeProgress({ schemaVersion: 3, lessons: {} }, steps, 3)).toEqual({
      schemaVersion: 3,
      lessons: {},
    });
  });

  it.each([
    ['newer than the app', { schemaVersion: 4 }],
    ['missing a step', { schemaVersion: 0 }],
    ['without a version', { lessons: {} }],
    ['not an object', 'local'],
  ])('refuses progress %s', (_, saved) => {
    expect(upgradeProgress(saved, steps, 3)).toBeNull();
  });
});
