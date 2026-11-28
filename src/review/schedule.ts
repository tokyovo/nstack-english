// When each learned word comes back for review: Leitner boxes worked out from the progress
// the store already keeps, so the schedule has no state of its own.
// A word enters box 1 when its unit is first finished; a right answer moves it up one box,
// a wrong one sends it back to box 1. Answers are read under the word's id.
import type { Track, Unit, Word } from '@/content';
import type { AnswerRecord, Progress } from '@/progress';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export type Box = 1 | 2 | 3 | 4 | 5 | 6;

/** How long a word waits in each box before it is due again. */
const INTERVALS: Record<Box, number> = {
  1: 10 * MINUTE,
  2: 1 * DAY,
  3: 3 * DAY,
  4: 7 * DAY,
  5: 16 * DAY,
  6: 35 * DAY,
};

/** Where a right answer moves a word; the last box keeps it. */
const UP: Record<Box, Box> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 6 };

export type ScheduledWord = {
  word: Word;
  unitId: string;
  track: Track;
  box: Box;
  dueAt: Date;
};

function schedule(enteredAt: number, answers: readonly AnswerRecord[]): { box: Box; dueAt: Date } {
  let box: Box = 1;
  let lastSeen = enteredAt;
  for (const answer of answers) {
    const answeredAt = Date.parse(answer.at);
    if (answeredAt < enteredAt) continue;
    box = answer.correct ? UP[box] : 1;
    lastSeen = answeredAt;
  }
  return { box, dueAt: new Date(lastSeen + INTERVALS[box]) };
}

/** Every word of a finished unit, in the order of `units`, with its box and when it is due. */
export function learnedWords(progress: Progress, units: readonly Unit[]): ScheduledWord[] {
  return units.flatMap((unit) => {
    const completion = progress.lessons[unit.id];
    if (!completion) return [];
    const enteredAt = Date.parse(completion.firstCompletedAt);
    return unit.words.map((word) => ({
      word,
      unitId: unit.id,
      track: unit.track,
      ...schedule(enteredAt, progress.answers[word.id] ?? []),
    }));
  });
}

/** The words due at `now`, the one waiting longest first. */
export function dueWords(progress: Progress, units: readonly Unit[], now: Date): ScheduledWord[] {
  return learnedWords(progress, units)
    .filter((entry) => entry.dueAt.getTime() <= now.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}
