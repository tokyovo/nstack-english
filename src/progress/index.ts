import AsyncStorage from '@react-native-async-storage/async-storage';

/** The only profile until accounts and child profiles exist. */
export const LOCAL_PROFILE_ID = 'local';

export const PROGRESS_SCHEMA_VERSION = 1;

const KEY_PREFIX = 'hocenglish.progress.';

export type LessonCompletion = {
  firstCompletedAt: string;
  lastCompletedAt: string;
  bestCorrect: number;
  total: number;
  timesCompleted: number;
};

export type Progress = {
  schemaVersion: typeof PROGRESS_SCHEMA_VERSION;
  profileId: string;
  /** Keyed by unit id, e.g. `everyday-a0-u1`. */
  lessons: Record<string, LessonCompletion>;
  /** Keyed by item id, e.g. `everyday-a0-u1-3`; each list is oldest first. */
  answers: Record<string, AnswerRecord[]>;
};

/** One answer to an exercise; review scheduling will read this history. */
export type AnswerRecord = { at: string; correct: boolean };

export type Answer = { itemId: string; correct: boolean };

export type LessonResult = { unitId: string; correct: number; total: number };

type StoreOptions = { now?: () => Date };

export function isLessonCompleted(progress: Progress, unitId: string): boolean {
  return unitId in progress.lessons;
}

function emptyProgress(profileId: string): Progress {
  return { schemaVersion: PROGRESS_SCHEMA_VERSION, profileId, lessons: {}, answers: {} };
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

export function createProgressStore({ now = () => new Date() }: StoreOptions = {}) {
  async function load(profileId: string): Promise<Progress> {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + profileId);
    return raw === null ? emptyProgress(profileId) : (JSON.parse(raw) as Progress);
  }

  async function save(progress: Progress): Promise<Progress> {
    await AsyncStorage.setItem(KEY_PREFIX + progress.profileId, JSON.stringify(progress));
    return progress;
  }

  return {
    load,
    async recordAnswer(profileId: string, answer: Answer): Promise<Progress> {
      return save(withAnswer(await load(profileId), answer, now().toISOString()));
    },
    async completeLesson(profileId: string, result: LessonResult): Promise<Progress> {
      return save(withCompletion(await load(profileId), result, now().toISOString()));
    },
  };
}
