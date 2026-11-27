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
});
