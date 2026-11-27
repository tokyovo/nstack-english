import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyProgress, parseProgress, type LessonCompletion, type Progress } from './schema';

export {
  PROGRESS_SCHEMA_VERSION,
  upgradeProgress,
  type AnswerRecord,
  type LessonCompletion,
  type Progress,
} from './schema';

/** The only profile until accounts and child profiles exist. */
export const LOCAL_PROFILE_ID = 'local';

const KEY_PREFIX = 'hocenglish.progress.';

export type Answer = { itemId: string; correct: boolean };

export type LessonResult = { unitId: string; correct: number; total: number };

type StoreOptions = { now?: () => Date };

export function isLessonCompleted(progress: Progress, unitId: string): boolean {
  return unitId in progress.lessons;
}

function withCompletion(progress: Progress, result: LessonResult, at: string): Progress {
  const previous = progress.lessons[result.unitId];
  const completion: LessonCompletion = previous
    ? {
        firstCompletedAt: previous.firstCompletedAt,
        lastCompletedAt: at,
        bestCorrect: Math.max(previous.bestCorrect, result.correct),
        total: result.total,
        timesCompleted: previous.timesCompleted + 1,
      }
    : {
        firstCompletedAt: at,
        lastCompletedAt: at,
        bestCorrect: result.correct,
        total: result.total,
        timesCompleted: 1,
      };
  return { ...progress, lessons: { ...progress.lessons, [result.unitId]: completion } };
}

function withAnswer(progress: Progress, answer: Answer, at: string): Progress {
  const history = progress.answers[answer.itemId] ?? [];
  return {
    ...progress,
    answers: { ...progress.answers, [answer.itemId]: [...history, { at, correct: answer.correct }] },
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The last pending task per profile; each read and write waits for it, so none overwrites another. */
const queues = new Map<string, Promise<unknown>>();

function inOrder<T>(profileId: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(profileId) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(profileId, next.catch(() => undefined));
  return next;
}

export function createProgressStore({ now = () => new Date() }: StoreOptions = {}) {
  async function save(progress: Progress): Promise<Progress> {
    await AsyncStorage.setItem(KEY_PREFIX + progress.profileId, JSON.stringify(progress));
    return progress;
  }

  /** Unreadable progress is copied aside, never silently overwritten, then the profile starts fresh. */
  async function read(profileId: string): Promise<Progress> {
    const key = KEY_PREFIX + profileId;
    const saved = await AsyncStorage.getItem(key);
    if (saved === null) return emptyProgress(profileId);
    const progress = parseProgress(parseJson(saved), profileId);
    if (progress) return progress;
    await AsyncStorage.setItem(`${key}.unreadable.${now().toISOString()}`, saved);
    return save(emptyProgress(profileId));
  }

  function update(profileId: string, change: (progress: Progress, at: string) => Progress) {
    const at = now().toISOString();
    return inOrder(profileId, async () => save(change(await read(profileId), at)));
  }

  return {
    load(profileId: string): Promise<Progress> {
      return inOrder(profileId, () => read(profileId));
    },
    recordAnswer(profileId: string, answer: Answer): Promise<Progress> {
      return update(profileId, (progress, at) => withAnswer(progress, answer, at));
    },
    completeLesson(profileId: string, result: LessonResult): Promise<Progress> {
      return update(profileId, (progress, at) => withCompletion(progress, result, at));
    },
  };
}
