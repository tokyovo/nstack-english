// A review session: the due words, each asked once as an exercise the lesson player already knows.
// Options are drawn only from words the learner has met in the same track. Where the device can
// hear speech, one word per session is said aloud instead.
import { isTemplate, type Exercise, type Unit, type Word } from '@/content';
import type { Progress } from '@/progress';

import { dueWords, learnedWords, type ScheduledWord } from './schedule';

/** The most words one session asks about. */
export const SESSION_SIZE = 20;

const OPTION_COUNT = 4;

/** The exercise is recorded under `wordId`, the id the schedule reads. */
export type ReviewItem = { wordId: string; exercise: Exercise };

type Kind = 'choose_meaning' | 'listen_choose' | 'type_answer';

const ROTATION: readonly Kind[] = ['choose_meaning', 'listen_choose', 'type_answer'];

function pick<T>(items: readonly T[], random: () => number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (pool.length > 0) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return picked;
}

/** The answer and up to three other texts from `pool`, the answer at a random place. */
function optionsFor(answer: string, pool: readonly string[], random: () => number): string[] {
  const others = pick([...new Set(pool)].filter((text) => text !== answer), random).slice(0, OPTION_COUNT - 1);
  others.splice(Math.floor(random() * (others.length + 1)), 0, answer);
  return others;
}

function exerciseFor(word: Word, kind: Kind, sameTrack: readonly Word[], random: () => number): Exercise {
  const audio = word.audio ?? word.en;
  // A template cannot be typed as written, so it is recognised by its meaning instead.
  const asked = kind === 'type_answer' && isTemplate(word.en) ? 'choose_meaning' : kind;
  if (asked === 'choose_meaning') {
    const options = optionsFor(word.vi, sameTrack.map((w) => w.vi), random);
    if (options.length > 1 || isTemplate(word.en)) return { id: word.id, type: asked, prompt: word.id, options, answer: word.vi };
  }
  if (asked === 'listen_choose') {
    const options = optionsFor(word.en, sameTrack.map((w) => w.en), random);
    if (options.length > 1) return { id: word.id, type: asked, audio, options, answer: word.en };
  }
  // Too few learned words to offer a choice: the learner spells it instead.
  return { id: word.id, type: 'type_answer', prompt: word.vi, answer: word.en };
}

function speakExercise(word: Word): Exercise {
  return { id: word.id, type: 'speak', text: word.en, vi: word.vi };
}

/**
 * The longest complete phrase, the first on a tie: recognisers hear a phrase more reliably than a
 * short word. -1 when every word is a template, which cannot be said as written.
 */
function longestPhraseIndex(words: readonly Word[]): number {
  return words.reduce(
    (best, word, index) =>
      !isTemplate(word.en) && (best === -1 || word.en.length > words[best].en.length) ? index : best,
    -1
  );
}

type Options = {
  /** The device can hear the learner speak, so one word is said aloud. */
  speak?: boolean;
};

/** Up to SESSION_SIZE due words at `now`, the longest-waiting first, each with its exercise. */
export function reviewSession(
  progress: Progress,
  units: readonly Unit[],
  now: Date,
  random: () => number = Math.random,
  { speak = false }: Options = {}
): ReviewItem[] {
  const learned = learnedWords(progress, units);
  const wordsOf = (track: ScheduledWord['track']) => learned.filter((e) => e.track === track).map((e) => e.word);
  const due = dueWords(progress, units, now).slice(0, SESSION_SIZE);
  const spoken = speak ? longestPhraseIndex(due.map((entry) => entry.word)) : -1;
  return due.map((entry, index) => ({
    wordId: entry.word.id,
    exercise:
      index === spoken
        ? speakExercise(entry.word)
        : exerciseFor(entry.word, ROTATION[index % ROTATION.length], wordsOf(entry.track), random),
  }));
}
