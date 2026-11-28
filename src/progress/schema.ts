/**
 * The saved shape of a profile's progress. Bump PROGRESS_SCHEMA_VERSION whenever it changes and
 * add a step to MIGRATIONS that turns the previous version into the new one, so saved progress
 * is upgraded, never lost.
 */
export const PROGRESS_SCHEMA_VERSION = 1;

/**
 * The device copy of whoever learns without a child profile: a signed-out learner or the parent.
 * A child learning on the device has its own copy, saved under the child's profile id.
 */
export const LOCAL_PROFILE_ID = 'local';

export type LessonCompletion = {
  firstCompletedAt: string;
  lastCompletedAt: string;
  bestCorrect: number;
  total: number;
  timesCompleted: number;
};

/** One answer to an exercise; review scheduling will read this history. */
export type AnswerRecord = { at: string; correct: boolean };

export type Progress = {
  schemaVersion: typeof PROGRESS_SCHEMA_VERSION;
  profileId: string;
  /** Keyed by unit id, e.g. `everyday-a0-u1`. */
  lessons: Record<string, LessonCompletion>;
  /** Keyed by item id, e.g. `everyday-a0-u1-3`; each list is oldest first. */
  answers: Record<string, AnswerRecord[]>;
};

type SavedDocument = Record<string, unknown>;

/** Keyed by the version a step upgrades from. */
export type Migrations = Record<number, (saved: SavedDocument) => SavedDocument>;

export const MIGRATIONS: Migrations = {};

export function emptyProgress(profileId: string): Progress {
  return { schemaVersion: PROGRESS_SCHEMA_VERSION, profileId, lessons: {}, answers: {} };
}

function isRecord(value: unknown): value is SavedDocument {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Brings saved progress up to `targetVersion` by running each migration step in turn.
 * Returns null when it cannot: no version, a missing step, or a version newer than the app.
 */
export function upgradeProgress(
  saved: unknown,
  migrations: Migrations,
  targetVersion: number
): SavedDocument | null {
  if (!isRecord(saved) || !Number.isInteger(saved.schemaVersion)) return null;
  let document = saved;
  for (let version = Number(saved.schemaVersion); version < targetVersion; version++) {
    const step = migrations[version];
    if (!step) return null;
    document = { ...step(document), schemaVersion: version + 1 };
  }
  return document.schemaVersion === targetVersion ? document : null;
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isLessonCompletion(value: unknown): value is LessonCompletion {
  return (
    isRecord(value) &&
    isTime(value.firstCompletedAt) &&
    isTime(value.lastCompletedAt) &&
    isCount(value.bestCorrect) &&
    isCount(value.total) &&
    isCount(value.timesCompleted)
  );
}

function isAnswerHistory(value: unknown): value is AnswerRecord[] {
  return (
    Array.isArray(value) &&
    value.every((answer) => isRecord(answer) && isTime(answer.at) && typeof answer.correct === 'boolean')
  );
}

function isRecordOf<T>(value: unknown, isEntry: (entry: unknown) => entry is T): value is Record<string, T> {
  return isRecord(value) && Object.values(value).every(isEntry);
}

/** Reads progress saved by any earlier version of the app, or null when it is unreadable. */
export function parseProgress(saved: unknown, profileId: string): Progress | null {
  const document = upgradeProgress(saved, MIGRATIONS, PROGRESS_SCHEMA_VERSION);
  if (
    !document ||
    document.profileId !== profileId ||
    !isRecordOf(document.lessons, isLessonCompletion) ||
    !isRecordOf(document.answers, isAnswerHistory)
  ) {
    return null;
  }
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    profileId,
    lessons: document.lessons,
    answers: document.answers,
  };
}
