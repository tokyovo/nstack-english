// Shared by the app and the server (which imports it by path), so it imports nothing but types.
import type { AnswerRecord, LessonCompletion, Progress } from './schema.ts';

/**
 * Combines two copies of one profile's progress. The result is a union, so merging is
 * idempotent, commutative and associative: retries and devices syncing in any order converge.
 * Lessons keep the earliest first completion, the latest last completion and the best score;
 * answers to an item are a set of (time, correct) pairs, oldest first, of which only the latest
 * KEPT_ANSWERS are kept, so the document stops growing.
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

/**
 * Answers kept per item. The review schedule (src/review/schedule.ts) puts a word in box
 * 1 + right answers since its last wrong one, capped at box 6, so only the last 5 answers can
 * change it; 7 leaves a margin if boxes are added. Keeping the latest N of a union is still idempotent, commutative and associative.
 */
export const KEPT_ANSWERS = 7;

/** The union of two histories of one item, oldest first, cut to the latest KEPT_ANSWERS. */
export function mergeAnswers(a: AnswerRecord[], b: AnswerRecord[]): AnswerRecord[] {
  const byKey = new Map<string, AnswerRecord>();
  for (const answer of [...a, ...b]) byKey.set(`${answer.at}|${answer.correct}`, answer);
  return [...byKey.values()]
    .sort((x, y) => compareTimes(x.at, y.at) || Number(x.correct) - Number(y.correct))
    .slice(-KEPT_ANSWERS);
}

/**
 * Every entry goes through `mergeEntry`, also one only a side has (merged with itself), so each
 * comes out in the same shape. Built with Maps so an id such as `__proto__` stays an ordinary key.
 */
function mergeRecords<T>(
  a: Record<string, T>,
  b: Record<string, T>,
  mergeEntry: (x: T, y: T) => T
): Record<string, T> {
  const fromA = new Map(Object.entries(a));
  const fromB = new Map(Object.entries(b));
  const merged = new Map<string, T>();
  for (const [key, x] of fromA) merged.set(key, mergeEntry(x, fromB.get(key) ?? x));
  for (const [key, y] of fromB) if (!fromA.has(key)) merged.set(key, mergeEntry(y, y));
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
