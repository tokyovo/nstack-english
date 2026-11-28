// Shared by the app and the server (which imports it by path), so it imports nothing but types.
import type { AnswerRecord, LessonCompletion, Progress } from './schema.ts';

/**
 * Combines two copies of one profile's progress. The result is a union, so merging is
 * idempotent, commutative and associative: retries and devices syncing in any order converge.
 * Lessons keep the earliest first completion, the latest last completion and the best score;
 * answers to an item are a set of (time, correct) pairs, oldest first.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  return {
    schemaVersion: a.schemaVersion,
    profileId: a.profileId,
    lessons: mergeRecords(a.lessons, b.lessons, mergeLesson),
    answers: mergeRecords(a.answers, b.answers, mergeAnswers),
  };
}

function mergeLesson(a: LessonCompletion, b: LessonCompletion): LessonCompletion {
  return {
    firstCompletedAt: earlier(a.firstCompletedAt, b.firstCompletedAt),
    lastCompletedAt: later(a.lastCompletedAt, b.lastCompletedAt),
    bestCorrect: Math.max(a.bestCorrect, b.bestCorrect),
    total: Math.max(a.total, b.total),
    timesCompleted: Math.max(a.timesCompleted, b.timesCompleted),
  };
}

function mergeAnswers(a: AnswerRecord[], b: AnswerRecord[]): AnswerRecord[] {
  const byKey = new Map<string, AnswerRecord>();
  for (const answer of [...a, ...b]) byKey.set(`${answer.at}|${answer.correct}`, answer);
  return [...byKey.values()].sort(
    (x, y) => compareTimes(x.at, y.at) || Number(x.correct) - Number(y.correct)
  );
}

/** Built with Object.fromEntries so an id such as `__proto__` stays an ordinary key. */
function mergeRecords<T>(
  a: Record<string, T>,
  b: Record<string, T>,
  mergeEntry: (x: T, y: T) => T
): Record<string, T> {
  const merged = new Map(Object.entries(a));
  for (const [key, value] of Object.entries(b)) {
    const existing = merged.get(key);
    merged.set(key, existing === undefined ? value : mergeEntry(existing, value));
  }
  return Object.fromEntries(merged);
}

/** Orders by instant; the same instant written two ways falls back to text order, so the result never depends on argument order. */
function compareTimes(x: string, y: string): number {
  return Date.parse(x) - Date.parse(y) || (x < y ? -1 : x > y ? 1 : 0);
}

function earlier(x: string, y: string): string {
  return compareTimes(x, y) <= 0 ? x : y;
}

function later(x: string, y: string): string {
  return compareTimes(x, y) >= 0 ? x : y;
}
